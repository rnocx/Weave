#!/usr/bin/env node
'use strict';

// Run with Playwright available through NODE_PATH, like test-script-controls.cjs.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      Object.assign(settings, { smartFilter: true, hideJoins: false, syncRead: false, syncCurrent: false, typing: false, uploadBackend: 'off' });
      window.filterTest = {};
      const events = ['join', 'part', 'quit', 'mode', 'nick', 'account', 'chghost'];
      filterTest.line = (id, tags, displayed) => ({ id, date: '2026-11-27T12:00:00Z', prefix: '--', message: `event ${id}`, tags, displayed });
      const lines = events.map((event, i) => filterTest.line(i + 1, [`irc_${event}`, 'irc_smart_filter'], false));
      lines.push(filterTest.line(8, ['irc_privmsg'], false)); // A different server filter.
      lines.push(filterTest.line(9, ['irc_join'], false));   // No smart tag: respect the server.
      lines.push(filterTest.line(10, ['irc_join'], true));
      lines.push(filterTest.line(11, ['irc_mode', 'irc_smart_filter'], true));
      lines.push(filterTest.line(12, ['irc_privmsg', 'nick_alice'], true));
      const b = makeBuffer({ id: 'filters', number: 1, name: 'irc.test.#filters', short_name: '#filters', type: 'formatted',
        local_variables: { plugin: 'irc', type: 'channel', nick: 'me' }, lines });
      b.lazy = false; b.hasMore = false;
      S.buffers.set(b.id, b); S.active = b.id; S.connected = true;
      showScreen('chat'); renderHeader(); renderMessages();
    });
    const ids = () => page.locator('.msgs .row[data-id]').evaluateAll(rows => rows.map(row => +row.dataset.id));
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await ids(), [10, 12]);
    await page.locator('#btnFilter').click(); await settle();
    assert.deepEqual(await ids(), [1, 2, 3, 4, 5, 6, 7, 10, 11, 12], 'Smart filter off reveals server-hidden smart events');
    assert.equal(await page.locator('.row[data-id="4"]').evaluate(row => row.classList.contains('ev')), true, 'mode changes render as events');
    assert.equal(await page.locator('#btnFilter').getAttribute('title'), 'Smart filter off — click to hide smart-filtered IRC events');

    await page.evaluate(() => setSetting('hideJoins', true));
    assert.deepEqual(await ids(), [4, 5, 6, 7, 11, 12], 'Hide all joins/parts/quits still applies');
    assert.match(await page.locator('#btnFilter').getAttribute('title'), /still enabled/);
    await page.evaluate(() => setSetting('hideJoins', false));

    // Live relay events follow the same visibility rules as loaded history.
    await page.evaluate(() => onLineAdded('filters', filterTest.line(13, ['irc_mode', 'irc_smart_filter'], false)));
    assert.ok((await ids()).includes(13));
    await page.locator('#btnFilter').click(); await settle();
    await page.evaluate(() => onLineAdded('filters', filterTest.line(14, ['irc_quit', 'irc_smart_filter'], false)));
    assert.deepEqual(await ids(), [10, 12]);
    await page.locator('#btnFilter').click(); await settle();
    assert.ok((await ids()).includes(14), 'events hidden while filtering remain available when it is disabled');

    // Changing the global default applies to buffers without an eye-button override.
    await page.evaluate(async () => { activeBuf().filterOverride = null; await setSetting('smartFilter', false); });
    assert.ok((await ids()).includes(1));
    await page.evaluate(() => { openSearch(); document.querySelector('#searchInput').value = 'event'; runSearch(); });
    const hitsBefore = await page.evaluate(() => S.search.hits.length);
    await page.locator('#btnFilter').click(); await settle();
    assert.ok(await page.evaluate(() => S.search.hits.length) < hitsBefore, 'search results track the buffer override');
    await page.evaluate(async () => { activeBuf().filterOverride = null; await setSetting('smartFilter', false); await setSetting('hideJoins', true); });
    assert.deepEqual(await page.evaluate(() => S.search.hits), [4, 5, 6, 7, 11, 12, 13]);
    console.log('Message filters: server-hidden smart events, unrelated filters, hide-all, live events, defaults, overrides, and search passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

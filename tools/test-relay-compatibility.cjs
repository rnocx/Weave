#!/usr/bin/env node
'use strict';

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
      Object.assign(settings, { syncRead: false, syncCurrent: false, typing: false });
      window.compat = { calls: [] };
      compat.line = (id, displayed = true) => ({ id, displayed, date: '2026-11-28T10:00:00Z',
        prefix: 'alice', message: 'Message ' + id, tags: ['irc_privmsg', 'nick_alice'] });
      compat.raw = { id: 1, number: 1, name: 'test.history', short_name: 'history', type: 'formatted',
        local_variables: {}, last_read_line_id: -1, first_line_not_read: false, lines_count: 600, lines_filtered: 300 };
      compat.all = Array.from({ length: 600 }, (_, i) => compat.line(i + 1, i % 2 === 1));
      compat.select = (want, between) => {
        if (!between) return compat.all.slice(-want);
        let i = compat.all.length, n = 0;
        while (i > 0 && n < want) { i--; if (compat.all[i].displayed !== false) n++; }
        return compat.all.slice(i);
      };
      request = async (method, url) => {
        compat.calls.push(url);
        if (compat.hold) await new Promise(resolve => { compat.release = resolve; });
        const want = +(url.match(/lines=-(\d+)/)?.[1] || 0);
        const lines = compat.select(want, url.includes('filtered=between'));
        return { body: url.includes('/lines?') ? lines : { ...compat.raw, lines } };
      };
      compat.reset = raw => {
        S.buffers.clear();
        const b = makeBuffer({ ...compat.raw, ...raw });
        S.buffers.set(b.id, b); S.active = b.id; S.connected = true;
        showScreen('chat'); renderHeader(); renderMessages();
        compat.calls = [];
        return b;
      };
      compat.reset();
    });
    await page.evaluate(() => ensureLoaded(activeBuf()));
    assert.equal(await page.evaluate(() => activeBuf().lines.length), 399, 'request counts 200 visible messages and retains hidden lines between');
    assert.equal(await page.evaluate(() => activeBuf().hasMore), true);
    assert.match(await page.evaluate(() => compat.calls[0]), /filtered=between/);
    await page.evaluate(() => fetchOlderLines(activeBuf()));
    assert.equal(await page.evaluate(() => activeBuf().lines.length), 600);
    assert.equal(await page.evaluate(() => activeBuf().hasMore), false, 'counts identify the end of history');

    await page.evaluate(() => {
      compat.all = compat.all.slice(-400);
      compat.raw.lines_count = 400; compat.raw.lines_filtered = 200;
      return ensureLoaded(compat.reset());
    });
    assert.equal(await page.evaluate(() => activeBuf().hasMore), false, 'an exact page of visible messages does not offer an empty extra page');

    await page.evaluate(() => {
      const b = compat.reset({ lines_count: undefined, lines_filtered: undefined, first_line_not_read: undefined });
      return ensureLoaded(b);
    });
    assert.equal(await page.evaluate(() => activeBuf().lines.length), 200, '4.10.5 keeps raw-line pagination');
    assert.doesNotMatch(await page.evaluate(() => compat.calls[0]), /filtered=/);

    // All-read and nothing-read have the same sentinel ID on newer relays.
    await page.evaluate(() => { compat.reset({ lines: [compat.line(10), compat.line(20)], first_line_not_read: true }); renderMessages(); });
    assert.equal(await page.locator('#msgs .marker').count(), 1);
    assert.equal(await page.locator('#msgs .marker').evaluate(el => el.nextElementSibling.nextElementSibling.dataset.id), '10');
    await page.evaluate(() => { compat.reset({ lines: [compat.line(10), compat.line(20)], first_line_not_read: false }); renderMessages(); });
    assert.equal(await page.locator('#msgs .marker').count(), 0);
    await page.evaluate(() => { compat.reset({ lines: [compat.line(10), compat.line(30)], last_read_line_id: 20 }); renderMessages(); });
    assert.equal(await page.locator('#msgs .marker').evaluate(el => el.nextElementSibling.dataset.id), '30', 'missing read-marker line still places New before the next unread message');
    assert.deepEqual(await page.evaluate(() => ['@+', '~@+', '+', '', '%+'].map(prefix => nickRank({ prefix }))), [2, 0, 4, 5, 3]);
    await page.evaluate(() => {
      const b = activeBuf(); b.lv = { plugin: 'irc', type: 'channel', nick: 'me' };
      b.nicks.set('me', { name: 'me', prefix: '@+' });
      b.nicks.set('alice', { name: 'alice', prefix: '+' });
      openNickMenu(document.querySelector('#btnFilter'), 'alice');
    });
    assert.equal(await page.locator('[data-act="kick"]').isVisible(), true, 'multiple prefixes retain moderation controls');
    await page.evaluate(() => closePopover());

    // A rule changes while the per-buffer switch stays enabled. A second event
    // during the fetch must not get lost; inactive buffers defer their refresh.
    await page.evaluate(() => {
      const b = compat.reset({ lines: [compat.line(599), compat.line(600)], lines_count: 600, lines_filtered: 300 });
      b.lazy = false; b.filterEnabled = true;
      compat.hold = true;
      handleEvent({ event_name: 'buffer_lines_filtered', buffer_id: 1, body: compat.raw });
    });
    await page.waitForFunction(() => !!compat.release);
    await page.evaluate(() => {
      handleEvent({ event_name: 'buffer_lines_filtered', buffer_id: 1, body: compat.raw });
      const line = compat.line(601); activeBuf().lines.push(line);
      compat.hold = false; compat.release();
    });
    await page.waitForFunction(() => !activeBuf().filterRefreshPromise);
    assert.equal(await page.evaluate(() => activeBuf().lines.find(l => l.id === 599).displayed), false);
    assert.equal(await page.evaluate(() => activeBuf().lines.at(-1).id), 601, 'filter refresh retains concurrent live messages');
    assert.equal(await page.evaluate(() => compat.calls.filter(url => url.includes('/lines?')).length), 2, 'coalesced refresh observes the latest event');
    assert.equal(await page.evaluate(() => activeBuf().filterEnabled), true);
    await page.evaluate(() => {
      const b = compat.reset({ lines: [compat.line(599), compat.line(600)] }); b.lazy = false;
      S.active = null;
      handleEvent({ event_name: 'buffer_lines_filtered', buffer_id: 1, body: compat.raw });
    });
    assert.equal(await page.evaluate(() => compat.calls.length), 0);
    await page.evaluate(() => activate('1'));
    await page.waitForFunction(() => !activeBuf().filterRefreshPromise);
    assert.equal(await page.evaluate(() => activeBuf().lines[0].displayed), false);
    console.log('Relay compatibility: stable pagination, capability-based filtered history, counts, read markers, multi-prefix ranks, filter events, coalescing, and inactive buffers passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

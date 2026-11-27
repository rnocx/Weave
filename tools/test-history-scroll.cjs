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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      Object.assign(settings, { syncRead: false, syncCurrent: false, typing: false, media: false });
      window.historyTest = {};
      historyTest.line = id => ({ id, date: '2026-11-27T10:00:00Z', prefix: `nick${id % 5}`,
        message: (`Message ${id}: varying lengths keep estimated heights from hiding scroll shifts. `).repeat(id % 4 + 1),
        tags: ['irc_privmsg', `nick_nick${id % 5}`] });
      historyTest.reset = () => {
        const b = makeBuffer({ id: 'history-test', number: 1, name: 'irc.test.#history', short_name: '#history',
          type: 'formatted', local_variables: { plugin: 'irc', type: 'channel', nick: 'me' },
          lines: Array.from({ length: 200 }, (_, i) => historyTest.line(i + 301)) });
        Object.assign(b, { lazy: false, hasMore: true, fetched: 200 });
        S.buffers.set(b.id, b); S.active = b.id; S.connected = true;
        showScreen('chat'); renderHeader(); renderMessages();
        return b;
      };
      historyTest.reset();
      historyTest.position = () => {
        const box = document.querySelector('#msgs'), top = box.getBoundingClientRect().top;
        const row = [...box.querySelectorAll('.row[data-id]')].find(r => r.getBoundingClientRect().bottom > top);
        return { id: row.dataset.id, offset: row.getBoundingClientRect().top - top };
      };
      request = () => new Promise(resolve => { historyTest.reply = resolve; });
    });
    // Read a partially visible message while an older-history request is pending.
    await page.evaluate(() => { const box = document.querySelector('#msgs'); box.scrollTop = 400; S.pinned = false; });
    await page.waitForTimeout(100);
    await page.evaluate(() => { historyTest.pending = loadOlder(); });
    await page.waitForFunction(() => !!historyTest.reply);
    await page.evaluate(() => {
      // A new live message arrives before the history response. It must not move
      // the message being read when older history is inserted above it.
      const b = activeBuf(), line = historyTest.line(501); b.lines.push(line); appendLine(line);
    });
    const before = await page.evaluate(() => historyTest.position());
    await page.evaluate(async () => {
      historyTest.reply({ body: Array.from({ length: 500 }, (_, i) => historyTest.line(i + 1)) });
      await historyTest.pending;
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => historyTest.position());
    assert.equal(after.id, before.id, 'loading older messages must preserve the visible message');
    assert.ok(Math.abs(after.offset - before.offset) <= 1, `message moved by ${after.offset - before.offset}px`);
    assert.equal(await page.evaluate(() => activeBuf().lines.at(-1).id), 501, 'keep live messages received during history loading');

    // Returning to the bottom during a slow fetch must keep following new messages.
    await page.evaluate(() => { historyTest.reset(); historyTest.pending = loadOlder(); });
    await page.waitForFunction(() => !!historyTest.reply);
    await page.evaluate(async () => {
      activeBuf().lastReadId = 350;
      scrollToBottom();
      historyTest.reply({ body: Array.from({ length: 500 }, (_, i) => historyTest.line(i + 1)) });
      await historyTest.pending;
    });
    assert.equal(await page.evaluate(() => S.pinned), true, 'stay pinned after a pending history request');
    assert.ok(await page.evaluate(() => { const box = document.querySelector('#msgs'); return box.scrollHeight - box.scrollTop - box.clientHeight < 2; }));

    // Expanding the render window must also preserve the visible message,
    // even when no network request is needed.
    await page.evaluate(() => {
      const b = historyTest.reset();
      b.lines = Array.from({ length: 1200 }, (_, i) => historyTest.line(i + 1));
      b.hasMore = false;
      renderMessages();
      document.querySelector('#msgs').scrollTop = 400;
      S.pinned = false;
    });
    await page.waitForTimeout(100);
    const cachedBefore = await page.evaluate(() => historyTest.position());
    await page.evaluate(() => loadOlder());
    await page.waitForTimeout(100);
    const cachedAfter = await page.evaluate(() => historyTest.position());
    assert.equal(cachedAfter.id, cachedBefore.id, 'expanding cached history must preserve the visible message');
    assert.ok(Math.abs(cachedAfter.offset - cachedBefore.offset) <= 1);
    assert.equal(await page.locator('.row[data-id]').first().evaluate(row => getComputedStyle(row).contentVisibility), 'visible', 'touch scrolling must use real message heights');
    console.log('History scrolling: visible anchor, concurrent live messages, bottom-following, cached history, and touch row heights passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

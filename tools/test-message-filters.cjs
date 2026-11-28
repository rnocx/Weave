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
    await page.addInitScript(() => localStorage.setItem('weave.settings', JSON.stringify({ smartFilter: false })));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      Object.assign(settings, { hideJoins: false, syncRead: false, syncCurrent: false, typing: false, uploadBackend: 'off' });
      window.filterTest = { calls: [], value: true, filtering: true };
      filterTest.line = (id, tags, displayed) => ({ id, date: '2026-11-28T12:00:00Z', prefix: '--', message: `event ${id}`, tags, displayed });
      const lines = ['join', 'part', 'quit', 'mode'].map((event, i) => filterTest.line(i + 1, [`irc_${event}`, 'irc_smart_filter'], false));
      lines.push(filterTest.line(5, ['irc_privmsg'], false));
      lines.push(filterTest.line(6, ['irc_join'], true));
      lines.push(filterTest.line(7, ['irc_mode', 'irc_smart_filter'], true));
      lines.push(filterTest.line(8, ['irc_privmsg', 'nick_alice'], true));
      filterTest.raw = { id: 'filters', number: 1, name: 'irc.test.#filters', short_name: '#filters', type: 'formatted',
        local_variables: { plugin: 'irc', type: 'channel', nick: 'me' }, lines };
      const b = makeBuffer(filterTest.raw); b.lazy = false; b.hasMore = false;
      S.buffers.set(b.id, b); S.active = b.id; S.connected = true;
      S.cfg = { host: 'relay.example.org', port: '443', tls: true };
      showScreen('chat'); renderHeader(); renderMessages();
      request = async (method, url, body) => {
        filterTest.calls.push({ method, url, body });
        if (url === '/api/options/irc.look.smart_filter') {
          if (filterTest.legacy) throw Object.assign(new Error('Resource not found'), { msg: { code: 404 } });
          if (filterTest.failRead) throw new Error('Option unavailable');
          if (filterTest.holdRead) return new Promise(resolve => { filterTest.replyRead = resolve; });
          return { body: { name: 'irc.look.smart_filter', type: 'boolean', value: filterTest.value } };
        }
        if (url.includes('/lines?')) return { body: filterTest.raw.lines.map(line => ({ ...line, displayed: filterTest.filtering ? line.displayed : true })) };
        if (url === '/api/input') {
          if (filterTest.failWrite) throw new Error('Command rejected');
          if (filterTest.holdWrite) await new Promise(resolve => { filterTest.releaseWrite = resolve; });
          if (body.command.startsWith('/eval /buffer set localvar_set_weave_filter_state ')) {
            const token = body.command.split(' ').at(-1).split(':')[0];
            filterTest.raw.local_variables.weave_filter_state = token + ':' + (filterTest.filtering ? '1' : '0');
            return { body: {} };
          }
          if (body.command === '/filter toggle @') { filterTest.filtering = !filterTest.filtering; return { body: {} }; }
          if (!filterTest.ignoreWrite) {
            filterTest.value = body.command.endsWith(' on');
            if (!filterTest.legacy) handleEvent({ event_name: 'option_changed', body: { name: 'irc.look.smart_filter', value: filterTest.value } });
          }
          return { body: {} };
        }
        if (url === '/api/version') return { body: { weechat_version: '4.10.5', relay_api_version: '0.7.0' } };
        if (url === '/api/completion') return { body: { list: filterTest.value ? ['on', 'off', 'toggle'] : ['off', 'on', 'toggle'] } };
        if (url.startsWith('/api/buffers?')) return { body: [filterTest.raw] };
        if (url.startsWith('/api/buffers/')) return { body: filterTest.raw };
        return { body: [] };
      };
    });
    const eye = page.locator('#btnFilter'), control = page.locator('#smartFilterSetting');
    const ids = () => page.locator('.msgs .row[data-id]').evaluateAll(rows => rows.map(row => +row.dataset.id));
    const idle = () => page.waitForFunction(() => !S.smartFilterBusy);
    const commands = () => page.evaluate(() => filterTest.calls.filter(call => call.url === '/api/input' && !call.body.command.startsWith('/eval ')).map(call => call.body.command));
    assert.equal(await control.isDisabled(), true, 'unknown server value must not be toggleable');
    await page.evaluate(() => { onConnected(); stopHeartbeat(); });
    await page.waitForFunction(() => S.smartFilter === true);
    await page.evaluate(() => readBufferFilterState(activeBuf()));
    assert.deepEqual(await commands(), [], 'connecting must not apply an old local preference to WeeChat');
    assert.equal(await page.evaluate(() => 'smartFilter' in settings), false);
    assert.deepEqual(await page.evaluate(() => filterTest.calls.find(call => call.url === '/api/sync').body.options), ['irc.look.smart_filter']);
    assert.equal(await control.isChecked(), true);
    assert.deepEqual(await ids(), [6, 7, 8], 'WeeChat display flags decide visibility, not the smart-filter tag');

    await page.evaluate(() => setSmartFilter(!S.smartFilter)); await idle();
    assert.deepEqual(await commands(), ['/set irc.look.smart_filter off']);
    assert.equal(await page.evaluate(() => filterTest.value), false);
    assert.equal(await eye.getAttribute('aria-pressed'), 'true', 'the global tagging option does not change the buffer filter switch');
    assert.deepEqual(await ids(), [6, 7, 8], 'turning the option off does not unhide existing server-filtered history');
    await page.evaluate(() => openSettings());
    await page.waitForFunction(() => !document.querySelector('#smartFilterSetting').disabled);
    assert.equal(await page.locator('#smartFilterSetting').isChecked(), false);
    await page.locator('#smartFilterSetting').locator('..').click(); await idle();
    assert.equal((await commands()).at(-1), '/set irc.look.smart_filter on');
    assert.equal(await control.isChecked(), true);
    await page.locator('#settingsDlg [data-close]').click();

    // A change from another client updates both controls without local writes.
    const commandCount = (await commands()).length;
    await page.evaluate(() => {
      filterTest.value = false;
      handleEvent({ event_name: 'option_changed', body: { name: 'irc.look.smart_filter', value: false } });
    });
    assert.equal(await control.isChecked(), false);
    assert.equal(await page.locator('#smartFilterSetting').isChecked(), false);
    assert.equal((await commands()).length, commandCount);
    await page.evaluate(() => {
      onLineAdded('filters', filterTest.line(9, ['irc_quit', 'irc_smart_filter'], false));
      onLineAdded('filters', filterTest.line(10, ['irc_join'], true));
    });
    assert.deepEqual(await ids(), [6, 7, 8, 10]);
    await page.evaluate(() => setSetting('hideJoins', true));
    assert.deepEqual(await ids(), [7, 8], 'Hide all joins remains a separate local setting');
    await page.evaluate(() => setSetting('hideJoins', false));

    // Failed writes and rejected /set commands cannot flip the displayed value.
    await page.evaluate(() => { filterTest.failWrite = true; });
    await page.evaluate(() => setSmartFilter(!S.smartFilter)); await idle();
    assert.equal(await control.isChecked(), false);
    await page.evaluate(() => { filterTest.failWrite = false; filterTest.ignoreWrite = true; });
    await page.evaluate(() => setSmartFilter(!S.smartFilter)); await idle();
    assert.equal(await control.isChecked(), false);
    assert.match(await page.locator('#toasts').innerText(), /did not change/);
    await page.evaluate(() => { filterTest.ignoreWrite = false; filterTest.holdWrite = true; filterTest.pending = setSmartFilter(true); });
    await page.waitForFunction(() => !!filterTest.releaseWrite);
    assert.equal(await control.isDisabled(), true);
    const pendingCommands = (await commands()).length;
    await page.evaluate(() => setSmartFilter(true));
    assert.equal((await commands()).length, pendingCommands, 'ignore repeated toggles during a pending write');
    await page.evaluate(async () => { filterTest.releaseWrite(); await filterTest.pending; filterTest.holdWrite = false; });

    // A live option event supersedes an older GET response.
    await page.evaluate(() => { filterTest.holdRead = true; filterTest.pendingRead = readSmartFilter(); });
    await page.waitForFunction(() => !!filterTest.replyRead);
    await page.evaluate(async () => {
      filterTest.value = false;
      handleEvent({ event_name: 'option_changed', body: { name: 'irc.look.smart_filter', value: false } });
      filterTest.replyRead({ body: { value: true } });
      await filterTest.pendingRead; filterTest.holdRead = false;
    });
    assert.equal(await control.isChecked(), false);
    await page.evaluate(async () => { filterTest.failRead = true; await readSmartFilter().catch(() => {}); });
    assert.equal(await control.isDisabled(), true, 'unavailable options must not fall back to local filtering');
    await page.evaluate(async () => {
      filterTest.failRead = false; await readSmartFilter();
      const b = activeBuf(); b.lines = filterTest.raw.lines.map(line => ({ ...line }));
      b.hasMore = false; renderMessages();
      await readBufferFilterState(b);
      const other = makeBuffer({ ...filterTest.raw, id: 'other', name: 'irc.test.#other' });
      other.lines = filterTest.raw.lines.map(line => ({ ...line }));
      S.buffers.set(other.id, other);
    });
    const globalBefore = await page.evaluate(() => filterTest.value);
    assert.equal(await eye.getAttribute('aria-pressed'), 'true');
    assert.equal(await eye.evaluate(button => button.classList.contains('on')), true);
    const filteredIcon = await eye.innerHTML();
    await eye.click();
    await page.waitForFunction(() => !activeBuf().filterBusy);
    assert.equal((await commands()).at(-1), '/filter toggle @');
    assert.deepEqual(await ids(), [1, 2, 3, 4, 5, 6, 7, 8], 'buffer toggle refreshes existing history from WeeChat');
    assert.equal(await page.evaluate(() => filterTest.value), globalBefore, 'buffer toggle must not change the global smart-filter option');
    assert.equal(await page.evaluate(() => S.buffers.get('other').lines[0].displayed), false, 'other buffers are unchanged');
    assert.equal(await eye.getAttribute('aria-pressed'), 'false');
    assert.equal(await eye.evaluate(button => button.classList.contains('on')), false);
    assert.notEqual(await eye.innerHTML(), filteredIcon, 'eye SVG changes after the confirmed buffer toggle');
    await page.evaluate(async () => { filterTest.filtering = true; await readBufferFilterState(activeBuf()); });
    assert.equal(await eye.getAttribute('aria-pressed'), 'true', 'external buffer changes update the icon');
    assert.deepEqual(await ids(), [6, 7, 8], 'external buffer changes refresh displayed history too');
    await page.evaluate(async () => { filterTest.filtering = false; await readBufferFilterState(activeBuf()); });
    assert.equal(await eye.getAttribute('aria-pressed'), 'false');
    await eye.click();
    await page.waitForFunction(() => !activeBuf().filterBusy);
    assert.deepEqual(await ids(), [6, 7, 8]);
    assert.equal(await eye.getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => { filterTest.failWrite = true; });
    await eye.click();
    await page.waitForFunction(() => !activeBuf().filterBusy);
    assert.deepEqual(await ids(), [6, 7, 8], 'failed buffer toggle leaves the displayed history unchanged');
    await page.evaluate(async () => { filterTest.failWrite = false; activeBuf().lines = []; renderMessages(); await readBufferFilterState(activeBuf()); });
    assert.equal(await eye.getAttribute('aria-pressed'), 'true', 'empty buffers still show the actual server switch');
    await eye.click();
    await page.waitForFunction(() => !activeBuf().filterBusy);
    assert.equal(await eye.getAttribute('aria-pressed'), 'false', 'empty-buffer toggle also changes the icon');
    await eye.click();
    await page.waitForFunction(() => !activeBuf().filterBusy);

    await page.clock.install();
    await page.evaluate(async () => {
      filterTest.failRead = false; filterTest.legacy = true; filterTest.value = true;
      onConnected(); stopHeartbeat();
    });
    await page.waitForFunction(() => S.smartFilterLegacy && S.smartFilter === true);
    assert.equal(await page.evaluate(() => S.smartFilterLegacy), true, 'stable relays fall back to completion');
    assert.equal(await control.isChecked(), true);
    await page.evaluate(() => setSmartFilter(!S.smartFilter)); await idle();
    assert.equal(await page.evaluate(() => filterTest.value), false, 'legacy path still writes the real option');
    await page.evaluate(() => { filterTest.value = true; });
    await page.clock.runFor(15001);
    await page.waitForFunction(() => S.smartFilter === true);
    await page.evaluate(() => teardown());
    assert.equal(await control.isDisabled(), true);
    assert.equal(await page.evaluate(() => S.smartFilter), null, 'disconnect discards the previous relay value');
    console.log('Smart filter: per-buffer WeeChat toggle and history refresh, global option read/write/sync, stable-relay completion and polling, preference migration, display flags, hide-all, rejected commands, repeated clicks, stale reads, and disconnect passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

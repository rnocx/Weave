#!/usr/bin/env node
'use strict';

// Run like screenshots.cjs, with Playwright available through NODE_PATH.
// Exercise the actual page against an in-page relay stub; no relay is used.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      window.scriptTest = { calls: [], failSelection: false, delay: 0 };
      Object.assign(settings, { syncRead: false, syncCurrent: false, typing: false, uploadBackend: 'off', theme: 'dark' });
      const names = ['autosort.py', 'go.py', 'grep.py'];
      const list = selected => names.map((name, y) => ({ id: y + 1, y,
        message: `${y === selected ? '\x1b[44m' : ''}ia r  ${name.padEnd(18)} 1.0  Example script ${y + 1}\x1b[0m` }));
      window.scriptTest.list = list;
      request = async (method, url, body) => {
        if (method === 'POST' && url === '/api/input') {
          scriptTest.calls.push(body);
          const command = body.command;
          if (command.startsWith('/script -go ') && scriptTest.failSelection) throw new Error('Selection request failed');
          if (scriptTest.delay) await new Promise(resolve => setTimeout(resolve, scriptTest.delay));
          const b = S.buffers.get('scripts');
          if (command.startsWith('/script -go ')) {
            b.lines = list(Number(command.split(' ').at(-1)));
            if (scriptTest.changeListOnSelect) b.lines[1].message = 'another script replaced this row';
            if (S.active === b.id) renderMessages();
          }
        }
        return { body: {} };
      };
      S.connected = true;
      S.cfg = { host: 'relay.example.org', port: '443' };
      onBuffersLoaded([
        { id: 'scripts', number: 1, name: 'script.scripts', short_name: 'scripts', type: 'free',
          title: 'Scripts: 3/3 | Filter: * | Sort: i,p,n', lines: list(0),
          local_variables: { plugin: 'script', type: 'script', filter: '*' },
          keys: [{ key: 'up', command: '/script -up' }, { key: 'meta-l', command: '/script load' }] },
        { id: 'chat', number: 2, name: 'core.weechat', short_name: 'weechat', type: 'formatted',
          lines: [], local_variables: { plugin: 'core', type: 'core' } },
      ]);
      setConnStatus('ok', 'Connected', 'relay.example.org');
    });
    const action = name => page.locator(`#scriptBar [data-script-action="${name}"]`);
    const idle = () => page.waitForFunction(() => !S.buffers.get('scripts').scriptBusy);
    const clear = () => page.evaluate(() => { scriptTest.calls = []; });
    const commands = () => page.evaluate(() => scriptTest.calls.filter(c => c.command.startsWith('/script')).map(c => c.command));
    assert.equal(await page.locator('#scriptBar').isVisible(), true);
    assert.equal(await page.locator('#scriptSelection').textContent(), 'Script 1 of 3');
    await clear();
    await page.locator('.row.free[data-y="1"]').click();
    await idle();
    await action('load').click();
    await idle();
    assert.deepEqual(await commands(), ['/script -go 1', '/script -go 1', '/script load 1']);
    assert.equal(await page.evaluate(() => scriptTest.calls.every(c => c.buffer_name === 'script.scripts')), true);

    // Requests must finish in order; a second action is disabled while busy.
    await clear();
    await page.evaluate(() => { scriptTest.delay = 100; });
    await action('reload').click();
    assert.equal(await action('remove').isDisabled(), true);
    await idle();
    assert.deepEqual(await commands(), ['/script -go 1', '/script reload 1']);
    await page.evaluate(() => { scriptTest.delay = 0; });

    // Failed selection must not fall through to the previously selected row.
    await clear();
    await page.evaluate(() => { scriptTest.failSelection = true; });
    await action('unload').click();
    await idle();
    assert.deepEqual(await commands(), ['/script -go 1']);
    assert.equal(await action('unload').isEnabled(), true);
    await page.evaluate(() => { scriptTest.failSelection = false; });

    await clear();
    await page.evaluate(() => { scriptTest.changeListOnSelect = true; });
    await action('unload').click(); await idle();
    assert.deepEqual(await commands(), ['/script -go 1']);
    await page.evaluate(() => { scriptTest.changeListOnSelect = false; S.buffers.get('scripts').lines = scriptTest.list(1); renderMessages(); });

    await clear();
    await action('install').click();
    assert.deepEqual(await commands(), []);
    await page.locator('#scriptConfirmCancel').click();
    assert.deepEqual(await commands(), []);
    await action('remove').click();
    await page.locator('#scriptConfirmApply').click();
    await idle();
    assert.deepEqual(await commands(), ['/script -go 1', '/script remove 1']);

    // If another client/filter changes a row while confirmation is open, abort.
    await clear();
    await action('remove').click();
    await page.evaluate(() => { S.buffers.get('scripts').lines[1].message = 'a different script'; });
    await page.locator('#scriptConfirmApply').click();
    assert.deepEqual(await commands(), []);
    assert.match(await page.locator('#toasts').innerText(), /script list changed/i);
    await page.evaluate(() => { const b = S.buffers.get('scripts'); b.lines = scriptTest.list(1); renderMessages(); });

    // Hold/autoload stay server commands; there is no inferred local state.
    await clear();
    await action('toggleautoload').click(); await idle();
    await action('hold').click(); await idle();
    assert.deepEqual(await commands(), ['/script -go 1', '/script toggleautoload 1', '/script -go 1', '/script hold 1']);

    // Details are not selectable script rows, even with arbitrary/localized text.
    await page.evaluate(() => {
      const b = S.buffers.get('scripts'); b.title = 'Retour à la liste';
      b.lines = [{ id: 1, y: 0, message: 'Name: autosort.py' }];
      renderHeader(); renderMessages();
    });
    assert.equal(await action('load').isDisabled(), true);
    assert.equal(await action('show').textContent(), 'Back to list');
    assert.equal(await page.locator('.row.free[role=button]').count(), 0);
    await clear(); await action('show').click(); await idle();
    assert.deepEqual(await commands(), ['/script show']);

    // Custom colour themes can omit the selected background; click/keyboard
    // selection must still work without relying on filename/status formatting.
    await page.evaluate(() => {
      const b = S.buffers.get('scripts'); b.title = 'Skripte: 3/3 | Filter: *';
      b.scriptSelY = null; b.lines = scriptTest.list(-1); renderHeader(); renderMessages();
    });
    assert.equal(await action('load').isDisabled(), true);
    await clear();
    await page.locator('.row.free[data-y="2"]').focus();
    await page.keyboard.press('Enter'); await idle();
    assert.deepEqual(await commands(), ['/script -go 2']);
    await action('-up').click(); await idle();
    assert.equal((await commands()).at(-1), '/script -go 1');
    await clear();
    await page.locator('#input').focus();
    await page.keyboard.press('Alt+l'); await idle();
    assert.deepEqual(await commands(), ['/script -go 1', '/script load 1']);

    await clear(); await action('enable').click();
    assert.deepEqual(await commands(), []);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#scriptConfirmDlg').isVisible(), false);
    await action('enable').click(); await page.locator('#scriptConfirmApply').click(); await idle();
    assert.deepEqual(await commands(), ['/script enable']);
    await clear(); await action('update').click(); await idle();
    await action('reset').click(); await idle();
    assert.deepEqual(await commands(), ['/script update', '/script search *']);

    await page.evaluate(() => { S.connected = false; setConnStatus('', 'Offline'); });
    assert.equal(await action('load').isDisabled(), true);
    assert.equal(await action('enable').isDisabled(), true);
    await page.evaluate(() => { S.connected = true; setConnStatus('ok', 'Connected'); activate('chat'); });
    assert.equal(await page.locator('#scriptBar').isVisible(), false);
    await page.evaluate(() => activate('scripts'));

    // A phone must have no toolbar overflow and every action stays visible.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => {
      const bar = document.querySelector('#scriptBar');
      return [...bar.querySelectorAll('button')].every(b => {
        const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
      });
    }), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await action('install').click();
    assert.equal(await page.locator('#scriptConfirmDlg').isVisible(), true);
    await page.locator('#scriptConfirmCancel').click();
    assert.deepEqual(errors, []);
    console.log('Script controls: selection, ordered actions, failed requests, confirmation, stale lists, details, custom colours, keyboard, offline state, and phone layout passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

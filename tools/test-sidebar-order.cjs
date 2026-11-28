#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

function seed() {
  settings.uploadBackend = 'off'; settings.syncRead = settings.syncCurrent = false;
  S.buffers.clear(); S.connected = false;
  const entries = [
    ['0', 'core.weechat', 'weechat', 'core', '', 'core'],
    ['1', 'irc.server.alpha', 'alpha', 'irc', 'alpha', 'server'],
    ['2', 'irc.alpha.#one', '#one', 'irc', 'alpha', 'channel'],
    ['3', 'irc.alpha.#two', '#two', 'irc', 'alpha', 'channel'],
    ['4', 'irc.server.beta', 'beta', 'irc', 'beta', 'server'],
    ['5', 'irc.beta.#three', '#three', 'irc', 'beta', 'channel'],
    ['6', 'irc.beta.#four', '#four', 'irc', 'beta', 'channel'],
    ['7', 'irc.server.gamma', 'gamma', 'irc', 'gamma', 'server'],
    ['8', 'irc.gamma.#five', '#five', 'irc', 'gamma', 'channel'],
    ['9', 'irc.delta.#six', '#six', 'irc', 'delta', 'channel'], // No server buffer.
  ];
  for (const [id, name, short_name, plugin, server, type] of entries) {
    const b = makeBuffer({ id, number: +id + 1, name, short_name, type: 'formatted', lines: [],
      local_variables: { plugin, server, type, nick: 'me' } });
    b.lazy = false; S.buffers.set(id, b);
  }
  window.orderTest = { requests: [] };
  request = async (...args) => { orderTest.requests.push(args); return { body: {} }; };
  S.active = '2'; showScreen('chat'); applySettings(); renderHeader(); renderMessages();
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width: touch ? 393 : 1440, height: 900 }, isMobile: touch, hasTouch: touch });
      await context.route(/^https?:/, route => route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.evaluate(seed);
      if (touch) await page.locator('#btnMenu').click();
      const networks = () => page.locator('#bufList .grp[data-group^="irc:"]').evaluateAll(rows => rows.map(row => row.dataset.group));
      const channels = () => page.locator('.buf-row[data-group="irc:alpha"] .buf').evaluateAll(rows => rows.map(row => row.dataset.id));
      const menu = key => page.locator(`[data-network-menu="irc:${key}"]`);
      const contextMenu = async locator => {
        if (!touch) { await locator.dispatchEvent('contextmenu'); return; }
        const box = await locator.boundingBox();
        await locator.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + 20, clientY: box.y + box.height / 2 });
        await page.locator('.pop').waitFor({ state: 'visible' });
        await locator.dispatchEvent('pointerup', { pointerType: 'touch' });
      };
      assert.deepEqual(await networks(), ['irc:alpha', 'irc:beta', 'irc:gamma', 'irc:delta']);
      await menu('beta').click();
      await page.getByRole('button', { name: 'Move network up', exact: true }).click();
      assert.deepEqual(await networks(), ['irc:beta', 'irc:alpha', 'irc:gamma', 'irc:delta']);
      await menu('alpha').click();
      await page.getByRole('button', { name: 'Move network down', exact: true }).click();
      assert.deepEqual(await networks(), ['irc:beta', 'irc:gamma', 'irc:alpha', 'irc:delta']);
      if (touch) {
        const heading = page.locator('[data-network="irc:gamma"]');
        await heading.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 70, clientY: 200 });
        await page.getByRole('button', { name: 'Move network up', exact: true }).waitFor();
        await heading.dispatchEvent('pointerup', { pointerType: 'touch' });
        await page.getByRole('button', { name: 'Move network up', exact: true }).click();
        await page.waitForFunction(() => !S.suppressClick);
        assert.deepEqual(await networks(), ['irc:gamma', 'irc:beta', 'irc:alpha', 'irc:delta']);
      }
      if (!touch) {
        await page.locator('[data-network="irc:delta"]').dragTo(page.locator('[data-network="irc:beta"]'), { targetPosition: { x: 20, y: 1 } });
        assert.deepEqual(await networks(), ['irc:delta', 'irc:beta', 'irc:gamma', 'irc:alpha']);
        const second = page.locator('.buf[data-id="3"]');
        const bounds = await second.boundingBox();
        await page.locator('.buf[data-id="2"]').dragTo(second, { targetPosition: { x: 30, y: bounds.height - 2 } });
      } else {
        const size = await menu('alpha').boundingBox();
        assert.ok(size.width >= 40 && size.height >= 40, 'network menu has a touch-sized target');
        await contextMenu(page.locator('.buf[data-id="2"]'));
        await page.getByRole('button', { name: 'Move down', exact: true }).click();
      }
      assert.deepEqual(await channels(), ['3', '2']);
      const savedNetworks = await networks();
      await contextMenu(page.locator('.buf[data-id="6"]'));
      await page.getByRole('button', { name: 'Pin to top', exact: true }).click();
      assert.equal(await page.locator('#bufList .grp').first().getAttribute('data-group'), 'pinned');
      assert.deepEqual(await networks(), savedNetworks);
      assert.equal(await page.locator('[data-network-menu="pinned"]').count(), 0);
      if (!touch) {
        await page.locator('[data-network="irc:alpha"]').dragTo(page.locator('.grp-pinned .grp-name'));
        assert.deepEqual(await networks(), savedNetworks, 'networks cannot move into Pinned');
      }
      await page.reload(); await page.evaluate(seed);
      if (touch) await page.locator('#btnMenu').click();
      assert.deepEqual(await networks(), savedNetworks, 'network order survives a reload');
      assert.deepEqual(await channels(), ['3', '2'], 'channel order survives a reload');
      assert.deepEqual(await page.evaluate(() => orderTest.requests), [], 'reordering sends no relay commands');
      assert.deepEqual(await page.evaluate(() => [...S.buffers.values()].map(b => b.number)), [1,2,3,4,5,6,7,8,9,10]);
      await menu('alpha').click();
      await page.getByRole('button', { name: 'Reset network order', exact: true }).click();
      assert.deepEqual(await networks(), ['irc:alpha', 'irc:beta', 'irc:gamma', 'irc:delta']);
      assert.deepEqual(await channels(), ['3', '2'], 'resetting networks preserves channel ordering');
      await menu('alpha').click();
      await page.getByRole('button', { name: 'Reset channel order', exact: true }).click();
      assert.deepEqual(await channels(), ['2', '3']);
      await page.evaluate(() => {
        layout.networks = ['irc:alpha', 'irc:absent', 'irc:beta', 'irc:gamma', 'irc:delta'];
        moveNetwork('irc:beta', -1);
      });
      assert.deepEqual(await page.evaluate(() => layout.networks.slice(0, 3)), ['irc:beta', 'irc:absent', 'irc:alpha'], 'absent networks retain their saved place');
      fs.mkdirSync(path.join(root, 'work/sidebar-order'), { recursive: true });
      await page.screenshot({ path: path.join(root, 'work/sidebar-order', touch ? 'phone.png' : 'desktop.png') });
      await context.close();
    }
    console.log('Sidebar order: desktop drag, phone menus, networks, channels, persistence, resets, Pinned, absent networks, and unchanged relay order passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

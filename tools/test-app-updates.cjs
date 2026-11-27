#!/usr/bin/env node
'use strict';

// Build deploy/dist first. Run with Playwright available through NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const next = version.split('.').map(Number); next[2]++;
const nextVersion = next.join('.');
const files = Object.fromEntries(['index.html', 'weave.css', 'weave.js'].map(name =>
  [name, fs.readFileSync(path.join(root, 'deploy/dist', name), 'utf8')]));

async function main() {
  let newer = false, failPage = false, failAsset = false;
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname === '/weave/' ? 'index.html' : url.pathname.split('/').pop();
    requests.push(req.url);
    if (!files[name]) { res.writeHead(404).end(); return; }
    if ((name === 'index.html' && failPage) || (name === 'weave.js' && failAsset)) { res.writeHead(503).end(); return; }
    let body = files[name];
    if (newer) body = body.replaceAll(version, nextVersion);
    if (name === 'index.html' && url.searchParams.has('unversioned')) body = body.replace(/\?v=[\d.]+/g, '');
    if (name === 'weave.css') body += `\n:root{--update-test:${newer ? 'new' : 'old'}}`;
    const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000' }).end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const unversioned of [false, true]) {
      newer = failPage = failAsset = false;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      // Exercise the installed-app path without relying on installation UI.
      await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
      // Routing would disable the browser's HTTP cache, defeating this check.
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/weave/?test=keep' + (unversioned ? '&unversioned=1' : '') + '#keep');
      await page.locator('#btnAppUpdates').click();
      const check = page.locator('#btnCheckUpdate'), refresh = page.locator('#btnRefreshApp'), status = page.locator('#appUpdateStatus');
      assert.equal(await check.isVisible(), true, 'update controls are visible in standalone mode');
      await check.click();
      await page.waitForFunction(() => !document.querySelector('#btnCheckUpdate').disabled);
      assert.match(await status.innerText(), /current version/);
      assert.equal(await page.evaluate(() => CONFIG.version), version);

      newer = true;
      const cachedScript = await page.evaluate(async asset => (await fetch(asset)).text(),
        unversioned ? 'weave.js' : `weave.js?v=${version}`);
      assert.ok(cachedScript.includes(`version: '${version}'`), 'normal asset requests still see the cached older release');
      await check.click();
      await page.waitForFunction(() => !document.querySelector('#btnCheckUpdate').disabled);
      assert.ok((await status.innerText()).includes(nextVersion));
      assert.equal(await page.evaluate(() => CONFIG.version), version, 'checking does not reload');
      const originalURL = page.url();
      failPage = true;
      await refresh.click();
      await page.waitForFunction(() => !document.querySelector('#btnCheckUpdate').disabled);
      assert.match(await status.innerText(), /HTTP 503/);
      assert.equal(page.url(), originalURL, 'failed page fetch leaves the app open');
      failPage = false; failAsset = true;
      await refresh.click();
      await page.waitForFunction(() => !document.querySelector('#btnCheckUpdate').disabled);
      assert.match(await status.innerText(), /Could not download/);
      assert.equal(page.url(), originalURL, 'failed asset fetch leaves the app open');
      failAsset = false;
      await page.evaluate(() => {
        const b = makeBuffer({ id: 'draft-test', number: 1, name: 'irc.test.#draft', short_name: '#draft', type: 'formatted', lines: [] });
        S.buffers.set(b.id, b); S.active = b.id;
        document.querySelector('#input').value = 'Draft typed just before refresh';
        settings.density = 'compact'; saveSettings();
      });
      await Promise.all([page.waitForURL(url => url.searchParams.has('weave-refresh')), refresh.click()]);
      await page.waitForFunction(expected => typeof CONFIG !== 'undefined' && CONFIG.version === expected, nextVersion);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--update-test')), 'new', 'fresh CSS is applied');
      assert.equal(await page.evaluate(() => settings.density), 'compact');
      assert.equal(await page.evaluate(() => drafts['irc.test.#draft']), 'Draft typed just before refresh');
      assert.equal(new URL(page.url()).searchParams.get('test'), 'keep');
      assert.equal(new URL(page.url()).hash, '#keep');
      if (!unversioned) assert.ok(requests.some(url => url.includes(`weave.js?v=${nextVersion}`)), 'new version uses a fresh asset URL');
      assert.deepEqual(errors, []);
      await page.evaluate(() => openSettings());
      await page.locator('#appUpdateRow').scrollIntoViewIfNeeded();
      if (!unversioned) {
        fs.mkdirSync(path.join(root, 'work/app-updates'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'work/app-updates/phone-settings.png') });
      }
      await context.close();
    }
    console.log('App updates: standalone controls, version checks, failed downloads, cached versioned/unversioned assets, settings, drafts, and URL preservation passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

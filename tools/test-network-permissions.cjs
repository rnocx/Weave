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
    page.setDefaultTimeout(10000);
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      window.netTest = { state: 'prompt', calls: [], sockets: [], queries: [], delay: 0, aborted: false };
      Object.defineProperty(navigator, 'permissions', { configurable: true, value: {
        query: async ({ name }) => {
          netTest.queries.push(name);
          if (netTest.state === 'unsupported') throw new TypeError('Unknown permission');
          return { state: netTest.state };
        },
      } });
      window.WebSocket = class {
        static OPEN = 1;
        constructor(url, protocols) { this.url = url; this.protocols = protocols; netTest.sockets.push(this); }
        close() { this.onclose?.(); }
      };
      window.fetch = async (url, options) => {
        netTest.calls.push({ url, options });
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, netTest.delay);
          options.signal?.addEventListener('abort', () => {
            clearTimeout(t); netTest.aborted = true; reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        if (netTest.denyDuringFetch) netTest.state = 'denied';
        return { ok: true, json: async () => ({ password_hash_algo: 'sha256' }) };
      };
      onConnected = () => { netTest.connected = true; };
      netTest.cfg = { host: '192.168.1.5', port: '9000', tls: true, password: 'secret', auth: 'auto' };
      netTest.reset = () => {
        clearTimeout(S.connectTimer);
        Object.assign(S, { ws: null, connecting: false, connected: false, everConnected: false, userClosed: false });
        Object.assign(netTest, { calls: [], sockets: [], queries: [], delay: 0, aborted: false, denyDuringFetch: false });
      };
    });
    assert.deepEqual(await page.evaluate(() => [
      '192.168.1.5', '10.0.1.5', '172.16.0.1', '172.32.0.1', '169.254.1.1',
      'relay.local', '[fd00::1]', '[fe80::1]', '[::1]', '127.0.0.2', 'localhost', 'relay.example.org', '8.8.8.8',
    ].map(relayAddressSpace)), ['local', 'local', 'local', 'public', 'local', 'local', 'local', 'local', 'loopback', 'loopback', 'loopback', 'unknown', 'public']);

    await page.evaluate(() => connect(netTest.cfg));
    assert.equal(await page.evaluate(() => netTest.calls.length + netTest.sockets.length), 0, 'automatic login waits for a tap');
    assert.match(await page.locator('#cError').textContent(), /Tap Connect/);
    assert.equal(await page.locator('#cSubmit').isEnabled(), true);

    await page.evaluate(() => { netTest.reset(); netTest.delay = 5500; });
    await page.evaluate(() => { window.connectAttempt = connect(netTest.cfg, { userInitiated: true }); });
    await page.waitForFunction(() => netTest.calls.length === 1);
    assert.equal(await page.locator('#cNetworkHint').isVisible(), true);
    await page.evaluate(() => window.connectAttempt);
    assert.equal(await page.evaluate(() => netTest.aborted), false, 'permission wait survives the former five-second timeout');
    assert.match(await page.evaluate(() => netTest.sockets[0].protocols[1]), /^base64url/);
    assert.match(await page.evaluate(() => atob(netTest.sockets[0].protocols[1].split('.').at(-1).replace(/-/g, '+').replace(/_/g, '/'))), /^hash:sha256:/, 'delayed handshake retains hashed authentication');
    await page.evaluate(() => netTest.sockets[0].onopen());
    assert.equal(await page.locator('#cNetworkHint').isHidden(), true);

    await page.evaluate(() => { netTest.reset(); netTest.state = 'denied'; return connect(netTest.cfg, { userInitiated: true }); });
    assert.equal(await page.evaluate(() => netTest.calls.length + netTest.sockets.length), 0);
    assert.match(await page.locator('#cError').textContent(), /Site settings → Local network access/);

    await page.evaluate(() => { netTest.reset(); netTest.state = 'prompt'; netTest.denyDuringFetch = true; return connect(netTest.cfg, { userInitiated: true }); });
    assert.equal(await page.evaluate(() => netTest.sockets.length), 0, 'denial during handshake does not fall back to another connection');

    await page.evaluate(() => { netTest.reset(); netTest.state = 'granted'; return connect(netTest.cfg); });
    assert.equal(await page.evaluate(() => netTest.sockets.length), 1, 'granted permission preserves automatic login');
    await page.evaluate(() => { netTest.reset(); netTest.state = 'unsupported'; return connect(netTest.cfg, { userInitiated: true }); });
    assert.equal(await page.evaluate(() => netTest.sockets.length), 1, 'unsupported Permissions API does not block manual connections');
    assert.equal(await page.evaluate(() => netTest.queries.includes('local-network-access')), false);

    await page.evaluate(() => { netTest.reset(); netTest.state = 'denied'; return connect({ ...netTest.cfg, host: '8.8.8.8' }); });
    assert.equal(await page.evaluate(() => netTest.sockets.length), 1, 'LAN permission cannot block a public IP');
    await page.evaluate(() => { netTest.reset(); netTest.state = 'prompt'; return connect({ ...netTest.cfg, host: 'private.example.org' }); });
    assert.equal(await page.evaluate(() => netTest.sockets.length), 1, 'unknown DNS names keep automatic login; the browser classifies the resolved IP');
    console.log('Network permissions: tap-to-connect, delayed prompt, denial, hashed auth, automatic login, public IPs, DNS names, and unsupported browsers passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

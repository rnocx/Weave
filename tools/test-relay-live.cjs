#!/usr/bin/env node
'use strict';

// Run against an isolated installed headless binary, or a WeeChat Docker image.
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const docker = args => execFileSync('docker', args, { encoding: 'utf8' }).trim();

async function main() {
  const binary = process.argv[2] === '--binary' ? process.argv[3] : null;
  const image = process.argv[2] === '--image' ? process.argv[3] : 'weechat/weechat:4.10.5';
  const container = 'weave-relay-compat-' + Date.now();
  let child, observer, browser, output = '';
  try {
    let port;
    if (binary) {
      const server = net.createServer();
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      port = server.address().port;
      await new Promise(resolve => server.close(resolve));
    } else port = 9000;
    const args = ['-t', '-a', '-s', '-P', 'irc,relay', '--stdout', '-r', '/set relay.network.password weave-compat-test',
      '-r', '/set relay.network.bind_address 127.0.0.1', '-r', '/relay add ipv4.api ' + port];
    if (binary) {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { output = (output + chunk).slice(-12000); });
      child.stderr.on('data', chunk => { output = (output + chunk).slice(-12000); });
    } else {
      // Bind the container's listener on its interface; publish only on host loopback.
      args[args.indexOf('/set relay.network.bind_address 127.0.0.1')] = '/set relay.network.bind_address 0.0.0.0';
      docker(['run', '-d', '--rm', '--name', container, '-p', '127.0.0.1::9000', '--entrypoint', 'weechat-headless', image, ...args]);
      port = +docker(['port', container, '9000/tcp']).split(':').at(-1);
    }
    for (let i = 0; ; i++) {
      try {
        await new Promise((resolve, reject) => { const socket = net.connect(port, '127.0.0.1', () => { socket.destroy(); resolve(); }); socket.on('error', reject); });
        break;
      } catch (error) { if (i >= 99) throw new Error('Relay did not start: ' + output); await sleep(100); }
    }
    // Docker's published port can accept TCP before the relay has started.
    for (let i = 0; ; i++) {
      observer = new WebSocket(`ws://127.0.0.1:${port}/api`, ['api.weechat', 'base64url.bearer.authorization.weechat.' + Buffer.from('plain:weave-compat-test').toString('base64url')]);
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('WebSocket startup timeout')), 5000);
          observer.onopen = () => { clearTimeout(timer); resolve(); };
          observer.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket startup failed')); };
        });
        break;
      } catch (error) { observer.close(); if (i >= 29) throw error; await sleep(100); }
    }
    let seq = 0;
    const request = (method, url, body) => new Promise((resolve, reject) => {
      const id = 'compat-' + (++seq);
      const timer = setTimeout(() => { observer.removeEventListener('message', receive); reject(new Error('API timeout: ' + url)); }, 10000);
      const receive = event => {
        const msg = JSON.parse(event.data);
        if (msg.request_id !== id) return;
        clearTimeout(timer); observer.removeEventListener('message', receive);
        if (msg.code >= 400) reject(new Error(JSON.stringify(msg))); else resolve(msg);
      };
      observer.addEventListener('message', receive);
      observer.send(JSON.stringify({ request: method + ' ' + url, request_id: id, ...(body ? { body } : {}) }));
    });
    const version = (await request('GET', '/api/version')).body;
    const core = (await request('GET', '/api/buffers?lines=0')).body[0];
    const command = async (buffer_id, command) => { await request('POST', '/api/input', { buffer_id, command }); await sleep(75); };
    await command(core.id, '/print -newbuffer weave-compat -tags weave_hidden WEAVE_HIDDEN_SEED');
    const b = (await request('GET', '/api/buffers?lines=0')).body.find(b => b.name.includes('weave-compat'));
    assert.ok(b);
    await command(b.id, '/repeat 600 /print -tags ${if:${calc:${repeat_index}%2}?weave_hidden:weave_visible} Message ${repeat_index}');
    await command(core.id, '/filter add weave_compat ' + b.name + ' weave_hidden *');
    const snapshot = (await request('GET', `/api/buffers/${b.id}?lines=-1000`)).body;
    assert.equal(snapshot.lines.length, 601);
    assert.equal(snapshot.lines.filter(l => l.displayed !== false).length, 300);
    const modern = snapshot.lines_count !== undefined;
    if (modern) { assert.equal(snapshot.lines_count, 601); assert.equal(snapshot.lines_filtered, 301); }

    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(async port => {
      Object.assign(settings, { syncRead: false, syncCurrent: false, typing: false, uploadBackend: 'off' });
      await connect({ host: '127.0.0.1', port: String(port), password: 'weave-compat-test', tls: false, path: '/api', auth: 'auto' }, { userInitiated: true });
    }, port);
    await page.waitForFunction(id => S.connected && S.buffers.has(id) && S.smartFilter === true, String(b.id));
    await page.evaluate(id => activate(id), String(b.id));
    await page.waitForFunction(() => !activeBuf().lazy && !activeBuf().loading);
    assert.equal(await page.evaluate(() => activeBuf().lines.filter(l => l.displayed !== false).length), modern ? 200 : 100);
    await page.evaluate(() => fetchOlderLines(activeBuf()));
    if (modern) {
      assert.equal(await page.evaluate(() => activeBuf().lines.length), 601);
      assert.equal(await page.evaluate(() => activeBuf().hasMore), false);
    }
    assert.equal(await page.locator('#msgs').getByText('WEAVE_HIDDEN_SEED', { exact: true }).count(), 0);
    // Deleting a rule does not change buffer.filter: only the new event reports it.
    await command(core.id, '/filter del weave_compat');
    if (modern) await page.waitForFunction(() => !activeBuf().filterRefreshPromise && activeBuf().lines.every(l => l.displayed !== false));
    else await page.evaluate(() => refreshBufferFilterHistory(activeBuf()));
    assert.equal(await page.evaluate(() => activeBuf().lines.every(l => l.displayed !== false)), true);
    await page.evaluate(() => setSmartFilter(false));
    await page.waitForFunction(() => !S.smartFilterBusy && S.smartFilter === false);
    await command(core.id, '/set irc.look.smart_filter on');
    if (!modern) await page.evaluate(() => readSmartFilter());
    await page.waitForFunction(() => S.smartFilter === true);
    assert.deepEqual(errors, []);
    console.log(`Live WeeChat ${version.weechat_version} / API ${version.relay_api_version}: hashed login, history paging${modern ? ', counts and filter events' : ', stable fallbacks'}, and global option changes passed.`);
  } finally {
    observer?.close();
    await browser?.close();
    if (child) { child.kill('SIGTERM'); await new Promise(resolve => child.exitCode != null ? resolve() : child.once('exit', resolve)); }
    if (!binary) { try { docker(['rm', '-f', container]); } catch {} }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

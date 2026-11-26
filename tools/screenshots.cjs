#!/usr/bin/env node
'use strict';

// Run with Playwright installed (see docs/screenshots/README.md).
// Only fictional data is injected; no relay or external service is contacted.
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function seedScreenshot() {
  Object.assign(settings, {
    theme: 'dark', lightTheme: 'catppuccin', uploadBackend: 'litterbox',
    syncRead: false, syncCurrent: false, notify: false, typing: false,
  });
  S.connected = true;
  S.cfg = { host: 'relay.example.org', port: '443', tls: true };
  S.version = { weechat_version: '4.9.3', relay_api_version: '0.4.1' };
  S.cmdNames = Object.keys(CMD_HELP);
  nicklistWidth = 208;
  const names = ['FlashCode', 'trygveaa', 'nils_2', 'ada', 'boris', 'chloe',
    'dmitri', 'esme', 'farah', 'gus', 'hana', 'ivo', 'juno', 'kit', 'lars', 'sam'];
  const colors = [6, 13, 3, 6, 13, 2, 5, 4, 6, 3, 8, 2, 1, 7, 2, 4];
  const nicks = names.map((name, i) => ({
    id: String(i), name, visible: true, prefix: i < 2 ? '@' : i === 2 ? '+' : '',
    color: `\x1b[${(colors[i] < 8 ? 30 : 90) + colors[i] % 8}m`,
  }));
  const rows = [
    ['15:38', 'dmitri', 'Afternoon! Finally moved my WeeChat session to the home server.'],
    ['15:39', 'farah', 'Welcome to the always-connected club :)'],
    ['15:40', 'dmitri', 'Now I just need a relay so I can check in from my phone.'],
    ['15:41', 'chloe', 'The API relay is built in. Happy to help you set it up.'],
    ['15:42', 'boris', 'Anyone running the API relay behind Caddy?'],
    ['15:43', 'chloe', 'Yep! reverse_proxy /api* 127.0.0.1:9000 and you’re ready.'],
    ['15:43', 'chloe', 'One certificate for the page and the relay.'],
    ['15:44', 'boris', 'That did it, thanks!'],
    ['15:46', 'ada', 'Can I get hotlist updates over the relay without polling?'],
    ['15:47', 'trygveaa', 'ada: subscribe with sync and the relay pushes buffer and hotlist events.'],
    ['15:48', 'ada', 'Perfect. That makes the sidebar much simpler.'],
    ['15:50', 'esme', 'Just switched to Catppuccin Latte. The light theme looks lovely.'],
    ['15:51', 'farah', 'Is that the web client?'],
    ['15:52', 'esme', 'Yes, Weave. Same session on my laptop and phone.'],
    ['15:54', 'gus', 'The command palette is handy when I forget an option.'],
    ['15:55', 'nils_2', 'Ctrl+Shift+P, then Shift+Enter for the full /help.'],
    ['15:56', 'hana', 'sam: did you get the fset toolbar working on the iPad?', true],
    ['15:57', 'sam', 'Yes! Tap an option to select it, then tap again to edit.'],
    ['15:58', 'ivo', '/fset relay.network is a good place to try it.'],
    ['15:59', 'juno', 'Nice, that works here too. Thanks everyone!'],
  ];
  const lines = rows.map(([time, nick, message, highlight], i) => ({
    id: i + 1, date: `2026-11-26T${time}:00+01:00`,
    prefix: `${nicks.find(n => n.name === nick).color}${nick}\x1b[0m`,
    message, highlight: !!highlight, displayed: true,
    tags: ['irc_privmsg', `nick_${nick}`, ...(nick === 'sam' ? ['self_msg'] : [])],
  }));
  const buffers = [
    ['weechat', 'weechat', 'core', '', 'core'],
    ['irc.libera', 'libera', 'irc', 'libera', 'server'],
    ['irc.libera.#weechat', '#weechat', 'irc', 'libera', 'channel'],
    ['irc.libera.#rust', '#rust', 'irc', 'libera', 'channel', 4],
    ['irc.libera.#homelab', '#homelab', 'irc', 'libera', 'channel', 1, 1],
    ['irc.libera.chloe', 'chloe', 'irc', 'libera', 'private', 2, 2],
    ['irc.oftc', 'oftc', 'irc', 'oftc', 'server'],
    ['irc.oftc.#debian', '#debian', 'irc', 'oftc', 'channel', 2],
    ['irc.oftc.#tor', '#tor', 'irc', 'oftc', 'channel'],
  ];
  S.buffers.clear();
  buffers.forEach(([name, short_name, plugin, server, type, unread = 0, mentions = 0], i) => {
    const b = makeBuffer({
      id: String(i + 1), number: i + 1, name, short_name, type: 'formatted',
      nicklist: type === 'channel', modes: type === 'channel' ? '+nt' : '',
      title: 'WeeChat, the extensible chat client | https://weechat.org',
      local_variables: { plugin, server, type, nick: 'sam' },
      lines: type === 'channel' ? lines : [],
      nicklist_root: { nicks },
    });
    Object.assign(b, { lazy: false, nicksLoaded: true, unread, mentions });
    S.buffers.set(b.id, b);
  });
  S.active = '3';
  showScreen('chat');
  setConnStatus('ok', 'Connected', 'relay.example.org');
  renderAbout();
  applySettings();
  renderComposer();
}

async function main() {
  const files = { '/': ['index.html', 'text/html'], '/weave.js': ['weave.js', 'text/javascript'],
    '/weave.css': ['weave.css', 'text/css'] };
  const server = createServer(async (req, res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404).end(); return; }
    try { res.writeHead(200, { 'Content-Type': file[1] }).end(await readFile(path.join(root, file[0]))); }
    catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
      locale: 'en-GB', timezoneId: 'Europe/Stockholm', colorScheme: 'dark',
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', route => route.request().url().startsWith(origin + '/')
      ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-26T16:00:00+01:00'));
    await page.goto(origin);
    await page.evaluate(seedScreenshot);
    const capture = async name => {
      await page.evaluate(() => document.fonts.ready);
      // Allow responsive layout and any scheduled renders to settle.
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(root, 'docs/screenshots', `${name}.png`),
        animations: 'disabled', caret: 'hide' });
      console.log(`Captured ${name}.png`);
    };
    await capture('dark');
    await page.evaluate(() => { settings.theme = 'light'; applySettings(); });
    await capture('light');
    await page.evaluate(() => { settings.theme = 'dark'; applySettings(); openPalette(); });
    await capture('palette');
    await page.locator('#paletteDlg').evaluate(dialog => dialog.close());
    await page.locator('#btnSettings').click();
    await capture('settings');
    await page.locator('#settingsDlg [data-close]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { renderNicklist(); renderMessages(); });
    await capture('phone');
    await page.locator('#btnMenu').click();
    await capture('phone-drawer');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      closeDrawers();
      const rows = [
        ['*ia rN', 'autosort.py', '3.10', '3.11', 'Keep buffers grouped by server and sorted by name.'],
        ['*ia r ', 'go.py', '3.0.1', '3.0.1', 'Quick jump to buffers.'],
        ['*i    ', 'grep.py', '', '0.8.6', 'Search regular expressions in buffers or log files.'],
        [' iaHr ', 'urlserver.py', '3.1', '3.1', 'Collect links and shorten URLs.'],
        ['*     ', 'highmon.pl', '', '2.7', 'Adds a highlight monitor buffer.'],
        ['*     ', 'colorize_nicks.py', '', '32', 'Use WeeChat nick colours in the chat area.'],
        ['      ', 'buffers.pl', '', '5.6', 'Display a sidebar with the list of buffers.'],
        ['      ', 'buffer_autoset.py', '', '1.2', 'Automatically set properties on newly opened buffers.'],
      ];
      const b = makeBuffer({ id: 'screenshot-scripts', number: 10, name: 'script.scripts', short_name: 'scripts',
        type: 'free', title: 'Scripts: 8/8 | Filter: * | Sort: i,p,n | Input: words=filter, *=reset filter',
        local_variables: { plugin: 'script', type: 'script', filter: '*' },
        lines: rows.map(([status, name, loaded, available, description], y) => ({ id: y + 1, y,
          message: `${y === 0 ? '\x1b[44m' : ''}${status}  ${name.padEnd(21)} ${loaded.padStart(5)} ${available.padStart(5)}  | ${description}\x1b[0m` })),
      });
      S.buffers.set(b.id, b); S.active = b.id;
      renderSidebar(); renderHeader(); renderMessages(); renderNicklist(); renderComposer();
    });
    await capture('scripts');
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════════════════ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
const stripAnsi = s => String(s ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const STORE_PREFIX = 'weave.';
// This app was called Weave before; carry its saved settings over once.
try {
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith('weecli.')) continue;
    const nk = STORE_PREFIX + k.slice(7);
    if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k));
    localStorage.removeItem(k);
  }
} catch {}
const store = {
  get(k, d) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)); } catch {} },
  del(k)    { try { localStorage.removeItem(STORE_PREFIX + k); } catch {} },
};
// The remembered relay password. A host app can offer a safer place than
// localStorage by defining window.__weaveSecrets = { get, set, del, label }
// (async, keyed by "host:port"); the Mac app uses the Keychain.
const nativeSecrets = window.__weaveSecrets || null;
const secretKey = c => `${c.host}:${c.port || ''}`;
async function loadPassword(saved) {
  if (!saved?.host) return '';
  if (!nativeSecrets) return saved.password || '';
  if (saved.password) {   // saved before the host app had a keychain: move it there
    const pw = saved.password;
    try { await nativeSecrets.set(secretKey(saved), pw); delete saved.password; store.set('conn', saved); } catch {}
    return pw;
  }
  return saved.remember ? (await nativeSecrets.get(secretKey(saved)).catch(() => '')) || '' : '';
}

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  hash: '<path d="M5 9h14M4 15h14M10 3 8 21M16 3l-2 18"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  users: '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.5"/><path d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  kick: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  dot: '<circle cx="12" cy="12" r="2.5"/>',
  chevUp: '<path d="m6 15 6-6 6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  checks: '<path d="M2.5 12.5 7 17 16.5 7.5M11.5 16.5l.5.5 9.5-9.5"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6ZM12 15v5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 21h4"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  quote: '<path d="M10 7H6a2 2 0 0 0-2 2v3h5v5H4M20 7h-4a2 2 0 0 0-2 2v3h5v5h-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bellOff: '<path d="M6 16V11a6 6 0 0 1 .8-3M9 5.8A6 6 0 0 1 18 11v5l1.5 2H8M10 21h4M3 3l18 18"/>',
  tab: '<path d="M3 12h13M11 7l5 5-5 5M20 5v14"/>',
  clip: '<path d="m21.4 11.1-8.9 8.9a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/>',
  upload: '<path d="M12 16V4M6.5 9.5 12 4l5.5 5.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>',
};
const ico = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
// The mark: two strands woven into a W — [path, opacity], back strand first.
// Drawn on a 32×32 tile; also rendered to PNG for the app icons (drawAppIcon).
const LOGO_STRANDS = [['M14.86 10 20.75 22 25.5 10', 0.55], ['M6.5 10 11.25 22 17.14 10', 1]];
const LOGO_STROKE = 3;
const LOGO_SVG = '<rect width="32" height="32" rx="9" fill="var(--accent)"/>' + LOGO_STRANDS.map(([d, o]) =>
  `<path d="${d}" stroke="#fff" stroke-opacity="${o}" stroke-width="${LOGO_STROKE}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
function hydrateIcons(root = document) {
  $$('svg[data-i]', root).forEach(s => { s.setAttribute('viewBox', '0 0 24 24'); s.classList.add('i'); s.innerHTML = ICONS[s.dataset.i]; });
  $$('svg[data-logo]', root).forEach(s => { s.innerHTML = LOGO_SVG; });
}

function toast(text, { error = false, ms = 3800, title = '', onClick = null } = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (error ? ' err' : '') + (onClick ? ' clickable' : '');
  t.innerHTML = `<span class="dot ${error ? 'bad' : 'ok'}"></span><span class="toast-text">${title ? `<b>${esc(title)}</b><br>` : ''}${esc(text)}</span>` +
    `<button class="toast-x" type="button" title="Dismiss" aria-label="Dismiss">${ico('x')}</button>`;
  const remove = () => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 260); };
  t.querySelector('.toast-x').addEventListener('click', e => { e.stopPropagation(); t.remove(); });
  if (onClick) {
    t.setAttribute('role', 'button');
    t.tabIndex = 0;
    t.addEventListener('click', () => { onClick(); t.remove(); });
  }
  $('#toasts').appendChild(t);
  setTimeout(remove, ms);
  return t;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════════════════════════════════════ */
/* ─── Deployment defaults — edit for your install ───────────────────────── */
const CONFIG = {
  mode: 'personal',                          // 'personal' or 'public' (anyone connects to their own relay; see PUBLIC-HOSTING.md)
  uploadBackend: 'jirafeau',                 // 'jirafeau', 'litterbox', 'tmpfiles', 'filebin' or 'off'
  uploadUrl: 'https://files.interdo.me/',   // Jirafeau base URL
  uploadTime: 'day',                         // default expiry: minute, hour, day, week, fortnight, month, quarter, year, none
  downloadUrl: '',                           // public mode: link to a zip of the app, for self-hosting
  sourceUrl: '',                             // public mode: link to the source code
};
// Public mode: no upload default (nobody uploads to the host's server unless
// they pick a service themselves) and no guessed relay address.
const PUBLIC = CONFIG.mode === 'public';

// Colour themes per mode; the palettes are in weave.css ([data-palette]).
const THEMES = {
  dark: { weave: 'Weave', solarized: 'Solarized Dark', gruvbox: 'Gruvbox Dark', catppuccin: 'Catppuccin Mocha', nord: 'Nord',
    dracula: 'Dracula', monokai: 'Monokai', tokyonight: 'Tokyo Night', onedark: 'One Dark', glacier: 'Glacier' },
  light: { weave: 'Weave', solarized: 'Solarized Light', gruvbox: 'Gruvbox Light', catppuccin: 'Catppuccin Latte' },
};
// 'auto' uses the theme's own accent.
const ACCENTS = { indigo: '#6470f3', violet: '#8b5cf6', teal: '#119e9e', green: '#2f9e62', amber: '#d98a10', rose: '#e0527a', slate: '#64748b' };
const DEFAULTS = {
  theme: 'system', darkTheme: 'weave', lightTheme: 'weave', accent: 'auto', font: 'sans', fontSize: '14', density: 'comfortable', clock: '24',
  groupMessages: true, smartFilter: true, hideJoins: false, media: 'click', nicklist: true,
  notify: false, syncRead: true, syncCurrent: false, saveHistory: true,
  uploadBackend: PUBLIC ? 'off' : CONFIG.uploadBackend, litterboxTime: '24h', tmpfilesTime: '1h',
  uploadUrl: PUBLIC ? '' : CONFIG.uploadUrl, uploadTime: CONFIG.uploadTime, uploadPassword: '', uploadOneTime: false, uploadAction: 'insert',
};
const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
// Saved before themes existed: indigo was the default then, and is Weave's own
// theme accent now, so follow the theme instead.
if (!('darkTheme' in store.get('settings', {})) && settings.accent === 'indigo') settings.accent = 'auto';
const darkMQ = matchMedia('(prefers-color-scheme: dark)');

function effectiveMode() { return settings.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : settings.theme; }
function effectivePalette(mode) { const p = settings[mode + 'Theme']; return THEMES[mode][p] ? p : 'weave'; }
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Terminal themes make "black" (dark) or "white" (light) nearly the
// background colour. Nudge any of the 16 ANSI colours that would vanish, the
// same way as nick colours.
function fitAnsiPalette(root) {
  for (let i = 0; i < 16; i++) root.style.removeProperty('--a' + i);
  const cs = getComputedStyle(root);
  for (let i = 0; i < 16; i++) {
    const m = /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue('--a' + i).trim());
    if (!m) continue;
    const n = parseInt(m[1], 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
    const fit = fitToMode(rgb).map(Math.round);
    if (fit.some((v, k) => v !== rgb[k])) root.style.setProperty('--a' + i, `rgb(${fit.join(',')})`);
  }
}

function applySettings({ rerender = true } = {}) {
  // Note the message at the top before any setting changes the layout.
  const anchor = rerender && S.active ? captureScrollAnchor() : null;
  const root = document.documentElement;
  const mode = effectiveMode();
  const palette = effectivePalette(mode);
  const modeChanged = root.dataset.mode !== mode || (root.dataset.palette || 'weave') !== palette;
  root.dataset.mode = mode;
  if (palette === 'weave') delete root.dataset.palette; else root.dataset.palette = palette;
  root.dataset.font = settings.font;
  root.dataset.density = settings.density;
  if (ACCENTS[settings.accent]) {
    root.style.setProperty('--accent', ACCENTS[settings.accent]);
    root.style.setProperty('--on-accent', '#fff');
  } else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); }
  root.style.setProperty('--fs', settings.fontSize + 'px');
  if (modeChanged) fitAnsiPalette(root);
  $('meta[name=theme-color]').content = cssVar('--bg') || '#111318';
  $('#btnTheme').innerHTML = ico(mode === 'dark' ? 'sun' : 'moon');
  timeFmt = null;
  if (modeChanged) { colorCache.clear(); fgCache.clear(); }
  if (rerender && S.active) {
    renderMessages();
    restoreScrollAnchor(anchor);
    renderNicklist();
    renderHeader();
  }
  renderSidebar();
  updateFavicon();
  if (typeof renderComposer === 'function' && $('#btnAttach')) renderComposer();
}

function saveSettings() { store.set('settings', settings); }

/* ═══════════════════════════════════════════════════════════════════════════
   Colour handling — ANSI (as sent by the relay with colors=ansi) → HTML,
   with theme-aware contrast correction so every nick stays readable.
   ═══════════════════════════════════════════════════════════════════════════ */
const colorCache = new Map();
const CUBE = [0, 95, 135, 175, 215, 255];
function xterm256(n) {
  if (n >= 232) { const v = 8 + (n - 232) * 10; return [v, v, v]; }
  const i = n - 16;
  return [CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]];
}
function luminance([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
// Lighten a colour too dark for dark mode, or darken one too light for light mode.
function fitToMode([r, g, b]) {
  const dark = document.documentElement.dataset.mode === 'dark';
  for (let k = 0; k < 8; k++) {
    const L = luminance([r, g, b]);
    if (dark && L < 0.09) { r += (255 - r) * 0.22; g += (255 - g) * 0.22; b += (255 - b) * 0.22; }
    else if (!dark && L > 0.36) { r *= 0.82; g *= 0.82; b *= 0.82; }
    else break;
  }
  return [r, g, b];
}
function readableRgb(rgb) {
  const key = rgb.join(',');
  let v = colorCache.get(key);
  if (v) return v;
  const [r, g, b] = fitToMode(rgb);
  v = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  colorCache.set(key, v);
  return v;
}
function colorCss(c) {
  if (!c) return null;
  if (c.p != null) return `var(--a${c.p})`;
  return readableRgb(c.rgb);
}

// Parse ANSI SGR sequences into [{t:text, s:style}] segments.
function ansiSegments(str) {
  const out = [];
  const blank = () => ({ fg: null, bg: null, b: 0, d: 0, i: 0, u: 0, r: 0, s: 0 });
  let st = blank();
  const re = /\x1b\[([0-9;]*)([A-Za-z])/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ t: str.slice(last, m.index), s: st });
    last = re.lastIndex;
    if (m[2] !== 'm') continue;
    st = { ...st };
    const c = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (let k = 0; k < c.length; k++) {
      const n = c[k];
      if (n === 0) st = blank();
      else if (n === 1) st.b = 1;
      else if (n === 2) st.d = 1;
      else if (n === 3) st.i = 1;
      else if (n === 4) st.u = 1;
      else if (n === 7) st.r = 1;
      else if (n === 9) st.s = 1;
      else if (n === 22) { st.b = 0; st.d = 0; }
      else if (n === 23) st.i = 0;
      else if (n === 24) st.u = 0;
      else if (n === 27) st.r = 0;
      else if (n === 29) st.s = 0;
      else if (n >= 30 && n <= 37) st.fg = { p: n - 30 };
      else if (n >= 90 && n <= 97) st.fg = { p: n - 82 };
      else if (n === 39) st.fg = null;
      else if (n >= 40 && n <= 47) st.bg = { p: n - 40 };
      else if (n >= 100 && n <= 107) st.bg = { p: n - 92 };
      else if (n === 49) st.bg = null;
      else if ((n === 38 || n === 48) && c[k + 1] === 5) {
        const idx = c[k + 2] | 0;
        const col = idx < 16 ? { p: idx } : { rgb: xterm256(idx) };
        if (n === 38) st.fg = col; else st.bg = col;
        k += 2;
      } else if ((n === 38 || n === 48) && c[k + 1] === 2) {
        const col = { rgb: [c[k + 2] | 0, c[k + 3] | 0, c[k + 4] | 0] };
        if (n === 38) st.fg = col; else st.bg = col;
        k += 4;
      }
    }
  }
  if (last < str.length) out.push({ t: str.slice(last), s: st });
  return out;
}

// First foreground colour found in an ANSI string (used for nick colours).
const fgCache = new Map();   // ANSI colour string → CSS (cleared on theme change)
function ansiFg(str) {
  if (!str) return null;
  if (fgCache.has(str)) return fgCache.get(str);
  let css = null;
  for (const seg of ansiSegments(str + '​')) if (seg.s.fg) { css = colorCss(seg.s.fg); break; }
  fgCache.set(str, css);
  return css;
}

// No lookbehind here: Safari < 16.4 rejects it and the whole script would fail.
const URL_RE = /(\bhttps?:\/\/[^\s<>"'`]+)|(^|[\s(,])(#[^\s,:<>"'`()]*[A-Za-z][^\s,:<>"'`()]*)/g;
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#].*)?$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i;

function trimUrl(u) {
  // Drop trailing punctuation, keeping balanced parentheses (Wikipedia-style URLs).
  while (/[.,;:!?'"\]]$/.test(u) || (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length)) u = u.slice(0, -1);
  return u;
}

function linkify(text) {
  let html = '', last = 0, m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m[1]) {
      const url = trimUrl(m[1]);
      html += esc(text.slice(last, m.index));
      html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
      const kind = IMG_RE.test(url) ? 'img' : VID_RE.test(url) ? 'vid' : null;
      if (kind && settings.media === 'auto') html += mediaHtml(url, kind);
      else if (kind && settings.media === 'click') html += `<button class="media-btn" type="button" data-src="${esc(url)}" data-kind="${kind}">${ico('image')}${kind === 'img' ? 'Image' : 'Video'}</button>`;
      last = m.index + url.length;
      URL_RE.lastIndex = last;
    } else {
      html += esc(text.slice(last, m.index) + m[2]);
      html += `<span class="chan-link" data-chan="${esc(m[3])}">${esc(m[3])}</span>`;
      last = m.index + m[2].length + m[3].length;
    }
  }
  return html + esc(text.slice(last));
}
function mediaHtml(url, kind) {
  return kind === 'img'
    ? `<span class="media"><img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-full="${esc(url)}"></span>`
    : `<span class="media"><video src="${esc(url)}" controls preload="metadata"></video></span>`;
}

function renderAnsi(str, { links = true } = {}) {
  if (!str) return '';
  let html = '';
  for (const { t, s } of ansiSegments(str)) {
    if (!t) continue;
    const inner = links ? linkify(t) : esc(t);
    let fg = s.fg, bg = s.bg;
    if (s.r) { fg = bg || { p: 15 }; bg = s.fg || { p: 0 }; }
    const style = [], cls = [];
    if (fg) style.push('color:' + colorCss(fg));
    if (bg) style.push('background:' + (bg.p != null ? `color-mix(in srgb,var(--a${bg.p}) 35%,transparent)` : colorCss(bg)), 'border-radius:3px');
    if (s.b) cls.push('a-b');
    if (s.d) cls.push('a-d');
    if (s.i) cls.push('a-i');
    if (s.u) cls.push('a-u');
    if (s.s) cls.push('a-s');
    html += (style.length || cls.length)
      ? `<span${cls.length ? ` class="${cls.join(' ')}"` : ''}${style.length ? ` style="${style.join(';')}"` : ''}>${inner}</span>`
      : inner;
  }
  return html;
}

// Nick colours as WeeChat paints them in chat, learned from line prefixes
// (the nicklist itself usually just uses the bar's default colour).
const nickColors = new Map();
function learnNickColor(nick, prefix) {
  if (!nick || !prefix) return;
  const segs = ansiSegments(prefix);
  const last = segs[segs.length - 1];
  if (last?.s.fg) nickColors.set(nick, last.s.fg);
}
function nickCss(nick, ansi) {
  return (ansi && ansiFg(ansi)) || (nickColors.has(nick) ? colorCss(nickColors.get(nick)) : null);
}

// Deterministic avatar colour from a name.
function hueColor(name) {
  let h = 0;
  for (const ch of String(name).toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 55% ${document.documentElement.dataset.mode === 'dark' ? 48 : 52}%)`;
}
function avatar(name, color) {
  const ch = ([...String(name).replace(/^[^\p{L}\p{N}]+/u, '')][0] || '?');
  return `<span class="avatar" style="background:${color || hueColor(name)}">${esc(ch)}</span>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════════════ */
const PREVIEW_LINES = 30;   // per buffer at startup; the rest loads when a buffer is first opened
const INIT_LINES = 200;     // lines fetched when a buffer is first opened
const MORE_LINES = 300;     // extra lines per "load older" from the relay
const MAX_LINES = 4000;     // in-memory cap per buffer
const RENDER_WINDOW = 500;  // messages rendered at once; scrolling up reveals more
// Input lines that may carry secrets are never written to localStorage.
const SECRET_RES = [
  /^\/(?:msg|m|query|q|notice|quote)\s+(?:-\S+\s+\S+\s+)*(?:nickserv|ns|chanserv|cs|operserv|os|memoserv|hostserv|q@cserve\S*|x@\S*)\b/i,
  /^\/(?:ns|nickserv|cs|chanserv|os|operserv|ms|memoserv|hs|hostserv)\b/i,
  /^\/(?:secure|oper|pass)\b/i,
  /^\/quote\s+(?:-\S+\s+\S+\s+)*(?:pass|oper|authenticate)\b/i,
  /^\/(?:j|join)\s+(?:-\S+\s+\S+\s+)*\S+\s+\S/i,   // channel key
  /^\/(?:set|server|connect|relay|trigger|alias)\b.*(?:pass|sasl|secret|key|token)/i,   // no \b: matches sasl_password
  /\bidentify\b/i,
];
const isSecret = line => SECRET_RES.some(re => re.test(line.trim()));
// Unsent drafts survive reloads (keyed by buffer name); secrets aren't saved.
const drafts = store.get('drafts', {});
let draftTimer = 0;
function saveDraft(b, text) {
  if (!b) return;
  b.draft = text;
  if (text.trim() && !isSecret(text)) drafts[b.name] = text.slice(0, 5000); else delete drafts[b.name];
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const names = Object.keys(drafts);
    for (const n of names.slice(0, Math.max(0, names.length - 100))) delete drafts[n];
    store.set('drafts', drafts);
  }, 400);
}

function loadHistory() {
  if (!settings.saveHistory) return [];
  const h = store.get('history', []);
  return Array.isArray(h) ? h.filter(x => typeof x === 'string' && !isSecret(x)) : [];
}

const S = {
  ws: null, cfg: null, connected: false, everConnected: false, userClosed: false,
  seq: 0, pending: new Map(),
  buffers: new Map(),         // id(string) → buffer
  active: null,               // active buffer id
  version: null,
  reconnectTimer: null, reconnectDelay: 1000, reconnectAt: 0, countdown: null,
  pingTimer: null, pinging: false, connectTimer: null,
  connecting: false, failures: 0, forcePlain: false,
  pinned: true, newCount: 0,
  ctx: null,                  // render context for incremental appends
  awayMarker: false,
  pendingSwitch: null, restore: null, overlayPushed: false, search: null, keySeq: null, fsetSelY: null,
  drag: null, sidebarPending: false, suppressClick: false, longPressAt: 0, closeConfirm: null, closeConfirmTimer: 0, nlDirty: false,
  history: loadHistory(), histPos: -1, histDraft: '',
  confirmPaste: null,
  comp: null,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Connection & protocol
   ═══════════════════════════════════════════════════════════════════════════ */
// JSON.parse would round integers above 2^53 — quote long numeric ids first.
const BIG_ID_RE = /"([A-Za-z_]*id)":(-?\d{16,})(?:\.0+)?(?=[,}\]])/g;

function b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Standard base64 of UTF-8 text (btoa alone throws on non-Latin-1 passwords).
function b64(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

function relayUrls(cfg) {
  const host = cfg.host.includes(':') && !cfg.host.startsWith('[') ? `[${cfg.host}]` : cfg.host;
  let path = (cfg.path || '/api').trim();
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/\/+$/, '');
  const port = cfg.port ? ':' + cfg.port : '';
  return {
    ws: `${cfg.tls ? 'wss' : 'ws'}://${host}${port}${path}`,
    http: `${cfg.tls ? 'https' : 'http'}://${host}${port}${path}`,
  };
}

// Build the credential string. With "auto", ask the relay which hash it wants
// (POST /api/handshake needs no auth) and hash locally so the password itself
// never crosses the wire. `forcePlain` skips hashing (clock-drift fallback).
async function buildCredentials(cfg, httpBase, forcePlain = false) {
  const plain = 'plain:' + cfg.password;
  if (forcePlain || cfg.auth === 'plain' || !globalThis.crypto?.subtle) return plain;
  let hs;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(httpBase + '/handshake', {
      method: 'POST', signal: ctl.signal,
      body: JSON.stringify({ password_hash_algo: ['pbkdf2+sha512', 'pbkdf2+sha256', 'sha512', 'sha256', 'plain'] }),
    });
    clearTimeout(t);
    if (!res.ok) return plain;
    hs = await res.json();
  } catch { return plain; }   // handshake unreachable (proxy, CORS, cert) — fall back
  const algo = hs.password_hash_algo;
  if (!algo) throw new Error('The relay does not accept any password hash algorithm this client supports.');
  if (algo === 'plain') return plain;
  const salt = String(Math.floor(Date.now() / 1000));
  const enc = new TextEncoder();
  const sha = algo.endsWith('sha512') ? 'SHA-512' : 'SHA-256';
  if (algo.startsWith('pbkdf2')) {
    const iters = hs.password_hash_iterations || 100000;
    const key = await crypto.subtle.importKey('raw', enc.encode(cfg.password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: sha, salt: enc.encode(salt), iterations: iters }, key, sha === 'SHA-512' ? 512 : 256);
    return `hash:${algo}:${salt}:${iters}:${hex(bits)}`;
  }
  const digest = await crypto.subtle.digest(sha, enc.encode(salt + cfg.password));
  return `hash:${algo}:${salt}:${hex(digest)}`;
}

// A failed WebSocket upgrade tells the page nothing about why. Ask the relay
// over HTTP with fresh credentials instead: its 401 body says whether the
// password or the timestamp (i.e. the device clock) was rejected.
async function probeRelay(cfg, urls, forcePlain) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const creds = await buildCredentials(cfg, urls.http, forcePlain);
    const res = await fetch(urls.http + '/version', { headers: { Authorization: 'Basic ' + b64(creds) }, signal: ctl.signal, cache: 'no-store' });
    if (res.ok) return { reachable: true, ok: true };
    let error = '';
    try { error = (await res.json()).error || ''; } catch {}
    return { reachable: true, ok: false, status: res.status, error };
  } catch { return { reachable: false }; }
  finally { clearTimeout(t); }
}

function loginRejectedHtml(probe, cfg) {
  if (probe.status !== 401) return null;
  if (/timestamp/i.test(probe.error)) {
    return 'The relay rejected the login time. Hashed passwords are salted with your device clock, which must be within ' +
      '<code>relay.network.time_window</code> seconds (default 5) of the relay\'s clock. Correct the clock on this device' +
      (cfg.tls ? ', or set <b>Authentication</b> to <b>Plain password</b> under Advanced.' : '. (Falling back to a plain password is only done automatically over TLS.)');
  }
  if (/password/i.test(probe.error)) return 'Wrong relay password.';
  return 'The relay rejected the login' + (probe.error ? ': ' + esc(probe.error) : '.');
}

function unreachableHtml(cfg, urls, probe) {
  if (location.protocol === 'https:' && !cfg.tls) return 'This page is served over HTTPS, so the browser blocks unencrypted <code>ws://</code> connections. Enable TLS on the relay (<code>/relay add tls.api …</code>) or serve Weave over plain HTTP.';
  if (probe.reachable && probe.status === 404) {
    return `The server at <code>${esc(urls.http)}</code> answered, but there's no WeeChat API at that path (404). Check the <b>API path</b> under Advanced. ` +
      'If a reverse proxy sits in front of WeeChat, make sure it forwards the path unchanged: WeeChat only accepts its WebSocket at exactly <code>/api</code>. ' +
      'Tailscale Serve, for example, strips a <code>--set-path</code> prefix, so mount the relay at <code>/</code> instead (see the README).';
  }
  if (probe.reachable && !probe.ok && probe.status >= 500) {
    return `The server at <code>${esc(urls.http)}</code> answered with an error (HTTP ${probe.status}), so a proxy in front of WeeChat couldn't reach it. Check the proxy's target: it should be WeeChat's plain <code>api</code> port (not <code>tls.api</code>), and <code>relay.network.allowed_ips</code> must allow the proxy's address (usually 127.0.0.1).`;
  }
  if (probe.ok && PUBLIC) return `The relay accepted the password but refused the WebSocket connection. Most likely it doesn't allow this page's address yet; run this in WeeChat:<br><code>${esc($('#originCmd').textContent)}</code><br>Otherwise, if a reverse proxy sits in front of it, make sure it forwards the <code>Upgrade</code> and <code>Connection</code> headers, and check <code>relay.network.max_clients</code>.`;
  if (probe.ok) return 'The relay accepted the password but refused the WebSocket connection. If a reverse proxy sits in front of it, make sure it forwards the <code>Upgrade</code> and <code>Connection</code> headers. Also check <code>relay.network.websocket_allowed_origins</code> and <code>relay.network.max_clients</code>.';
  let msg = `Could not reach the relay at <code>${esc(urls.ws)}</code>. Check the host and port, and that an <b>api</b> relay is listening (<code>/relay listrelay</code>).`;
  msg += hostHint(cfg.host);
  if (cfg.tls) msg += ` If it uses a self-signed certificate, <a href="${esc(urls.http)}/version" target="_blank" rel="noopener">open it in a new tab</a>, accept the warning, then try again.`;
  return msg;
}

// Name-resolution pitfalls that make a relay reachable from one device but
// not another (typically: works on the PC, fails on the phone).
function hostHint(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
  const pageIsLocal = /^(localhost|127\.|\[?::1)/.test(location.hostname);
  if ((h === 'localhost' || h.startsWith('127.') || h === '::1') && !pageIsLocal) {
    return ` <b>${esc(host)}</b> means "this device", so on a phone it points at the phone itself. Use the relay machine's name or IP address instead.`;
  }
  if (h.endsWith('.ts.net')) {
    return ' Tailscale names only resolve when this device uses Tailscale\'s DNS (MagicDNS). Android\'s "Private DNS" or the browser\'s "Use secure DNS" setting bypasses it; try the machine\'s 100.x.x.x Tailscale IP instead.';
  }
  if (!isIp && !h.includes('.')) {
    return ` A short name like <b>${esc(host)}</b> may resolve on one device but not another (phones especially). Try the full name or the IP address.`;
  }
  return '';
}

async function connect(cfg, { forcePlain = S.forcePlain } = {}) {
  clearTimeout(S.reconnectTimer);
  clearInterval(S.countdown);
  S.cfg = cfg;
  S.userClosed = false;
  S.connecting = true;
  setConnStatus('busy', S.everConnected ? 'Reconnecting…' : 'Connecting…');
  const urls = relayUrls(cfg);
  let creds;
  try { creds = await buildCredentials(cfg, urls.http, forcePlain); }
  catch (e) { S.connecting = false; return connectFailed(esc(e.message)); }
  if (S.userClosed) { S.connecting = false; return; }   // disconnected while hashing

  let ws;
  try {
    ws = new WebSocket(urls.ws, ['api.weechat', 'base64url.bearer.authorization.weechat.' + b64url(creds)]);
  } catch (e) { S.connecting = false; return connectFailed(esc('Could not open WebSocket: ' + e.message)); }
  S.ws = ws;
  let opened = false;
  clearTimeout(S.connectTimer);
  S.connectTimer = setTimeout(() => { if (!opened && S.ws === ws) dropConnection(); }, 12000);

  ws.onopen = () => {
    if (S.ws !== ws) return;
    opened = true;
    clearTimeout(S.connectTimer);
    S.connecting = false;
    S.connected = true;
    S.reconnectDelay = 1000;
    S.failures = 0;
    if (forcePlain && !S.forcePlain && cfg.auth !== 'plain') {
      S.forcePlain = true;
      toast('Your device clock looks wrong, so hashed login was rejected. Signed in with the plain password over TLS instead.', { ms: 9000 });
    }
    onConnected();
  };
  ws.onmessage = e => {
    if (S.ws !== ws) return;
    let data;
    try { data = JSON.parse(e.data.replace(BIG_ID_RE, '"$1":"$2"')); } catch { return; }
    if (Array.isArray(data)) data.forEach(handleMessage); else handleMessage(data);
  };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    clearTimeout(S.connectTimer);
    S.ws = null;
    S.connecting = false;
    const wasConnected = S.connected;
    S.connected = false;
    stopHeartbeat();
    rejectPending();
    if (S.userClosed) return;
    if (opened) {
      if (wasConnected) toast('Connection to relay lost', { error: true });
      scheduleReconnect();
    } else {
      handleConnectFailure(cfg, urls, { hashed: creds.startsWith('hash:'), forcePlain });
    }
  };
}

async function handleConnectFailure(cfg, urls, { hashed, forcePlain }) {
  const probe = await probeRelay(cfg, urls, forcePlain);
  if (S.userClosed || S.ws || S.connecting) return;   // superseded while probing
  // Clock drift: over TLS it's safe to retry once with the plain password.
  if (probe.status === 401 && /timestamp/i.test(probe.error) && hashed && cfg.tls && cfg.auth === 'auto' && !forcePlain) {
    return connect(cfg, { forcePlain: true });
  }
  const rejected = loginRejectedHtml(probe, cfg);
  if (rejected) return backToLogin(rejected);   // retrying can't fix a bad login
  if (!S.everConnected) return connectFailed(unreachableHtml(cfg, urls, probe));
  S.failures++;
  scheduleReconnect();
}

function connectFailed(html) {
  setConnStatus('bad', 'Offline');
  showScreen('connect');
  setConnecting(false);
  const box = $('#cError');
  box.innerHTML = html;
  box.hidden = false;
}

const STUCK_AFTER = 5;   // failed reconnects before we say so and offer the login screen
function scheduleReconnect() {
  clearTimeout(S.reconnectTimer);
  clearInterval(S.countdown);
  const delay = S.reconnectDelay * (0.8 + Math.random() * 0.4);
  S.reconnectDelay = Math.min(S.reconnectDelay * 2, 30000);
  S.reconnectAt = Date.now() + delay;
  const stuck = S.failures >= STUCK_AFTER;
  const tick = () => {
    const secs = Math.max(0, Math.ceil((S.reconnectAt - Date.now()) / 1000));
    setConnStatus(stuck ? 'bad' : 'busy', stuck ? 'Unreachable' : 'Reconnecting…', `retry in ${secs}s`);
    showBanner(stuck ? `Still can't reach the relay — retrying in ${secs}s` : `Connection lost — reconnecting in ${secs}s`, { login: stuck });
  };
  tick();
  S.countdown = setInterval(tick, 1000);
  S.reconnectTimer = setTimeout(() => { clearInterval(S.countdown); showBanner('Reconnecting…', { login: stuck }); connect(S.cfg); }, delay);
}

function reconnectNow() {
  if (S.connected || S.connecting || S.ws || !S.cfg) return;
  clearTimeout(S.reconnectTimer);
  clearInterval(S.countdown);
  showBanner('Reconnecting…', { login: S.failures >= STUCK_AFTER });
  connect(S.cfg);
}

// Called when the tab comes back or the network changes: a sleeping device
// often has a dead socket the browser hasn't noticed yet.
function checkConnection() {
  if (S.connected) checkAlive(5000);
  else if (S.everConnected && !S.userClosed && S.cfg) reconnectNow();
}

/* ─── Heartbeat ────────────────────────────────────────────────────────── */
const PING_EVERY = 30000, PING_TIMEOUT = 10000;
function startHeartbeat() {
  stopHeartbeat();
  S.pingTimer = setInterval(() => checkAlive(PING_TIMEOUT), PING_EVERY);
}
function stopHeartbeat() { clearInterval(S.pingTimer); S.pingTimer = null; S.pinging = false; }
function checkAlive(timeout) {
  const ws = S.ws;
  if (!S.connected || !ws || S.pinging) return;
  S.pinging = true;
  request('POST', '/api/ping', { data: 'keepalive' }, timeout)
    .catch(() => { if (S.ws === ws) dropConnection(); })
    .finally(() => { if (S.ws === ws) S.pinging = false; });
}
// Handle the socket as closed right away: on a dead network the browser can
// take minutes to fire the close event.
function dropConnection() {
  const ws = S.ws;
  if (!ws) return;
  ws.onclose();
  try { ws.close(); } catch {}
}

function rejectPending() {
  for (const [, p] of S.pending) { clearTimeout(p.timer); p.reject(new Error('Disconnected')); }
  S.pending.clear();
}

function teardown() {
  S.userClosed = true;
  S.everConnected = false;
  S.connecting = false;
  S.failures = 0;
  clearTimeout(S.reconnectTimer);
  clearInterval(S.countdown);
  clearTimeout(S.connectTimer);
  stopHeartbeat();
  if (S.ws) { const ws = S.ws; S.ws = null; try { ws.close(1000); } catch {} }
  S.connected = false;
  rejectPending();
  S.buffers.clear();
  S.active = null;
  showBanner(null);
  closeDrawers();
  document.title = 'Weave';
  updateFavicon();
}

// Back to the login form, keeping what's typed there; optionally with an error.
function backToLogin(html) {
  teardown();
  if (html) connectFailed(html);
  else { setConnStatus('', 'Offline'); showScreen('connect'); setConnecting(false); }
  $('#cPass').focus();
  $('#cPass').select();
}

function disconnect() {
  teardown();
  const c = store.get('conn', {});
  c.auto = false;
  store.set('conn', c);
  $('#cAuto').checked = false;
  setConnStatus('', 'Offline');
  showScreen('connect');
  setConnecting(false);
}

function send(obj) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) { S.ws.send(JSON.stringify(obj)); return true; }
  return false;
}

function request(method, path, body, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const id = 'r' + (++S.seq);
    const msg = { request: `${method} ${path}`, request_id: id };
    if (body !== undefined) msg.body = body;
    if (!send(msg)) return reject(new Error('Not connected'));
    const timer = setTimeout(() => { S.pending.delete(id); reject(new Error('Request timed out')); }, timeout);
    S.pending.set(id, { resolve, reject, timer });
  });
}

function sendInput(buf, command) {
  return request('POST', '/api/input', { buffer_name: buf.name, command }).catch(e => toast(e.message || 'Command failed', { error: true }));
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.request_id && S.pending.has(msg.request_id)) {
    const p = S.pending.get(msg.request_id);
    S.pending.delete(msg.request_id);
    clearTimeout(p.timer);
    if (msg.code >= 400) p.reject(Object.assign(new Error(msg.body?.error || msg.message || 'Error ' + msg.code), { msg }));
    else p.resolve(msg);
    return;
  }
  if (msg.code === 0 && msg.event_name) handleEvent(msg);
}

function onConnected() {
  const first = !S.everConnected;
  S.quitting = false;
  S.everConnected = true;
  S.cmdNames = null;   // the relay's command list (palette), fetched again on first use
  const cfg = S.cfg;
  const saved = { host: cfg.host, port: cfg.port, tls: cfg.tls, path: cfg.path, auth: cfg.auth, remember: cfg.remember, auto: cfg.auto };
  if (!nativeSecrets) { if (cfg.remember) saved.password = cfg.password; }
  else if (cfg.remember) nativeSecrets.set(secretKey(cfg), cfg.password).catch(() => toast('Could not save the password in the Keychain', { error: true }));
  else nativeSecrets.del(secretKey(cfg)).catch(() => {});
  store.set('conn', saved);
  setConnecting(false);
  showBanner(null);
  if (!first) toast('Reconnected');
  setConnStatus('ok', 'Connected', `${cfg.host}${cfg.port ? ':' + cfg.port : ''}`);

  // Sent back-to-back: the relay answers in order, so the buffer list is in
  // place before any sync event can arrive.
  request('GET', '/api/version').then(r => { S.version = r.body; renderAbout(); }).catch(() => {});
  // Only a short preview per buffer and no member lists: a buffer's history
  // and members load when it's first opened (ensureLoaded), which keeps
  // startup light for accounts with many or very large channels.
  request('GET', `/api/buffers?lines=-${PREVIEW_LINES}&nicks=false&colors=ansi`).then(r => onBuffersLoaded(r.body || [])).catch(e => toast('Failed to load buffers: ' + e.message, { error: true }));
  request('GET', '/api/hotlist').then(r => applyHotlist(r.body || [])).catch(() => {});
  request('POST', '/api/sync', { sync: true, nicks: true, input: false, colors: 'ansi' }).catch(() => {});

  startHeartbeat();
}

/* ─── Buffers ──────────────────────────────────────────────────────────── */
function makeBuffer(raw, prev) {
  const id = String(raw.id);
  const b = {
    id, lines: [], nicks: new Map(), nicksLoaded: false, unread: 0, mentions: 0,
    lastReadId: null, draft: '', filterOverride: null,
    fetched: 0, hasMore: false, loadingMore: false, renderCount: RENDER_WINDOW, renderStart: 0,
    lazy: true, loading: null,
  };
  updateBufferFields(b, raw);
  if (Array.isArray(raw.lines)) {
    b.lines = raw.lines;
    b.fetched = raw.lines.length;
  }
  // Free-content buffers (fset, script…) always arrive complete.
  if (b.type === 'free') b.lazy = false;
  if (raw.nicklist_root) { collectNicks(raw.nicklist_root, b.nicks); b.nicksLoaded = true; }
  if (!b.nicklist) b.nicksLoaded = true;
  const lr = raw.last_read_line_id;
  b.lastReadId = lr != null && lr >= 0 ? Number(lr) : null;
  b.draft = drafts[b.name] || '';
  if (prev) { b.draft = prev.draft; b.filterOverride = prev.filterOverride; if (prev.lastReadId != null) b.lastReadId = prev.lastReadId; }
  return b;
}

function updateBufferFields(b, raw) {
  for (const k of ['name', 'short_name', 'number', 'type', 'hidden', 'title', 'modes', 'nicklist', 'input_multiline', 'local_variables', 'keys']) {
    if (raw[k] !== undefined) b[k] = raw[k];
  }
  b.lv = b.local_variables || {};
}

function collectNicks(group, map) {
  if (!group) return;
  for (const n of group.nicks || []) map.set(String(n.id), n);
  for (const g of group.groups || []) collectNicks(g, map);
}

// Load a buffer's real history and member list the first time it's opened.
// Lines that arrived through sync in the meantime are kept.
function ensureLoaded(b) {
  if (!b.lazy) return Promise.resolve();
  if (b.loading) return b.loading;
  b.loading = request('GET', `/api/buffers/${b.id}?lines=-${INIT_LINES}&nicks=true&colors=ansi`).then(r => {
    const raw = r.body;
    if (!raw || S.buffers.get(b.id) !== b) return;
    updateBufferFields(b, raw);
    const got = Array.isArray(raw.lines) ? raw.lines : [];
    const newest = got.length ? got[got.length - 1].id : -1;
    b.lines = got.concat(b.lines.filter(l => l.id > newest));
    b.fetched = INIT_LINES;
    b.hasMore = got.length >= INIT_LINES;
    b.nicks = new Map();
    if (raw.nicklist_root) collectNicks(raw.nicklist_root, b.nicks);
    b.nicksLoaded = true;
    b.lazy = false;
    if (b.id === S.active) {
      refreshSearchHits(b);
      const box = $('#msgs');
      const pinned = S.pinned, fromBottom = box.scrollHeight - box.scrollTop;
      renderMessages();
      if (!pinned) { box.scrollTop = box.scrollHeight - fromBottom; S.pinned = false; updateJump(); }
      renderNicklist();
      renderHeader();
    }
  }).catch(() => {}).finally(() => { b.loading = null; });
  return b.loading;
}

function onBuffersLoaded(list) {
  const prevByName = new Map([...S.buffers.values()].map(b => [b.name, b]));
  const prevActive = S.active && S.buffers.get(S.active)?.name;
  S.buffers.clear();
  for (const raw of list) {
    const b = makeBuffer(raw, prevByName.get(raw.name));
    S.buffers.set(b.id, b);
  }
  showScreen('chat');
  const wanted = prevActive || store.get('lastBuffer', null);
  const target = [...S.buffers.values()].find(b => b.name === wanted)
    || [...S.buffers.values()].find(b => b.lv.type === 'channel')
    || S.buffers.values().next().value;
  S.active = null;
  renderSidebar();
  if (target) activate(target.id, { force: true });
  else renderEmpty();
  // After a WeeChat restart the previous buffer may only reappear once IRC
  // rejoins — go back to it then, unless the user has moved on.
  S.restore = wanted && target?.name !== wanted ? { name: wanted, from: S.active, until: Date.now() + 60000 } : null;
}

function applyHotlist(list) {
  for (const h of list) {
    const b = S.buffers.get(String(h.buffer_id));
    if (!b || b.id === S.active) continue;
    const [, msg = 0, priv = 0, hl = 0] = h.count || [];
    const lvl = notifyLevel(b);
    b.unread = lvl === 'none' ? 0 : lvl === 'mentions' ? priv + hl : msg + priv + hl;
    b.mentions = lvl === 'none' ? 0 : priv + hl;
  }
  renderSidebar();
  updateTitle();
}

function isVisibleLine(b, l) {
  if (l.displayed === false) return false;
  const tags = l.tags || [];
  if (settings.hideJoins && tags.some(t => t === 'irc_join' || t === 'irc_part' || t === 'irc_quit')) return false;
  const smart = b.filterOverride ?? settings.smartFilter;
  if (smart && tags.includes('irc_smart_filter')) return false;
  return true;
}

function handleEvent(msg) {
  // Once WeeChat announces /quit it tears everything down; keep the last good
  // view until we reconnect and reload.
  if (S.quitting) return;
  const bid = msg.buffer_id != null ? String(msg.buffer_id) : null;
  const body = msg.body;
  switch (msg.event_name) {
    case 'buffer_opened': {
      if (!body) return;
      const b = makeBuffer(body);
      S.buffers.set(b.id, b);
      renderSidebar();
      maybeAutoSwitch(b);
      if (!S.active) activate(b.id);
      break;
    }
    case 'buffer_closed': {
      const b = S.buffers.get(bid);
      if (!b) return;
      const order = sidebarOrder();
      const idx = order.findIndex(x => x.id === bid);
      S.buffers.delete(bid);
      if (S.active === bid) {
        const next = order[idx - 1] || order[idx + 1];
        S.active = null;
        if (next && next.id !== bid) activate(next.id); else renderEmpty();
      }
      renderSidebar();
      updateTitle();
      break;
    }
    case 'buffer_type_changed': case 'buffer_moved': case 'buffer_merged': case 'buffer_unmerged':
    case 'buffer_hidden': case 'buffer_unhidden': case 'buffer_renamed': case 'buffer_title_changed':
    case 'buffer_localvar_added': case 'buffer_localvar_changed': case 'buffer_localvar_removed':
    case 'buffer_time_for_each_line_changed': case 'buffer_prefix_for_each_line_changed': {
      const b = S.buffers.get(bid || String(body?.id));
      if (!b || !body) return;
      updateBufferFields(b, body);
      renderSidebar();
      if (b.id === S.active) { renderHeader(); renderComposer(); }
      break;
    }
    case 'buffer_cleared': {
      const b = S.buffers.get(bid);
      if (!b) return;
      b.lines = []; b.hasMore = false;
      if (b.id === S.active) renderMessages();
      break;
    }
    case 'buffer_line_added': onLineAdded(bid, body); break;
    case 'buffer_line_data_changed': {
      const b = S.buffers.get(bid);
      if (!b || !body) return;
      const i = b.type === 'free' ? b.lines.findIndex(l => l.y === body.y) : b.lines.findIndex(l => l.id === body.id);
      if (i >= 0) b.lines[i] = body;
      if (b.id === S.active) scheduleRerender();
      break;
    }
    case 'nicklist_nick_added': case 'nicklist_nick_changed': {
      const b = S.buffers.get(bid);
      if (!b || !body || !b.nicksLoaded) return;   // members not loaded yet: fetched fresh on open
      b.nicks.set(String(body.id), body);
      if (b.id === S.active) scheduleNicklist();
      break;
    }
    case 'nicklist_nick_removing': {
      const b = S.buffers.get(bid);
      if (!b || !body || !b.nicksLoaded) return;   // members not loaded yet: fetched fresh on open
      b.nicks.delete(String(body.id));
      if (b.id === S.active) scheduleNicklist();
      break;
    }
    case 'nicklist_group_removing': {
      const b = S.buffers.get(bid);
      if (!b || !body || !b.nicksLoaded) return;   // members not loaded yet: fetched fresh on open
      const gid = String(body.id);
      for (const [k, n] of b.nicks) if (String(n.parent_group_id) === gid) b.nicks.delete(k);
      if (b.id === S.active) scheduleNicklist();
      break;
    }
    case 'upgrade': toast('WeeChat is upgrading…'); break;
    case 'upgrade_ended':
      toast('WeeChat upgrade complete');
      request('GET', `/api/buffers?lines=-${PREVIEW_LINES}&nicks=false&colors=ansi`).then(r => onBuffersLoaded(r.body || [])).catch(() => {});
      break;
    case 'quit': S.quitting = true; toast('WeeChat is quitting', { error: true }); break;
  }
}

function onLineAdded(bid, line) {
  const b = S.buffers.get(bid);
  if (!b || !line) return;
  if (b.type === 'free') {
    const i = b.lines.findIndex(l => l.y === line.y);
    if (i >= 0) b.lines[i] = line; else b.lines.push(line);
    if (b.id === S.active) scheduleRerender();
    return;
  }
  b.lines.push(line);
  if (b.lines.length > MAX_LINES) { b.lines.splice(0, b.lines.length - MAX_LINES); b.hasMore = true; }
  const isActive = b.id === S.active;
  const seen = isActive && !document.hidden;
  const visible = line.displayed !== false;
  const tags = line.tags || [];
  const self = tags.includes('self_msg');
  const lvl = notifyLevel(b);
  const mention = visible && !self && lvl !== 'none' && (line.highlight || line.notify_level === 2);
  if (!seen && visible && !self && lvl !== 'none') {
    if ((line.notify_level >= 1 || line.highlight) && (lvl === 'all' || mention)) b.unread++;
    if (mention) b.mentions++;
    renderSidebarSoon();
    updateTitle();
  }
  if (isActive) {
    appendLine(line);
    if (seen) markReadSoon(b);
  }
  if (mention && (!seen)) notify(b, line);
}

/* ─── Auto-switch after /join and /query ─────────────────────────────── */
function noteSwitchIntent(buf, text) {
  const m = text.match(/^\/(j|join|q|query)\s+(?:-\S+\s+)*(\S+)/i);
  if (!m) return;
  let target = m[2].split(',')[0];
  const isJoin = m[1].toLowerCase().startsWith('j');
  if (isJoin && !/^[#&!+]/.test(target)) target = '#' + target;
  const server = buf.lv.server || null;
  const existing = [...S.buffers.values()].find(b => b.short_name?.toLowerCase() === target.toLowerCase() && (!server || b.lv.server === server));
  if (existing) { activate(existing.id); return; }
  S.pendingSwitch = { name: target.toLowerCase(), server, until: Date.now() + 15000 };
}
function maybeAutoSwitch(b) {
  const r = S.restore;
  if (r && b.name === r.name) {
    S.restore = null;
    if (Date.now() < r.until && S.active === r.from) activate(b.id);
    return;
  }
  const p = S.pendingSwitch;
  if (!p || Date.now() > p.until) return;
  if ((b.short_name || '').toLowerCase() === p.name && (!p.server || b.lv.server === p.server)) {
    S.pendingSwitch = null;
    activate(b.id);
  }
}

/* ─── Read-state sync with WeeChat ─────────────────────────────────────── */
// Throttled, not debounced: at most one sync every ~5 s while messages keep
// arriving, and still one shortly after a quiet channel gets a message.
let readTimer = null, lastReadSync = 0;
function markReadSoon(b) {
  if (!settings.syncRead || readTimer) return;
  const wait = Math.max(1500, 5000 - (Date.now() - lastReadSync));
  readTimer = setTimeout(() => {
    readTimer = null;
    if (S.active === b.id && !document.hidden && S.connected) { lastReadSync = Date.now(); sendInput(b, '/buffer set hotlist -1'); }
  }, wait);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Buffer switching
   ═══════════════════════════════════════════════════════════════════════════ */
function activate(id, { force = false } = {}) {
  const b = S.buffers.get(id);
  if (!b) return;
  const prev = S.buffers.get(S.active);
  if (prev && prev.id === id && !force) { closeDrawers(); return; }
  if (prev && prev.id !== id) {
    saveDraft(prev, $('#input').value);
    const lastLine = prev.lines[prev.lines.length - 1];
    if (lastLine) prev.lastReadId = lastLine.id;
    if (settings.syncRead && S.connected) sendInput(prev, '/buffer set unread');
  }
  closeSearch({ render: false });   // search belongs to the buffer being left
  S.active = id;
  b.renderCount = RENDER_WINDOW;
  store.set('lastBuffer', b.name);
  b.unread = 0; b.mentions = 0;
  closeNotifications(b);
  S.comp = null;
  cancelPasteConfirm();
  setHint('');
  $('#input').value = b.draft || '';
  autosize();
  renderHeader();
  renderMessages();
  renderNicklist();
  renderComposer();
  renderSidebar();
  updateTitle();
  closeDrawers();
  closePopover();
  if (b.lazy && S.connected) ensureLoaded(b);
  if (S.connected) {
    if (settings.syncRead) sendInput(b, '/buffer set hotlist -1');
    if (settings.syncCurrent) sendInput(b, '/buffer ' + b.name);
  }
  if (!matchMedia('(hover: none)').matches) $('#input').focus({ preventScroll: true });
}

function sidebarOrder() { return buildGroups().flatMap(g => [g.server, ...(isCollapsed(g.key) ? [] : g.items)].filter(Boolean)); }

function cycleBuffer(dir) {
  const order = buildGroups().flatMap(g => [g.server, ...g.items].filter(Boolean));
  if (!order.length) return;
  const i = order.findIndex(b => b.id === S.active);
  activate(order[(i + dir + order.length) % order.length].id);
}
function nextActive() {
  const all = [...S.buffers.values()].filter(b => !b.hidden && b.id !== S.active);
  const target = all.filter(b => b.mentions).sort((a, b) => a.number - b.number)[0]
    || all.filter(b => b.unread).sort((a, b) => a.number - b.number)[0];
  if (target) activate(target.id);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rendering — sidebar
   ═══════════════════════════════════════════════════════════════════════════ */
const collapsed = new Set(store.get('collapsed', []));
const isCollapsed = key => collapsed.has(key);

// Sidebar layout (#24), kept in this browser only — WeeChat's own buffer
// numbers are untouched. Buffers are referenced by their full name.
const layout = Object.assign({ pinned: [], order: {}, notify: {} }, store.get('layout', {}));
const saveLayout = () => store.set('layout', layout);
// Per-buffer notifications: 'all' (default), 'mentions' (only highlights and
// private messages count and notify) or 'none' (muted: silent, no counts).
if (layout.muted) { for (const n of layout.muted) layout.notify[n] = 'none'; delete layout.muted; saveLayout(); }
const notifyLevel = b => layout.notify[b.name] || 'all';
const NOTIFY_LEVELS = { all: 'All messages', mentions: 'Mentions only', none: 'Mute' };
const isServerBuf = b => b.lv.plugin === 'irc' && b.lv.type === 'server';
const naturalGroupKey = b => (b.lv.plugin === 'irc' && b.lv.server ? 'irc:' + b.lv.server : 'core');

function buildGroups() {
  const bufs = [...S.buffers.values()].filter(b => !b.hidden).sort((a, b) => (a.number - b.number) || (a.id < b.id ? -1 : 1));
  const pinned = new Set(layout.pinned);
  const groups = new Map();
  for (const b of bufs) {
    if (pinned.has(b.name) && !isServerBuf(b)) continue;   // shown in the Pinned group instead
    const lv = b.lv;
    const key = naturalGroupKey(b);
    const label = key === 'core' ? 'WeeChat' : lv.server;
    if (!groups.has(key)) groups.set(key, { key, label, server: null, items: [], min: b.number });
    const g = groups.get(key);
    if (isServerBuf(b)) g.server = b; else g.items.push(b);
  }
  const list = [...groups.values()].sort((a, b) => (a.key === 'core' ? -1 : b.key === 'core' ? 1 : a.min - b.min));
  for (const g of list) applyCustomOrder(g);
  const byName = new Map(bufs.map(b => [b.name, b]));
  const pinnedItems = layout.pinned.map(n => byName.get(n)).filter(b => b && !isServerBuf(b));
  if (pinnedItems.length) list.unshift({ key: 'pinned', label: 'Pinned', server: null, items: pinnedItems, min: -1 });
  return list;
}

// Buffers the user has ordered come first in that order; others keep WeeChat's order after them.
function applyCustomOrder(g) {
  const order = layout.order[g.key];
  if (!order?.length) return;
  const pos = new Map(order.map((n, i) => [n, i]));
  const base = new Map(g.items.map((b, i) => [b, i]));
  const rank = b => pos.has(b.name) ? pos.get(b.name) : 1e6 + base.get(b);
  g.items.sort((a, b) => rank(a) - rank(b));
}

function groupOf(b) { return buildGroups().find(g => g.items.includes(b)); }
function setGroupOrder(key, items) {
  if (key === 'pinned') layout.pinned = items.map(b => b.name);
  else layout.order[key] = items.map(b => b.name);
  saveLayout();
  renderSidebar();
}
function togglePin(b) {
  const i = layout.pinned.indexOf(b.name);
  if (i >= 0) layout.pinned.splice(i, 1); else layout.pinned.push(b.name);
  saveLayout();
  renderSidebar();
}
function setNotifyLevel(b, lvl) {
  if (lvl === notifyLevel(b)) return;
  if (lvl === 'all') delete layout.notify[b.name]; else layout.notify[b.name] = lvl;
  if (lvl === 'none') { b.unread = 0; b.mentions = 0; closeNotifications(b); }
  else if (lvl === 'mentions') b.unread = b.mentions;
  saveLayout();
  renderSidebar(); updateTitle();
  toast(lvl === 'none' ? `Muted ${bufLabel(b)}` : lvl === 'mentions' ? `${bufLabel(b)}: mentions only` : `${bufLabel(b)}: all messages`);
}
function moveBuffer(b, dir) {
  const g = b && groupOf(b);
  if (!g) return;
  const items = [...g.items], i = items.indexOf(b), j = i + dir;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  setGroupOrder(g.key, items);
}
function resetOrder(key) { delete layout.order[key]; saveLayout(); renderSidebar(); }

/* ─── Mark as read (#22) ───────────────────────────────────────────────── */
function markRead(b) {
  b.unread = 0; b.mentions = 0;
  const last = b.lines[b.lines.length - 1];
  if (last && b.id !== S.active) b.lastReadId = last.id;
}
function markBufferRead(b) {
  markRead(b);
  renderSidebar(); updateTitle();
  if (settings.syncRead && S.connected) { sendInput(b, '/buffer set hotlist -1'); sendInput(b, '/buffer set unread'); }
}
function markAllRead() {
  let n = 0;
  for (const b of S.buffers.values()) if (b.unread || b.mentions) { markRead(b); n++; }
  renderSidebar(); updateTitle();
  // Two commands cover every buffer: clear WeeChat's hotlist and move all read markers.
  if (settings.syncRead && S.connected) {
    const core = { name: 'core.weechat' };
    sendInput(core, '/hotlist clear');
    sendInput(core, '/allbuf /buffer set unread');
  }
  if (n) toast(`Marked ${n} buffer${n === 1 ? '' : 's'} as read`);
}

function bufIcon(b) {
  const lv = b.lv;
  if (lv.type === 'private') return avatar(b.short_name || b.name);
  if (lv.type === 'channel') return ico('hash');
  if (lv.type === 'server') return ico('server');
  if (b.name === 'core.weechat') return ico('term');
  return ico('grid');
}
function bufLabel(b) {
  const n = b.short_name || b.name || '?';
  return b.lv.type === 'channel' && n.startsWith('#') ? n.slice(1) : n;
}
function badgeHtml(b) {
  if (b.mentions) return `<span class="badge">${b.mentions}</span>`;
  if (b.unread) return `<span class="badge soft">${b.unread > 999 ? '999+' : b.unread}</span>`;
  return '';
}

function renderSidebar() {
  const list = $('#bufList');
  if (!list) return;
  if (S.drag) { S.sidebarPending = true; return; }   // don't rebuild under an active drag
  const scroll = list.scrollTop;
  let html = '';
  const groups = buildGroups();
  if ([...S.buffers.values()].some(b => b.id !== S.active && !b.hidden && (b.unread || b.mentions))) {
    html += `<button class="mark-all" type="button" data-markall title="Mark all as read (Shift+Esc)">${ico('checks', 'i-sm')}<span>Mark all as read</span></button>`;
  }
  const draggable = !TOUCH_MQ.matches;
  for (const g of groups) {
    const col = g.key !== 'core' && isCollapsed(g.key);
    if (g.key !== 'core') {   // the core WeeChat buffer sits at the top without a header
      const s = g.server;
      const hidden = col ? g.items.reduce((a, b) => ({ m: a.m + b.mentions, u: a.u + b.unread }), { m: 0, u: 0 }) : { m: 0, u: 0 };
      const gm = (s?.mentions || 0) + hidden.m, gu = (s?.unread || 0) + hidden.u;
      const cls = ['grp-name', s && s.id === S.active ? 'active' : '', gu ? 'unread' : ''].join(' ');
      html += `<div class="grp${col ? ' collapsed' : ''}${g.key === 'pinned' ? ' grp-pinned' : ''}" data-group="${esc(g.key)}">` +
        `<button class="grp-toggle" type="button" data-toggle="${esc(g.key)}" title="${col ? 'Expand' : 'Collapse'}">${ico('chev')}</button>` +
        `<button class="${cls}" type="button" ${s ? `data-id="${esc(s.id)}"` : `data-toggle="${esc(g.key)}"`}>${g.key === 'pinned' ? ico('pin', 'i-sm') : ''}<span>${esc(g.label)}</span></button>` +
        (gm ? `<span class="badge">${gm}</span>` : gu && col ? `<span class="badge soft">${gu}</span>` : '') +
        (s ? `<button class="icon-btn grp-add" type="button" data-join="${esc(s.id)}" title="Join a channel">${ico('plus', 'i-sm')}</button>` : '') +
        `</div>`;
    }
    if (col) continue;
    for (const b of g.items) {
      const lvl = notifyLevel(b);
      const cls = ['buf', b.id === S.active ? 'active' : '', b.unread || b.mentions ? 'unread' : '', lvl !== 'all' ? 'muted' : ''].join(' ');
      const closable = b.lv.type === 'channel' || b.lv.type === 'private' || (b.lv.plugin && b.lv.plugin !== 'core' && b.lv.plugin !== 'irc');
      const confirming = S.closeConfirm?.id === b.id;
      const leaveLabel = b.lv.type === 'channel' ? 'Leave channel' : 'Close';
      const srv = g.key === 'pinned' && b.lv.server ? `<span class="b-srv">${esc(b.lv.server)}</span>` : '';
      html += `<div class="buf-row${confirming ? ' confirming' : ''}" data-group="${esc(g.key)}"><button class="${cls}" type="button" data-id="${esc(b.id)}" title="${esc(b.name)}"${draggable ? ' draggable="true"' : ''}>` +
        `<span class="b-ico">${bufIcon(b)}</span><span class="b-name">${esc(bufLabel(b))}</span>${srv}${lvl !== 'all' ? `<span class="b-muted" title="${NOTIFY_LEVELS[lvl]}">${ico(lvl === 'none' ? 'bellOff' : 'at')}</span>` : ''}${badgeHtml(b)}</button>` +
        (closable ? `<button class="b-close" type="button" data-close="${esc(b.id)}" title="${confirming ? 'Tap again to confirm' : leaveLabel}" aria-label="${leaveLabel} ${esc(bufLabel(b))}">` +
          (confirming ? `<span>${b.lv.type === 'channel' ? 'Leave?' : 'Close?'}</span>` : ico('x')) + `</button>` : '') +
        `</div>`;
    }
  }
  list.innerHTML = html;
  list.scrollTop = scroll;
  // With the sidebar hidden on phones, show other buffers' activity on the menu button.
  let mention = false, unread = false;
  for (const b of S.buffers.values()) {
    if (b.id === S.active || b.hidden) continue;
    if (b.mentions) mention = true; else if (b.unread) unread = true;
  }
  const mb = $('#btnMenu');
  mb.classList.toggle('has-mention', mention);
  mb.classList.toggle('has-unread', !mention && unread);
  mb.title = mention ? 'Buffers — new mentions' : unread ? 'Buffers — unread messages' : 'Buffers';
}
let sidebarRaf = 0;
function renderSidebarSoon() { if (!sidebarRaf) sidebarRaf = requestAnimationFrame(() => { sidebarRaf = 0; renderSidebar(); }); }

/* ─── Header, composer ────────────────────────────────────────────────── */
function activeBuf() { return S.buffers.get(S.active); }

function renderHeader() {
  const b = activeBuf();
  const t = $('#tbTitle'), topic = $('#tbTopic');
  if (!b) { t.innerHTML = ''; topic.innerHTML = ''; return; }
  const lv = b.lv;
  let pre = '';
  if (lv.type === 'channel') pre = `<span class="hash">#</span>`;
  else if (lv.type === 'private') pre = avatar(b.short_name || b.name);
  t.innerHTML = pre + `<span class="t">${esc(bufLabel(b))}</span>` +
    (b.modes ? `<span class="chip">${esc(b.modes)}</span>` : '') +
    (lv.server && lv.type !== 'server' ? `<span class="chip">${esc(lv.server)}</span>` : '');
  topic.innerHTML = b.title ? renderAnsi(b.title) : '';
  topic.classList.remove('open');
  const irc = lv.plugin === 'irc' && (lv.type === 'channel' || lv.type === 'private');
  const f = $('#btnFilter');
  f.hidden = !irc;
  const on = b.filterOverride ?? settings.smartFilter;
  f.innerHTML = ico(on ? 'eyeOff' : 'eye');
  f.classList.toggle('on', !!on);
  f.title = on ? 'Join/part noise hidden (smart filter on) — click to show' : 'Showing all joins/parts — click to filter';
  $('#btnSearch').hidden = b.type === 'free';
  $('#fsetBar').hidden = b.lv.plugin !== 'fset';
  const hasNl = !!b.nicklist;
  $('#btnMembers').hidden = !hasNl;
  document.title = titleText();
}

function renderComposer() {
  const b = activeBuf();
  const nick = b?.lv.nick || '';
  $('#myNick').textContent = nick;
  const host = uploadsEnabled() ? uploadHost() : '';
  $('#btnAttach').hidden = !host;
  $('#btnAttach').title = host ? `Upload files to ${host} (or drop / paste them)` : '';
  const lv = b?.lv || {};
  $('#input').placeholder = !b ? 'Message' :
    lv.type === 'channel' ? `Message #${bufLabel(b)}` :
    lv.type === 'private' ? `Message ${b.short_name}` :
    lv.plugin === 'fset' ? 'Filter options (e.g. relay.* or c:weechat.color.*), or type a command' :
    `Type a command for ${b.short_name || b.name}`;
  updateSendBtn();
}

function renderEmpty() {
  $('#msgs').innerHTML = `<div class="buf-empty"><div class="big">${ico('msg')}</div><h3>No buffer selected</h3><div>Pick a buffer from the sidebar.</div></div>`;
  $('#tbTitle').innerHTML = ''; $('#tbTopic').innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rendering — messages
   ═══════════════════════════════════════════════════════════════════════════ */
let timeFmt = null, dayFmt = null;
function fmtTime(d) {
  if (!timeFmt) timeFmt = new Intl.DateTimeFormat([], {
    hour: '2-digit', minute: '2-digit', second: settings.clock === '24s' ? '2-digit' : undefined, hour12: settings.clock === '12',
  });
  return timeFmt.format(d);
}
function fmtDay(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((today - x) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (!dayFmt) dayFmt = new Intl.DateTimeFormat([], { weekday: 'long', month: 'long', day: 'numeric' });
  const s = dayFmt.format(d);
  return x.getFullYear() === today.getFullYear() ? s : s + ', ' + x.getFullYear();
}
const parseDate = s => new Date(typeof s === 'string' ? s.replace(/(\.\d{3})\d+/, '$1') : s);
const dayKey = d => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

const EVENT_TAGS = { irc_join: 'join', irc_part: 'part', irc_quit: 'part', irc_kick: 'part', irc_nick: 'misc', irc_mode: 'misc', irc_topic: 'misc', irc_invite: 'misc' };
function classify(l) {
  const tags = l.tags || [];
  let nick = null, ev = null, action = false, notice = false, privmsg = false, self = false, prefixNick = false;
  for (const t of tags) {
    if (t.startsWith('nick_')) nick = t.slice(5);
    else if (EVENT_TAGS[t]) ev = EVENT_TAGS[t];
    else if (t === 'irc_action') action = true;
    else if (t === 'irc_notice') notice = true;
    else if (t === 'irc_privmsg') privmsg = true;
    else if (t === 'self_msg') self = true;
    else if (t.startsWith('prefix_nick')) prefixNick = true;
  }
  if (action) return { kind: 'action', nick, self };
  if (ev) return { kind: 'event', ev, nick };
  if (privmsg || notice || prefixNick) return { kind: 'msg', nick, notice, self };
  return { kind: 'sys' };
}
const EV_ICON = { join: 'arrowR', part: 'arrowL', misc: 'dot' };

function newCtx(b) { return { buf: b, day: null, nick: null, date: 0, marker: false, markerDone: false }; }

function lineHtml(ctx, l) {
  const b = ctx.buf;
  if (b.type === 'free') return `<div class="row free${b.lv.plugin === 'fset' ? ' clickable' : ''}" data-y="${esc(l.y)}">${renderAnsi(l.message) || '&nbsp;'}</div>`;
  let html = '';
  // Read marker goes before the first visible line after the last-read one.
  if (ctx.marker && !ctx.markerDone) { html += `<div class="marker">New</div>`; ctx.markerDone = true; }
  const d = parseDate(l.date);
  const dk = dayKey(d);
  if (dk !== ctx.day) {
    html += `<div class="day">${esc(fmtDay(d))}</div>`;
    ctx.day = dk; ctx.nick = null;
  }
  const c = classify(l);
  const ts = `<span class="ts" title="${esc(d.toLocaleString())}">${esc(fmtTime(d))}</span>`;
  let cls = 'row';
  if (l.highlight) cls += ' hl';
  let pf, tx = renderAnsi(l.message);
  if (c.kind === 'msg') {
    const cont = settings.groupMessages && !c.notice && ctx.nick && ctx.nick === c.nick && d - ctx.date < 5 * 60000;
    cls += cont ? ' cont' : ' first';
    if (c.self) cls += ' self';
    if (c.notice) cls += ' notice';
    learnNickColor(c.nick, l.prefix);
    pf = cont ? '' : `<span class="nick" data-nick="${esc(c.nick || '')}">${renderAnsi(l.prefix, { links: false })}</span>`;
    ctx.nick = c.notice ? null : c.nick;
    ctx.date = +d;
  } else {
    ctx.nick = null;
    if (c.kind === 'action') { cls += ' act first'; pf = '<span>•</span>'; }
    else if (c.kind === 'event') { cls += ' ev'; pf = `<span class="ev-ico ev-${c.ev}">${ico(EV_ICON[c.ev])}</span>`; }
    else { cls += ' sys first'; pf = renderAnsi(l.prefix, { links: false }); }
  }
  return html + `<div class="${cls}" data-id="${esc(l.id)}">${ts}<span class="pf">${pf}</span><span class="tx">${tx}</span></div>`;
}

function renderMessages() {
  const box = $('#msgs');
  const b = activeBuf();
  if (!b) return renderEmpty();
  const ctx = newCtx(b);
  box.classList.toggle('free-view', b.type === 'free');   // tool buffers scroll sideways (aligned columns)
  const lines = b.type === 'free' ? [...b.lines].sort((x, y) => x.y - y.y) : b.lines;
  const markerId = b.lastReadId;
  const lastId = lines.length ? lines[lines.length - 1].id : null;
  const markerIdx = markerId != null && lastId != null && markerId !== lastId ? lines.findIndex(l => l.id === markerId) : -1;
  const useMarker = markerIdx >= 0;
  // Render only the newest `renderCount` visible messages (plus the read
  // marker if it's further back); scrolling up reveals more.
  let start = 0;
  if (b.type !== 'free') {
    for (let i = lines.length - 1, n = 0; i >= 0; i--) {
      if (shownLine(b, lines[i]) && ++n > b.renderCount) { start = i + 1; break; }
    }
    if (useMarker && markerIdx < start) start = Math.max(0, markerIdx - 5);
  }
  b.renderStart = start;
  let html = '';
  if (b.type !== 'free') {
    html += start > 0 || b.hasMore
      ? `<div class="history-top" id="historyTop"><button class="btn" type="button" data-more>Load older messages</button></div>`
      : (lines.length && !b.lazy ? `<div class="history-top">Beginning of history</div>` : '');
  }
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (!shownLine(b, l)) { if (useMarker && l.id === markerId) ctx.marker = true; continue; }
    html += lineHtml(ctx, l);
    if (useMarker && l.id === markerId) ctx.marker = true;
  }
  if (S.search?.only && S.search.q && !S.search.hits.length) html += `<div class="search-empty">No matching messages in the loaded history.</div>`;
  if (!lines.length) html += `<div class="buf-empty"><div class="big">${ico(b.lv.type === 'private' ? 'msg' : 'hash')}</div><h3>${esc(b.short_name || b.name)}</h3><div>No messages yet.</div></div>`;
  box.innerHTML = html;
  if (S.search?.q) highlightHits();
  S.ctx = ctx;
  S.pinned = true;
  S.newCount = 0;
  if (b.type === 'free') {   // tool buffers (fset, script…) read top-down
    S.pinned = false;
    box.scrollTop = 0;
    revealFreeSelection();
    updateJump();
    return;
  }
  updateJump();
  const mk = useMarker && $('.marker', box);
  if (mk && mk.offsetTop < box.scrollHeight - box.clientHeight) {
    // Put the "New" marker near the top if there's a lot of unread text.
    box.scrollTop = Math.max(0, mk.offsetTop - box.clientHeight * 0.3);
    S.pinned = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    if (!S.pinned) updateJump();
  } else box.scrollTop = box.scrollHeight;
}

let rerenderRaf = 0;
function scheduleRerender() {
  if (rerenderRaf) return;
  rerenderRaf = requestAnimationFrame(() => {
    rerenderRaf = 0;
    const box = $('#msgs');
    if (activeBuf()?.type === 'free') {   // one line per row: keep the scroll offset
      const top = box.scrollTop;
      renderMessages();
      box.scrollTop = top;
      revealFreeSelection();
      return;
    }
    const anchor = captureScrollAnchor();
    renderMessages();
    restoreScrollAnchor(anchor);
  });
}

function appendLine(l) {
  const b = activeBuf();
  if (!b || !S.ctx || S.ctx.buf !== b) return renderMessages();
  if (!shownLine(b, l)) return;
  const box = $('#msgs');
  const empty = $('.buf-empty', box);
  if (empty) empty.remove();
  if (S.awayMarker) {
    $$('.marker', box).forEach(m => m.remove());
    S.ctx.marker = true; S.ctx.markerDone = false;
    S.awayMarker = false;
  }
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const isHit = !!(S.search?.q && lineMatches(l, S.search.q));
  if (isHit) S.search.hits.push(l.id);
  box.insertAdjacentHTML('beforeend', lineHtml(S.ctx, l));
  if (isHit) { markRow(box.lastElementChild, S.search.q); updateSearchUI(); }
  // Keep the DOM bounded on busy buffers: re-window once it has grown well
  // past the render window (only while following the bottom).
  if ((S.pinned || atBottom) && box.childElementCount > b.renderCount * 1.6 + 50) { renderMessages(); return; }
  if (S.pinned || atBottom) { box.scrollTop = box.scrollHeight; S.pinned = true; }
  else { S.newCount++; updateJump(); }
}

// Remember which message is at the top of the view, re-render, and scroll
// back to it — so changing a setting doesn't throw you to the bottom.
function captureScrollAnchor() {
  const box = $('#msgs');
  if (S.pinned) return null;
  const top = box.getBoundingClientRect().top;
  for (const r of box.querySelectorAll('.row[data-id]')) {
    const rr = r.getBoundingClientRect();
    if (rr.bottom > top) return { id: r.dataset.id, off: rr.top - top, h: rr.height };
  }
  return null;
}
function restoreScrollAnchor(a) {
  if (!a) return;
  const box = $('#msgs');
  const r = box.querySelector(`.row[data-id="${CSS.escape(a.id)}"]`);
  if (!r) return;
  // Off-screen rows are only size estimates (content-visibility). Lay them
  // all out once so positions are exact; `contain-intrinsic-size: auto`
  // then remembers the real sizes, so nothing shifts afterwards.
  box.classList.add('measuring');
  // Keep the same share of that message visible, even if its height changed
  // (e.g. denser layout), rather than the same pixel offset.
  const rr = r.getBoundingClientRect();
  const off = a.h ? a.off / a.h * rr.height : a.off;
  // Round towards the anchor: rounding the other way lets the previous
  // message peek in by a pixel and become the top one.
  box.scrollTop = Math.ceil(box.scrollTop + rr.top - box.getBoundingClientRect().top - off);
  box.classList.remove('measuring');
  S.pinned = false;
  updateJump();
}

function rerenderKeepingPosition() {
  const box = $('#msgs');
  box.classList.add('measuring');
  const fromBottom = box.scrollHeight - box.scrollTop;
  renderMessages();
  box.classList.add('measuring');
  box.scrollTop = box.scrollHeight - fromBottom;
  box.classList.remove('measuring');
  S.pinned = false;
  updateJump();
}

async function loadOlder() {
  const b = activeBuf();
  if (!b || b.loadingMore) return;
  // Older lines already in memory: just render more of them.
  if (b.renderStart > 0) { b.renderCount += RENDER_WINDOW; rerenderKeepingPosition(); return; }
  if (b.lazy) { await ensureLoaded(b); return; }
  if (!b.hasMore || !S.connected) return;
  const top = $('#historyTop');
  if (top) top.innerHTML = '<span class="spinner"></span>';
  try {
    await fetchOlderLines(b);
    if (b.id === S.active) { refreshSearchHits(b); rerenderKeepingPosition(); if (S.search) updateSearchUI(); }
  } catch (e) {
    toast('Could not load history: ' + e.message, { error: true });
    if (top) top.innerHTML = '<button class="btn" type="button" data-more>Load older messages</button>';
  }
}

// Fetch the next chunk of older lines from the relay into b.lines (no rendering).
async function fetchOlderLines(b) {
  if (b.loadingMore || !b.hasMore || !S.connected) return 0;
  b.loadingMore = true;
  try {
    const want = Math.max(b.fetched, b.lines.length) + MORE_LINES;
    const r = await request('GET', `/api/buffers/${b.id}/lines?lines=-${want}&colors=ansi`);
    const got = r.body || [];
    const firstId = b.lines.length ? b.lines[0].id : Infinity;
    const older = got.filter(l => l.id < firstId);
    b.lines = older.concat(b.lines);
    b.fetched = want;
    b.hasMore = got.length >= want;
    b.renderCount += older.length;
    return older.length;
  } finally { b.loadingMore = false; }
}

function updateJump() {
  const j = $('#jump');
  const show = !S.pinned && activeBuf()?.type !== 'free';
  j.hidden = !show;
  if (show) j.querySelector('span').textContent = S.newCount ? `${S.newCount} new message${S.newCount === 1 ? '' : 's'}` : 'Jump to latest';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Search within a buffer (#21) — case-insensitive, over nick + message text
   of the loaded history. Matches are highlighted in place; "Only matches"
   hides everything else; "Search older" pulls more history from the relay.
   ═══════════════════════════════════════════════════════════════════════════ */
const lineText = l => stripAnsi(`${l.prefix || ''} ${l.message || ''}`).toLowerCase();
const lineMatches = (l, q) => lineText(l).includes(q);

// Whether a line is rendered: WeeChat's filters, plus "Only matches" while searching.
function shownLine(b, l) {
  if (!isVisibleLine(b, l)) return false;
  const q = S.search?.q;
  return !(q && S.search.only && !lineMatches(l, q));
}

function openSearch() {
  const b = activeBuf();
  if (!b || b.type === 'free') return;
  if (!S.search) S.search = { q: '', only: false, hits: [], idx: -1 };
  $('#searchBar').hidden = false;
  $('#btnSearch').classList.add('on');
  const inp = $('#searchInput');
  inp.focus();
  inp.select();
  updateSearchUI();
}

function closeSearch({ render = true } = {}) {
  if (!S.search && $('#searchBar').hidden) return;
  const hadQuery = !!S.search?.q;
  S.search = null;
  $('#searchBar').hidden = true;
  $('#searchInput').value = '';
  $('#btnSearch').classList.remove('on');
  if (render && hadQuery && activeBuf()) {
    const anchor = captureScrollAnchor();
    renderMessages();
    restoreScrollAnchor(anchor);
  }
  if (render && !matchMedia('(hover: none)').matches) $('#input').focus({ preventScroll: true });
}

function computeHits(b, q) { return b.lines.filter(l => isVisibleLine(b, l) && lineMatches(l, q)).map(l => l.id); }

// More history arrived while searching (scroll-up, first load): recount,
// keeping the current match selected.
function refreshSearchHits(b) {
  const s = S.search;
  if (!s?.q || b.id !== S.active) return;
  const keep = s.hits[s.idx];
  s.hits = computeHits(b, s.q);
  const i = s.hits.indexOf(keep);
  s.idx = i >= 0 ? i : s.hits.length - 1;
}

function runSearch() {
  const b = activeBuf();
  if (!b || !S.search) return;
  const q = $('#searchInput').value.trim().toLowerCase();
  S.search.q = q;
  S.search.hits = q ? computeHits(b, q) : [];
  S.search.idx = S.search.hits.length - 1;   // start at the newest match
  renderMessages();
  if (S.search.idx >= 0) goToHit(S.search.idx); else updateSearchUI();
}

// Scroll to match i (0 = oldest), widening the render window if needed.
function goToHit(i) {
  const b = activeBuf(), s = S.search;
  if (!b || !s || !s.hits.length) return updateSearchUI();
  s.idx = (i + s.hits.length) % s.hits.length;
  const id = String(s.hits[s.idx]);
  let row = $(`#msgs .row[data-id="${CSS.escape(id)}"]`);
  if (!row) {
    const at = b.lines.findIndex(l => String(l.id) === id);
    let n = 0;
    for (let k = Math.max(0, at); k < b.lines.length; k++) if (shownLine(b, b.lines[k])) n++;
    b.renderCount = Math.max(b.renderCount, n + 20);
    renderMessages();
    row = $(`#msgs .row[data-id="${CSS.escape(id)}"]`);
  }
  $$('#msgs .row.hit-current').forEach(r => r.classList.remove('hit-current'));
  if (row) {
    row.classList.add('hit-current');
    const box = $('#msgs');
    box.classList.add('measuring');   // exact positions, not content-visibility estimates
    row.scrollIntoView({ block: 'center' });
    box.classList.remove('measuring');
    S.pinned = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    updateJump();
  }
  updateSearchUI();
}

function markRow(row, q) {
  if (!row?.classList.contains('row')) return;
  row.classList.add('hit');
  for (const el of row.querySelectorAll('.pf, .tx')) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue, lower = text.toLowerCase();
      let i = lower.indexOf(q);
      if (i < 0) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      while (i >= 0) {
        frag.append(text.slice(last, i));
        const m = document.createElement('mark');
        m.className = 'hl-q';
        m.textContent = text.slice(i, i + q.length);
        frag.append(m);
        last = i + q.length;
        i = lower.indexOf(q, last);
      }
      frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  }
}

function highlightHits() {
  const s = S.search;
  if (!s?.q) return;
  const hits = new Set(s.hits.map(String));
  for (const row of $$('#msgs .row[data-id]')) if (hits.has(row.dataset.id)) markRow(row, s.q);
  const cur = s.hits[s.idx];
  if (cur != null) $(`#msgs .row[data-id="${CSS.escape(String(cur))}"]`)?.classList.add('hit-current');
}

function updateSearchUI() {
  const s = S.search, b = activeBuf();
  const n = s?.hits.length || 0;
  $('#searchCount').textContent = !s?.q ? '' : n ? `${s.idx + 1} of ${n}` : 'No matches';
  $('#searchPrev').disabled = $('#searchNext').disabled = n === 0;
  $('#searchOnly').setAttribute('aria-pressed', String(!!s?.only));
  $('#searchMore').hidden = !(s?.q && b && (b.hasMore || b.lazy) && b.lines.length < MAX_LINES);
}

// Pull up to ~1,200 more lines of history from the relay and search again.
async function searchOlder() {
  const b = activeBuf(), btn = $('#searchMore');
  if (!b || btn.disabled || !S.search) return;
  btn.disabled = true;
  btn.textContent = 'Searching…';
  try {
    if (b.lazy) await ensureLoaded(b);
    for (let k = 0; k < 4 && b.hasMore && b.lines.length < MAX_LINES; k++) await fetchOlderLines(b);
  } catch (e) { toast('Could not load history: ' + e.message, { error: true }); }
  btn.disabled = false;
  btn.textContent = 'Search older';
  if (!S.search || activeBuf() !== b) return;
  refreshSearchHits(b);
  renderMessages();
  if (S.search.idx >= 0) goToHit(S.search.idx); else updateSearchUI();
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tool buffers (fset, script…) — WeeChat sends each buffer's own key map
   (e.g. fset: up → "/fset -up", meta-space → "/fset -toggle"); key presses
   are translated to WeeChat key names and run the bound command. fset also
   gets click-to-select, click-again-to-edit and a toolbar.
   ═══════════════════════════════════════════════════════════════════════════ */
const WEECHAT_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'home', End: 'end',
  PageUp: 'pgup', PageDown: 'pgdn', Enter: 'return', Tab: 'tab', Backspace: 'backspace', Delete: 'delete', Insert: 'insert', Escape: 'escape' };

// Browser key event → WeeChat key name ("meta-space", "ctrl-l", "shift-down", "f11"…).
function weechatKeyName(e) {
  let base;
  if (WEECHAT_KEYS[e.key]) base = WEECHAT_KEYS[e.key];
  else if (/^F\d{1,2}$/.test(e.key)) base = e.key.toLowerCase();
  // Symbols: the character the layout produces (on a Swedish keyboard "+" is
  // where US has "-"), so Alt++ really means +.
  else if (e.key === '+' || e.key === '-' || e.key === '=') base = e.key;
  else if (e.key === ',') base = 'comma';
  else if (e.key === ' ' || e.code === 'Space') base = 'space';
  // Letters and digits by key position: stays right when macOS's Option key
  // turns Alt+F into "ƒ".
  else if (/^Key[A-Z]$/.test(e.code)) base = e.code.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(e.code)) base = e.code.slice(5);
  // Fallbacks for Option-modified symbols on a US layout.
  else if (e.code === 'NumpadAdd' || (e.code === 'Equal' && e.shiftKey)) base = '+';
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') base = '-';
  else if (e.code === 'Equal') base = '=';
  else if (e.code === 'Comma') base = 'comma';
  else if (e.key.length === 1) base = e.key.toLowerCase();
  else return null;
  const printable = base.length === 1 || base === 'comma' || base === 'space';
  return (e.altKey ? 'meta-' : '') + (e.ctrlKey ? 'ctrl-' : '') + (e.shiftKey && !printable ? 'shift-' : '') + base;
}

// Run a key's bound command in the active tool buffer. Returns true if handled.
function handleBufferKey(e) {
  const b = activeBuf();
  if (!b || b.type !== 'free' || !b.keys?.length || !S.connected || e.metaKey) return false;
  const name = weechatKeyName(e);
  if (!name) return false;
  const inp = $('#input');
  const typing = document.activeElement === inp && inp.value.trim() !== '';
  // Unmodified keys belong to the text box (typing filters fset), except
  // navigation keys while the box is empty.
  if (!e.altKey && !e.ctrlKey && (typing || !/^(shift-)?(up|down|left|right|pgup|pgdn|home|end|f\d+)$/.test(name))) return false;
  const seq = S.keySeq && Date.now() - S.keySeq.at < 1500 ? S.keySeq.name + ',' + name : name;
  const hit = b.keys.find(k => k.key === seq);
  if (hit) { e.preventDefault(); S.keySeq = null; runBufferCommand(b, hit.command); return true; }
  if (b.keys.some(k => k.key.startsWith(seq + ','))) { e.preventDefault(); S.keySeq = { name: seq, at: Date.now() }; return true; }
  S.keySeq = null;
  return false;
}

// WeeChat runs "a; b" as two commands (a literal ";" is written "\;");
// the relay API takes them one at a time.
function splitCommands(cmd) {
  const out = [];
  let cur = '';
  for (let i = 0; i < cmd.length; i++) {
    if (cmd[i] === '\\' && cmd[i + 1] === ';') { cur += ';'; i++; }
    else if (cmd[i] === ';') { out.push(cur); cur = ''; }
    else cur += cmd[i];
  }
  out.push(cur);
  return out.map(c => c.trim()).filter(Boolean);
}

async function runBufferCommand(b, command) {
  for (const c of splitCommands(command)) await sendInput(b, c);
  await pullWeeChatInput(b);
}

// Actions like fset's "edit" put a command into WeeChat's input line
// (e.g. /set relay.network.allowed_ips ""): move it into Weave's message box,
// cursor where WeeChat put it, and clear WeeChat's copy.
async function pullWeeChatInput(b) {
  if (!S.connected) return;
  let body;
  try { body = (await request('GET', `/api/buffers/${b.id}?lines=0`)).body; } catch { return; }
  const text = body?.input || '';
  if (!text || S.active !== b.id) return;
  const inp = $('#input');
  inp.value = text;
  const pos = Math.min(body.input_position ?? text.length, text.length);
  inp.focus();
  inp.setSelectionRange(pos, pos);
  autosize(); updateSendBtn();
  sendInput(b, '/input delete_line');
}

// fset draws its selected line with a background colour: find it, highlight
// the whole row and keep it in view.
function revealFreeSelection() {
  const b = activeBuf();
  if (b?.lv.plugin !== 'fset') return;
  const box = $('#msgs');
  box.querySelectorAll('.fset-sel').forEach(r => r.classList.remove('fset-sel'));
  let sel = null;
  for (const r of box.querySelectorAll('.row.free')) {
    const first = r.firstElementChild;
    if (first && first.style.background) { sel = r; break; }
  }
  if (!sel) return;
  sel.classList.add('fset-sel');
  S.fsetSelY = +sel.dataset.y;
  box.classList.add('measuring');
  const rr = sel.getBoundingClientRect(), br = box.getBoundingClientRect();
  if (rr.top < br.top || rr.bottom > br.bottom) sel.scrollIntoView({ block: 'nearest' });
  box.classList.remove('measuring');
}

// fset line → option index (the "Details" layout uses several lines per option).
function fsetOptionIndex(b, y) {
  const m = stripAnsi(b.title || '').match(/(\d+)\/(\d+)/);
  const total = m ? +m[2] : 0;
  const per = total ? Math.max(1, Math.round(b.lines.length / total)) : 1;
  return Math.floor(y / per);
}

function fsetClick(b, y, edit = false) {
  const idx = fsetOptionIndex(b, y);
  const selIdx = S.fsetSelY != null ? fsetOptionIndex(b, S.fsetSelY) : -1;
  if (edit || idx === selIdx) { runBufferCommand(b, idx === selIdx ? '/fset -set' : `/fset -go ${idx}; /fset -set`); return; }
  S.fsetSelY = y;   // optimistic: a second click edits even before WeeChat redraws
  runBufferCommand(b, `/fset -go ${idx}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rendering — nicklist
   ═══════════════════════════════════════════════════════════════════════════ */
const NICK_RANKS = [['~', 'Owners'], ['&', 'Admins'], ['@', 'Operators'], ['%', 'Half-ops'], ['+', 'Voiced']];
function nickRank(n) { const p = (n.prefix || '').trim(); const i = NICK_RANKS.findIndex(r => r[0] === p); return i < 0 ? NICK_RANKS.length : i; }

function renderNicklist() {
  const b = activeBuf();
  const nl = $('#nicklist');
  const wide = matchMedia('(min-width: 1081px)').matches;
  const has = !!b?.nicklist;
  if (wide) nl.hidden = !(has && settings.nicklist);
  else nl.hidden = !has;
  $('#btnMembers').classList.toggle('on', wide ? (has && settings.nicklist) : nl.classList.contains('open'));
  if (!has) { $('#memberCount').textContent = ''; return; }
  if (!b.nicksLoaded) {
    $('#memberCount').textContent = '…'; $('#nlCount').textContent = '';
    $('#nlBody').innerHTML = '<div class="nl-sec">Loading members…</div>';
    return;
  }
  let count = 0;
  for (const n of b.nicks.values()) if (n.visible !== false) count++;
  $('#memberCount').textContent = count;
  $('#nlCount').textContent = count;
  // Building the list is the costly part: skip it while it can't be seen
  // (closed drawer on phones, hidden panel) and catch up when it opens.
  const shown = wide ? settings.nicklist : nl.classList.contains('open');
  if (!shown) { S.nlDirty = true; return; }
  S.nlDirty = false;
  const nicks = [];
  const perRank = new Array(NICK_RANKS.length + 1).fill(0);
  for (const n of b.nicks.values()) {
    if (n.visible === false) continue;
    n._rank = nickRank(n);
    perRank[n._rank]++;
    nicks.push(n);
  }
  nicks.sort((x, y) => x._rank - y._rank || x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }));
  let html = '', rank = -1;
  for (const n of nicks) {
    const r = n._rank;
    if (r !== rank) {
      rank = r;
      html += `<div class="nl-sec">${r < NICK_RANKS.length ? NICK_RANKS[r][1] : 'Members'} — ${perRank[r]}</div>`;
    }
    const col = nickCss(n.name, n.color);
    const away = /\b(away|darkgray|8)\b/.test(n.color_name || '') ? ' away' : '';
    html += `<button class="nk${away}" type="button" data-nick="${esc(n.name)}">${avatar(n.name, col ? `color-mix(in srgb, ${col} 80%, #000)` : null)}` +
      `<span class="nk-pf" style="${n.prefix_color ? 'color:' + (ansiFg(n.prefix_color) || 'inherit') : ''}">${esc((n.prefix || '').trim())}</span>` +
      `<span class="nk-name"${col ? ` style="color:${col}"` : ''}>${esc(n.name)}</span></button>`;
  }
  $('#nlBody').innerHTML = html;
}
// Join/part floods fire hundreds of events: rebuild at most every 150 ms,
// stretching towards 1 s for very large channels.
let nlTimer = 0;
function scheduleNicklist() {
  if (nlTimer) return;
  const delay = Math.min(1000, 150 + (activeBuf()?.nicks.size || 0) / 8);
  nlTimer = setTimeout(() => requestAnimationFrame(() => { nlTimer = 0; renderNicklist(); }), delay);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Popovers (nick actions, join)
   ═══════════════════════════════════════════════════════════════════════════ */
let popEl = null;
function closePopover() { if (popEl) { popEl.remove(); popEl = null; overlaysClosed(); } }
function openPopover(anchor, html) {
  closePopover();
  const p = document.createElement('div');
  p.className = 'pop';
  p.innerHTML = html;
  document.body.appendChild(p);
  popEl = p;
  overlayOpened();
  if (isPhone()) { p.classList.add('sheet'); return p; }   // bottom sheet, positioned by CSS
  const r = anchor.getBoundingClientRect();
  const pr = p.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6;
  if (left + pr.width > innerWidth - 8) left = innerWidth - pr.width - 8;
  if (top + pr.height > innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
  p.style.left = Math.max(8, left) + 'px';
  p.style.top = top + 'px';
  popEl = p;
  return p;
}

function ownPrefix(b) {
  const me = b.lv.nick;
  for (const n of b.nicks.values()) if (n.name === me) return (n.prefix || '').trim();
  return '';
}

function openNickMenu(anchor, nick) {
  const b = activeBuf();
  if (!b || !nick) return;
  const n = [...b.nicks.values()].find(x => x.name === nick);
  const col = nickCss(nick, n?.color);
  const isOp = ['~', '&', '@', '%'].includes(ownPrefix(b));
  const isMe = nick === b.lv.nick;
  const role = n ? (NICK_RANKS[nickRank(n)]?.[1] || 'Member') : (b.lv.type === 'private' ? 'Private chat' : 'Not in channel');
  let html = `<div class="pop-h">${avatar(nick, col ? `color-mix(in srgb, ${col} 80%, #000)` : null)}<div style="min-width:0"><b${col ? ` style="color:${col}"` : ''}>${esc(nick)}</b><small>${esc(role.replace(/s$/, ''))}</small></div></div>`;
  html += `<button class="pop-i" data-act="mention">${ico('at')}Mention</button>`;
  if (!isMe && b.lv.plugin === 'irc') html += `<button class="pop-i" data-act="query">${ico('msg')}Private message</button>`;
  if (b.lv.plugin === 'irc') html += `<button class="pop-i" data-act="whois">${ico('info')}Whois</button>`;
  if (isOp && !isMe && b.lv.type === 'channel') {
    html += `<div class="pop-sep"></div><button class="pop-i danger" data-act="kick">${ico('kick')}Kick</button>`;
    html += `<button class="pop-i danger" data-act="kickban">${ico('ban')}Kick &amp; ban</button>`;
  }
  const p = openPopover(anchor, html);
  p.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if ((act === 'kick' || act === 'kickban') && !btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.lastChild.textContent = act === 'kick' ? `Click again to kick ${nick}` : `Click again to ban ${nick}`;
      return;
    }
    closePopover();
    if (act === 'mention') insertMention(nick);
    else if (act === 'query') { sendInput(b, '/query ' + nick); noteSwitchIntent(b, '/query ' + nick); }
    else if (act === 'whois') sendInput(b, '/whois ' + nick);
    else if (act === 'kick') sendInput(b, '/kick ' + nick);
    else if (act === 'kickban') sendInput(b, '/kickban ' + nick);
  });
}

// Buffer menu (#24): right-click, or long-press on touch screens.
function openBufferMenu(anchor, b) {
  const g = groupOf(b);
  if (!g) return;
  const i = g.items.indexOf(b), pinned = layout.pinned.includes(b.name);
  const closable = b.lv.type === 'channel' || b.lv.type === 'private' || (b.lv.plugin && b.lv.plugin !== 'core' && b.lv.plugin !== 'irc');
  const where = b.lv.server ? `${b.lv.type === 'channel' ? 'Channel' : b.lv.type === 'private' ? 'Private chat' : 'Buffer'} on ${b.lv.server}` : b.name;
  let html = `<div class="pop-h"><span class="b-ico">${bufIcon(b)}</span><div style="min-width:0"><b>${esc(bufLabel(b))}</b><small>${esc(where)}</small></div></div>`;
  html += `<button class="pop-i" data-act="pin">${ico('pin')}${pinned ? 'Unpin' : 'Pin to top'}</button>`;
  if (i > 0) html += `<button class="pop-i" data-act="up">${ico('chevUp')}Move up</button>`;
  if (i < g.items.length - 1) html += `<button class="pop-i" data-act="down">${ico('chevDown')}Move down</button>`;
  if (b.unread || b.mentions) html += `<button class="pop-i" data-act="read">${ico('checks')}Mark as read</button>`;
  if (g.key !== 'pinned' && layout.order[g.key]) html += `<button class="pop-i" data-act="reset">${ico('refresh')}Reset order of ${esc(g.key === 'core' ? 'WeeChat' : g.label)}</button>`;
  html += `<div class="pop-sep"></div><div class="pop-lbl">Notify me about</div>`;
  for (const [lvl, label] of Object.entries(NOTIFY_LEVELS)) {
    const on = notifyLevel(b) === lvl;
    html += `<button class="pop-i${on ? ' on' : ''}" data-act="notify" data-lvl="${lvl}" aria-pressed="${on}">${ico({ all: 'bell', mentions: 'at', none: 'bellOff' }[lvl])}${label}${on ? ico('check', 'pop-check') : ''}</button>`;
  }
  if (closable) html += `<div class="pop-sep"></div><button class="pop-i danger" data-act="close">${ico('x')}${b.lv.type === 'channel' ? 'Leave channel' : 'Close'}</button>`;
  const p = openPopover(anchor, html);
  p.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'close' && !btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.lastChild.textContent = b.lv.type === 'channel' ? `Tap again to leave ${bufLabel(b)}` : 'Tap again to close';
      return;
    }
    closePopover();
    if (act === 'pin') togglePin(b);
    else if (act === 'notify') setNotifyLevel(b, btn.dataset.lvl);
    else if (act === 'up') moveBuffer(b, -1);
    else if (act === 'down') moveBuffer(b, 1);
    else if (act === 'read') markBufferRead(b);
    else if (act === 'reset') resetOrder(g.key);
    else if (act === 'close') sendInput(b, '/buffer close');
  });
}

// Message menu: right-click, or long-press on touch screens.
function openMessageMenu(row) {
  const b = activeBuf();
  const l = b?.lines.find(x => String(x.id) === row.dataset.id);
  if (!l) return;
  const c = classify(l);
  const text = stripAnsi(l.message);
  const who = c.nick || stripAnsi(l.prefix).replace(/^[~&@%+]/, '').trim();
  const quote = c.kind === 'action' ? `* ${who} ${text}` : who && c.kind === 'msg' ? `<${who}> ${text}` : text;
  const links = text.match(/\bhttps?:\/\/[^\s<>"'`]+/g) || [];
  const canReply = (c.kind === 'msg' || c.kind === 'action') && c.nick && !c.self && b.lv.type === 'channel';
  let html = `<div class="pop-h"><div style="min-width:0"><b>${esc(who || 'Message')}</b><small>${esc(parseDate(l.date).toLocaleString())}</small></div></div>`;
  if (canReply) html += `<button class="pop-i" data-act="reply">${ico('msg')}Reply to ${esc(c.nick)}</button>`;
  if (text) html += `<button class="pop-i" data-act="quote">${ico('quote')}Quote</button>` +
    `<button class="pop-i" data-act="copy">${ico('copy')}Copy text</button>`;
  if (links.length) html += `<button class="pop-i" data-act="link">${ico('link')}Copy link${links.length > 1 ? 's' : ''}</button>`;
  row.classList.add('menu-on');
  const p = openPopover(row.querySelector('.tx') || row, html);
  new MutationObserver((_, o) => { if (!p.isConnected) { row.classList.remove('menu-on'); o.disconnect(); } }).observe(document.body, { childList: true });
  p.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    closePopover();
    if (act === 'reply') insertMention(c.nick);
    else if (act === 'quote') insertQuote(quote);
    else if (act === 'copy') copyText(text);
    else if (act === 'link') copyText(links.join('\n'));
  });
}
// The quote goes on its own line above whatever is being written.
function insertQuote(q) {
  const inp = $('#input');
  inp.value = `> ${q}\n` + inp.value;
  inp.focus();
  inp.selectionStart = inp.selectionEnd = inp.value.length;
  saveDraft(activeBuf(), inp.value);
  autosize(); updateSendBtn();
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: t });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    if (!ok) { toast('Could not copy to the clipboard', { error: true }); return; }
  }
  toast('Copied');
}

function insertMention(nick) {
  const inp = $('#input');
  if (!inp.value.trim()) inp.value = nick + ': ';
  else inp.value = inp.value.replace(/\s*$/, ' ') + nick + ' ';
  inp.focus();
  inp.selectionStart = inp.selectionEnd = inp.value.length;
  autosize(); updateSendBtn();
}

function openJoinPopover(anchor, serverBuf) {
  const p = openPopover(anchor, `<form><label for="joinIn">Join a channel on ${esc(serverBuf.lv.server || serverBuf.short_name)}</label>` +
    `<input id="joinIn" class="input" placeholder="#channel" autocomplete="off" spellcheck="false"><button class="btn primary" type="submit">Join</button></form>`);
  const inp = $('#joinIn', p);
  inp.focus();
  $('form', p).addEventListener('submit', e => {
    e.preventDefault();
    const ch = inp.value.trim();
    if (!ch) return;
    closePopover();
    const cmd = '/join ' + ch;
    sendInput(serverBuf, cmd);
    noteSwitchIntent(serverBuf, cmd);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Composer
   ═══════════════════════════════════════════════════════════════════════════ */
function autosize() {
  const t = $('#input');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, innerHeight * 0.4) + 'px';
}
function updateSendBtn() { $('#btnSend').disabled = !$('#input').value.trim() || !S.connected; }

function submitInput() {
  const b = activeBuf();
  const inp = $('#input');
  const text = inp.value;
  if (!b || !text.trim()) return;
  if (!S.connected) { toast('Not connected', { error: true }); return; }
  // Each line becomes its own message; make big pastes a deliberate choice.
  const lines = b.input_multiline ? [text] : text.split('\n').filter(l => l.trim());
  if (lines.length > PASTE_CONFIRM_LINES && S.confirmPaste !== text) {
    S.confirmPaste = text;
    const where = b.lv.type === 'channel' || b.lv.type === 'private' ? ' to ' + esc(b.short_name) : '';
    setHint(`<span class="paste-warn">${ico('info', 'i-sm')}<span>This sends <b>${lines.length} separate messages</b>${where}. Press <kbd>Enter</kbd> again to send, <kbd>Esc</kbd> to cancel.</span></span>`);
    return;
  }
  if (S.history[0] !== text) S.history.unshift(text);
  S.history.length = Math.min(S.history.length, 200);
  saveHistory();
  S.histPos = -1;
  S.confirmPaste = null;
  for (const line of lines) sendInput(b, line);
  noteSwitchIntent(b, text.trim());
  inp.value = '';
  saveDraft(b, '');
  S.comp = null;
  setHint('');
  autosize(); updateSendBtn();
  scrollToBottom();
}

const PASTE_CONFIRM_LINES = 3;
function saveHistory() {
  if (settings.saveHistory) store.set('history', S.history.filter(h => !isSecret(h)).slice(0, 100));
  else store.del('history');
}
function cancelPasteConfirm() {
  if (S.confirmPaste == null) return false;
  S.confirmPaste = null;
  setHint('');
  return true;
}

function setHint(html) { $('#composerHint').innerHTML = html; }

async function tabComplete(dir) {
  const b = activeBuf();
  const inp = $('#input');
  if (!b || !S.connected) return;
  const c = S.comp;
  if (c && inp.value === c.applied) {
    c.i = (c.i + dir + c.list.length) % c.list.length;
    applyCompletion();
    return;
  }
  const text = inp.value, pos = inp.selectionStart;
  if (!text.slice(0, pos).trim()) return;
  let r;
  try { r = await request('POST', '/api/completion', { buffer_name: b.name, command: text, position: pos }); }
  catch { return; }
  const body = r.body;
  if (!body || !body.list?.length || inp.value !== text) return;
  S.comp = {
    list: body.list, i: dir > 0 ? 0 : body.list.length - 1,
    before: text.slice(0, body.position_replace), after: text.slice(pos),
    addSpace: body.add_space,
  };
  applyCompletion();
}
function applyCompletion() {
  const c = S.comp, inp = $('#input');
  const w = c.list[c.i];
  const head = c.before + w + (c.addSpace && !c.after.startsWith(' ') ? ' ' : '');
  inp.value = head + c.after;
  inp.selectionStart = inp.selectionEnd = head.length;
  c.applied = inp.value;
  autosize(); updateSendBtn();
  if (c.list.length > 1) {
    const start = clamp(c.i - 4, 0, Math.max(0, c.list.length - 9));
    const shown = c.list.slice(start, start + 9).map((x, k) => `<span class="${start + k === c.i ? 'on' : ''}">${esc(x)}</span>`).join('');
    setHint(`<div class="comp-list">${shown}${c.list.length > 9 ? `<span>+${c.list.length - 9}</span>` : ''}</div>`);
  } else setHint('');
}

function onInputKeydown(e) {
  const inp = e.target;
  if (handleBufferKey(e)) return;
  if (e.key === 'Escape' && cancelPasteConfirm()) { e.preventDefault(); return; }
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (inp.value.trim()) { e.preventDefault(); tabComplete(e.shiftKey ? -1 : 1); }
    return;
  }
  if (e.key !== 'Shift') { if (S.comp) { S.comp = null; setHint(''); } }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitInput(); return; }
  if (e.key === 'ArrowUp' && !e.altKey && !e.shiftKey && !inp.value.slice(0, inp.selectionStart).includes('\n')) {
    if (!S.history.length) return;
    e.preventDefault();
    if (S.histPos === -1) S.histDraft = inp.value;
    S.histPos = Math.min(S.histPos + 1, S.history.length - 1);
    inp.value = S.history[S.histPos];
    inp.selectionStart = inp.selectionEnd = inp.value.length;
    autosize(); updateSendBtn();
    return;
  }
  if (e.key === 'ArrowDown' && !e.altKey && !e.shiftKey && S.histPos >= 0 && !inp.value.slice(inp.selectionEnd).includes('\n')) {
    e.preventDefault();
    S.histPos--;
    inp.value = S.histPos < 0 ? S.histDraft : S.history[S.histPos];
    inp.selectionStart = inp.selectionEnd = inp.value.length;
    autosize(); updateSendBtn();
    return;
  }
  if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    const box = $('#msgs');
    box.scrollBy({ top: (e.key === 'PageUp' ? -1 : 1) * box.clientHeight * 0.85 });
  }
}

function scrollToBottom() {
  const box = $('#msgs');
  box.scrollTop = box.scrollHeight;
  S.pinned = true; S.newCount = 0;
  updateJump();
}

/* ═══════════════════════════════════════════════════════════════════════════
   File uploads — four backends:
   • Litterbox (https://litterbox.catbox.moe), tmpfiles (https://tmpfiles.org)
     and Filebin (https://filebin.net): public, anonymous, temporary.
   • Jirafeau (https://gitlab.com/jirafeau/Jirafeau), self-hosted:
   Uses script.php's chunked API (init_async → push_async… → end_async), the
   same one Jirafeau's own page uses, so files bigger than PHP's per-request
   limit work. The server must send Access-Control-Allow-Origin on script.php,
   otherwise the browser won't let this page read the responses (see README).
   ═══════════════════════════════════════════════════════════════════════════ */
const UP = { queue: [], active: null, info: null, seq: 0 };
const MIN_CHUNK = 64 * 1024;

class UploadError extends Error {}

function uploadBase() {
  let u = (settings.uploadUrl || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/[?#].*$/, '').replace(/\/(?:index|script|f)\.php$/i, '');
  return u.replace(/\/*$/, '/');
}
const PUBLIC_HOSTS = { litterbox: 'Litterbox', tmpfiles: 'tmpfiles.org', filebin: 'Filebin' };
function uploadsEnabled() {
  return !!PUBLIC_HOSTS[settings.uploadBackend] || (settings.uploadBackend === 'jirafeau' && !!uploadBase());
}
function uploadHost() {
  if (PUBLIC_HOSTS[settings.uploadBackend]) return PUBLIC_HOSTS[settings.uploadBackend];
  if (settings.uploadBackend !== 'jirafeau') return '';
  try { return new URL(uploadBase()).host; } catch { return ''; }
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + units[i];
}
const safeFileName = name => String(name).replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';

function corsError(url) {
  let host = url;
  try { host = new URL(url).host; } catch {}
  const origin = location.origin === 'null' ? 'file://' : location.origin;
  return new UploadError(`Can't talk to the upload server at ${host}. Check the URL, and that the server allows this page (${origin}) with an Access-Control-Allow-Origin header on script.php — see the README.`);
}

// XHR rather than fetch: it reports upload progress. Note that listening for
// upload progress turns the request into a CORS "preflighted" one: servers
// that don't answer OPTIONS with a 2xx (Litterbox replies 405) then block it,
// so only pass onProgress for servers known to handle preflight.
function xhrPost(url, fields, opts) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (Array.isArray(v)) fd.append(k, v[0], v[1]); else fd.append(k, v);
  }
  return xhrSend(url, fd, opts);
}
function xhrSend(url, body, { onProgress, up } = {}) {
  return new Promise((resolve, reject) => {
    if (up?.cancelled) return reject(new DOMException('Upload cancelled', 'AbortError'));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (onProgress) xhr.upload.onprogress = e => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(corsError(url));   // network failure and CORS block look the same
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    if (up) up.xhr = xhr;
    xhr.send(body);
  });
}

async function jirafeauInfo(base) {
  if (UP.info?.base === base) return UP.info;
  const get = q => fetch(`${base}script.php?${q}`, { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)));
  let cap, max, ver;
  try { [cap, max, ver] = await Promise.all(['get_capacity', 'get_maximal_upload_size', 'get_version'].map(get)); }
  catch { throw corsError(base); }
  if (!/^\d+\.\d+/.test(ver.trim())) throw new UploadError(`${new URL(base).host} doesn't look like a Jirafeau server.`);
  UP.info = { base, capacity: parseInt(cap, 10) || 0, maxMB: parseFloat(max) || 0, version: ver.trim() };
  return UP.info;
}

const JIRAFEAU_ERRORS = [
  [/^Error (2|19)\b/, () => 'The upload server needs an upload password. Set it in Settings → File uploads.'],
  [/^Error (3|20)\b/, () => 'The upload server rejected the upload password.'],
  [/^Error (4|22)\b/, () => `The upload server doesn't allow keeping files for "${settings.uploadTime}". Pick another duration in Settings → File uploads.`],
  [/^Error 26\b/, () => 'One-time downloads are disabled on the upload server. Turn off "Delete after first download".'],
  [/^Error 1[34]\b/, () => 'The upload server requires a download password, which Weave doesn\'t support.'],
  [/above upload limit/i, () => 'The file is larger than the upload server allows.'],
];
function jirafeauCheck(text) {
  const t = text.trim();
  if (!/^Error/i.test(t)) return t;
  const hit = JIRAFEAU_ERRORS.find(([re]) => re.test(t));
  throw new UploadError(hit ? hit[1]() : 'Upload server: ' + t);
}

async function jirafeauUpload(up) {
  const base = uploadBase();
  const info = await jirafeauInfo(base);
  const f = up.file;
  if (info.maxMB > 0 && f.size > info.maxMB * 1048576) {
    throw new UploadError(`${f.name} is ${fmtSize(f.size)}; the upload server accepts up to ${info.maxMB} MB.`);
  }
  const api = action => `${base}script.php?${action}`;
  const init = await xhrPost(api('init_async'), {
    filename: f.name,
    type: f.type || 'application/octet-stream',
    time: settings.uploadTime || 'day',
    upload_password: settings.uploadPassword || null,
    one_time_download: settings.uploadOneTime ? '1' : null,
  }, { up });
  let [ref, code] = jirafeauCheck(init.text).split('\n').map(s => s.trim());
  // Stay under PHP's per-request limit; multipart framing adds a little.
  let chunk = Math.max(MIN_CHUNK, Math.floor((info.capacity || 2 * 1048576) * 0.9));
  let off = 0;
  do {
    const blob = f.slice(off, off + chunk);
    const res = await xhrPost(api('push_async'), { ref, code, data: [blob, f.name] }, { up, onProgress: n => setUploadProgress(up, off + n) });
    // The real limit can be lower than advertised (post_max_size, a proxy):
    // PHP then drops the body ("Error 23") or flags it — retry with smaller chunks.
    const tooBig = res.status === 413 || /upload error|^Error 23\b/i.test(res.text.trim());
    if (tooBig && chunk > MIN_CHUNK) { chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2)); setUploadProgress(up, off); continue; }
    if (res.status >= 400) throw new UploadError(`Upload server returned HTTP ${res.status}.`);
    code = jirafeauCheck(res.text);
    off += blob.size;
    setUploadProgress(up, off);
  } while (off < f.size);
  const end = await xhrPost(api('end_async'), { ref, code }, { up });
  const [hash, del, key = ''] = jirafeauCheck(end.text).split('\n').map(s => s.trim());
  const h = 'h=' + encodeURIComponent(hash);
  const k = key ? '&k=' + key : '';   // the server already URL-encodes the key
  const viewable = (/^(image|video|audio)\//.test(f.type) && !/svg/i.test(f.type)) || f.type === 'text/plain';
  // For previewable files link Jirafeau's inline view, with the file name in
  // the fragment: readers see what it is, and chat clients spot media by extension.
  const url = `${base}f.php?${h}${k}` + (viewable ? `&p=1#${safeFileName(f.name)}` : '');
  return { name: f.name, size: f.size, url, deleteUrl: `${base}f.php?${h}&d=${encodeURIComponent(del)}`, at: Date.now() };
}

// Litterbox: one multipart POST, the response body is the file URL (or an
// error message with a non-200 status). It sends Access-Control-Allow-Origin: *.
const LITTERBOX = {
  api: 'https://litterbox.catbox.moe/resources/internals/api.php',
  maxBytes: 1024 ** 3,
  hours: { '1h': 1, '12h': 12, '24h': 24, '72h': 72 },
};
async function litterboxUpload(up) {
  const f = up.file;
  if (f.size > LITTERBOX.maxBytes) throw new UploadError(`${f.name} is ${fmtSize(f.size)}; Litterbox accepts up to 1 GB.`);
  const time = LITTERBOX.hours[settings.litterboxTime] ? settings.litterboxTime : '24h';
  // No progress listener: Litterbox answers the CORS preflight that would
  // trigger with 405, and the browser then blocks the upload.
  up.indeterminate = true;
  renderUploads();
  let res;
  try {
    res = await xhrPost(LITTERBOX.api, { reqtype: 'fileupload', time, fileToUpload: [f, f.name] }, { up });
  } catch (e) {
    if (e instanceof UploadError) throw new UploadError('Couldn\'t reach Litterbox. Check your connection, and whether a content or ad blocker is blocking catbox.moe.');
    throw e;
  }
  const text = res.text.trim();
  if (res.status === 403) {
    throw new UploadError('Litterbox refused the upload (HTTP 403). Its firewall may be blocking your network for a while; try again later or use another service.');
  }
  if (res.status !== 200 || !/^https:\/\/\S+$/.test(text)) {
    throw new UploadError(`Litterbox: ${text && text.length < 200 && !text.startsWith('<') ? text : 'HTTP ' + res.status}`);
  }
  setUploadProgress(up, f.size);
  return { service: 'litterbox', name: f.name, size: f.size, url: text, deleteUrl: null, at: Date.now(), expires: Date.now() + LITTERBOX.hours[time] * 3600000 };
}

const parseJSON = text => { try { return JSON.parse(text); } catch { return null; } };
const shortReply = (text, status) => text && text.length < 200 && !/^\s*</.test(text) ? text.trim() : 'HTTP ' + status;
const unreachable = host => new UploadError(`Couldn't reach ${host}. Check your connection, and whether a content or ad blocker is blocking it.`);

// tmpfiles.org: multipart POST of "file" plus "expire" (seconds, up to 48 h),
// answered with JSON. It handles the CORS preflight, so progress works. The
// returned URL is the file's page: its direct link is signed and short-lived.
const TMPFILES = {
  api: 'https://tmpfiles.org/api/v1/upload',
  maxBytes: 100 * 1024 ** 2,
  hours: { '1h': 1, '6h': 6, '24h': 24, '48h': 48 },
};
async function tmpfilesUpload(up) {
  const f = up.file;
  if (f.size > TMPFILES.maxBytes) throw new UploadError(`${f.name} is ${fmtSize(f.size)}; tmpfiles.org accepts up to 100 MB.`);
  const hours = TMPFILES.hours[settings.tmpfilesTime] || 1;
  let res;
  try {
    res = await xhrPost(TMPFILES.api, { file: [f, f.name], expire: String(hours * 3600) }, { up, onProgress: n => setUploadProgress(up, n) });
  } catch (e) {
    if (e instanceof UploadError) throw unreachable('tmpfiles.org');
    throw e;
  }
  const j = parseJSON(res.text);
  const url = j?.status === 'success' && j.data?.url;
  if (res.status !== 200 || !/^https:\/\/tmpfiles\.org\/\S+$/.test(url || '')) {
    if (res.status === 413) throw new UploadError(`${f.name} is larger than tmpfiles.org allows.`);
    throw new UploadError(`tmpfiles.org: ${j?.message || j?.error || shortReply(res.text, res.status)}`);
  }
  setUploadProgress(up, f.size);
  return { service: 'tmpfiles', name: f.name, size: f.size, url, deleteUrl: null, at: Date.now(), expires: Date.now() + hours * 3600000 };
}

// Filebin: the raw file is POSTed to /<bin>/<name>; the bin is created on the
// fly. Every upload gets its own random bin, since anyone who knows a bin's
// address can see and delete everything in it. Its preflight answer allows no
// extra headers, so the body goes as an untyped Blob (no Content-Type) —
// Filebin detects the type itself. Deleting needs a DELETE request, which the
// preflight doesn't allow either, so Weave links to the bin's page for that.
const FILEBIN = { base: 'https://filebin.net/' };
function randomBinName() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return 'weave' + [...crypto.getRandomValues(new Uint8Array(16))].map(b => abc[b % abc.length]).join('');
}
async function filebinUpload(up) {
  const f = up.file;
  const bin = randomBinName(), name = safeFileName(f.name);
  const url = `${FILEBIN.base}${bin}/${encodeURIComponent(name)}`;
  let res;
  try {
    res = await xhrSend(url, new Blob([f]), { up, onProgress: n => setUploadProgress(up, n) });
  } catch (e) {
    if (e instanceof UploadError) throw unreachable('Filebin');
    throw e;
  }
  if (res.status !== 201 && res.status !== 200) {
    const why = { 403: 'Filebin doesn\'t accept this file type or content.', 413: `${f.name} is larger than Filebin allows.`, 507: 'Filebin is out of space right now. Try again later.' }[res.status];
    throw new UploadError(why || `Filebin: ${shortReply(res.text, res.status)}`);
  }
  const j = parseJSON(res.text);
  const expires = Date.parse(j?.bin?.expired_at) || Date.now() + 6 * 86400000;
  setUploadProgress(up, f.size);
  return { service: 'filebin', name: f.name, size: f.size, url, deleteUrl: null, manageUrl: FILEBIN.base + bin, at: Date.now(), expires };
}

const UPLOADERS = { litterbox: litterboxUpload, tmpfiles: tmpfilesUpload, filebin: filebinUpload, jirafeau: jirafeauUpload };

function queueUploads(files, buf = activeBuf()) {
  if (!files.length) return;
  if (!uploadsEnabled()) {
    toast('File uploads are off. Turn them on in Settings → File uploads.', { error: true });
    openSettings('uploads');
    return;
  }
  if (!buf) return;
  for (const file of files) UP.queue.push({ id: ++UP.seq, file, bufId: buf.id, bufName: buf.name, loaded: 0 });
  renderUploads();
  pumpUploads();
}

async function pumpUploads() {
  if (UP.active || !UP.queue.length) return;
  const up = UP.active = UP.queue.shift();
  renderUploads();
  try {
    const res = await (UPLOADERS[settings.uploadBackend] || jirafeauUpload)(up);
    const recent = store.get('uploads', []);
    recent.unshift(res);
    store.set('uploads', recent.slice(0, 20));
    deliverUploadLink(up, res);
  } catch (e) {
    if (e.name !== 'AbortError') {
      toast(e instanceof UploadError ? e.message : `Upload of ${up.file.name} failed: ${e.message}`, { error: true, ms: 10000 });
    }
  } finally {
    UP.active = null;
    renderUploads();
    pumpUploads();
  }
}

function cancelUpload(id) {
  if (UP.active?.id === id) { UP.active.cancelled = true; UP.active.xhr?.abort(); }
  else UP.queue = UP.queue.filter(u => u.id !== id);
  renderUploads();
}

function deliverUploadLink(up, res) {
  const b = S.buffers.get(up.bufId) || [...S.buffers.values()].find(x => x.name === up.bufName);
  if (!b) { toast(`Uploaded ${res.name}: ${res.url}`, { ms: 15000 }); return; }
  if (settings.uploadAction === 'send' && S.connected) { sendInput(b, res.url); return; }
  if (b.id === S.active) insertIntoInput(res.url);
  else {
    saveDraft(b, (b.draft ? b.draft.replace(/\s*$/, ' ') : '') + res.url + ' ');
    toast(`Link to ${res.name} added to your draft in ${b.short_name || b.name}`);
  }
}

function insertIntoInput(text) {
  const inp = $('#input');
  const s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? s;
  const before = inp.value.slice(0, s), after = inp.value.slice(e);
  const head = before + (before && !/\s$/.test(before) ? ' ' : '') + text + (/^\s/.test(after) ? '' : ' ');
  inp.value = head + after;
  inp.selectionStart = inp.selectionEnd = head.length;
  inp.focus();
  autosize(); updateSendBtn();
}

function renderUploads() {
  const list = [UP.active, ...UP.queue].filter(Boolean);
  const box = $('#uploads');
  box.hidden = !list.length;
  box.innerHTML = list.map(u => {
    const active = u === UP.active;
    const pct = u.file.size ? Math.round(u.loaded / u.file.size * 100) : 100;
    const b = S.buffers.get(u.bufId);
    const dest = b && b.id !== S.active ? ` → ${esc(b.short_name || b.name)}` : '';
    return `<div class="up" data-up="${u.id}">${ico('clip', 'i-sm')}` +
      `<span class="up-name" title="${esc(u.file.name)}">${esc(u.file.name)}</span>` +
      `<span class="up-meta">${fmtSize(u.file.size)}${dest}</span>` +
      `<span class="up-bar${active && u.indeterminate ? ' indet' : ''}"><i style="width:${active ? pct : 0}%"></i></span>` +
      `<span class="up-pct">${!active ? 'Queued' : u.indeterminate ? 'Uploading…' : pct + '%'}</span>` +
      `<button class="icon-btn up-x" type="button" data-cancel-up="${u.id}" title="Cancel">${ico('x', 'i-sm')}</button></div>`;
  }).join('');
}

function setUploadProgress(up, loaded) {
  up.loaded = Math.min(loaded, up.file.size);
  if (up.indeterminate) return;
  const row = $(`#uploads [data-up="${up.id}"]`);
  if (!row) return;
  const pct = up.file.size ? Math.round(up.loaded / up.file.size * 100) : 100;
  $('.up-bar i', row).style.width = pct + '%';
  $('.up-pct', row).textContent = pct + '%';
}

// Clipboard images arrive as "image.png"; give them a unique, dated name.
function renamePasted(f) {
  if (!/^image\.\w+$/i.test(f.name) && f.name) return f;
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const ext = (f.type.split('/')[1] || 'bin').replace(/[^\w]/g, '');
  return new File([f], `pasted-${stamp}.${ext}`, { type: f.type });
}

async function testUploadServer() {
  if (settings.uploadBackend !== 'jirafeau') return;
  const s = $('#upStatus');
  const base = uploadBase();
  if (!base) { s.innerHTML = '<span class="muted">Uploads are off — no server set.</span>'; return; }
  s.innerHTML = '<span class="muted">Checking…</span>';
  UP.info = null;
  try {
    const i = await jirafeauInfo(base);
    s.innerHTML = `<span class="ok-txt">Jirafeau ${esc(i.version)}</span> <span class="muted">· up to ${i.maxMB ? i.maxMB + ' MB' : 'any size'} per file</span>`;
  } catch (e) { s.innerHTML = `<span class="err-txt">${esc(e.message)}</span>`; }
}

function renderRecentUploads() {
  const list = store.get('uploads', []).slice(0, 10);
  const hints = [];
  if (list.some(u => u.deleteUrl)) hints.push('"Delete…" opens Jirafeau\'s delete page.');
  if (list.some(u => u.manageUrl)) hints.push('"Manage…" opens the file\'s Filebin bin, where it can be deleted.');
  $('#recentHint').textContent = hints.join(' ');
  $('#recentHint').hidden = !hints.length;
  $('#recentUploads').innerHTML = list.length ? list.map(u => {
    const link = (cls, href, label) => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    const tail = u.deleteUrl ? link('ru-del', u.deleteUrl, 'Delete…')
      : (u.expires ? `<span class="ru-exp">${esc(expiryText(u.expires))}</span>` : '') + (u.manageUrl ? link('ru-man', u.manageUrl, 'Manage…') : '');
    return `<div class="ru"><a class="ru-name" href="${esc(u.url)}" target="_blank" rel="noopener noreferrer" title="${esc(u.name)}">${esc(u.name)}</a>` +
      `<span class="muted">${fmtSize(u.size)} · ${esc(new Date(u.at).toLocaleDateString())}</span>${tail}</div>`;
  }).join('') : '<span class="muted">None yet.</span>';
}

function expiryText(ts) {
  if (!ts) return '';
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins <= 0) return 'Expired';
  if (mins < 60) return `Expires in ${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `Expires in ${h} h` : `Expires in ${Math.round(h / 24)} days`;
}

function showDropZone(on) {
  $('#dropHost').textContent = on ? 'to ' + uploadHost() : '';
  $('#dropZone').hidden = !on;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quick switcher
   ═══════════════════════════════════════════════════════════════════════════ */
let swItems = [], swSel = 0;
function openSwitcher() {
  if (!S.buffers.size) return;
  const d = $('#switcherDlg');
  $('#swInput').value = '';
  renderSwitcher();
  if (!d.open) { d.showModal(); overlayOpened(); }
  $('#swInput').focus();
}
function fuzzyScore(q, s) {
  s = s.toLowerCase();
  if (!q) return 1;
  if (s.startsWith(q)) return 100 - s.length / 100;
  const i = s.indexOf(q);
  if (i >= 0) return 60 - i;
  let qi = 0, score = 0, lastHit = -2;
  for (let k = 0; k < s.length && qi < q.length; k++) {
    if (s[k] === q[qi]) { score += lastHit === k - 1 ? 3 : 1; lastHit = k; qi++; }
  }
  return qi === q.length ? score : -1;
}
function renderSwitcher() {
  const q = $('#swInput').value.trim().toLowerCase().replace(/^#/, '');
  const all = [...S.buffers.values()].filter(b => !b.hidden);
  swItems = all.map(b => {
    const label = bufLabel(b);
    const sc = Math.max(fuzzyScore(q, label), fuzzyScore(q, b.name) - 5);
    return { b, sc: sc + (q ? 0 : 0) + (b.mentions ? 20 : b.unread ? 10 : 0) };
  }).filter(x => x.sc >= 0)
    .sort((x, y) => (q ? y.sc - x.sc : 0) || (y.b.mentions - x.b.mentions) || ((y.b.unread > 0) - (x.b.unread > 0)) || x.b.number - y.b.number)
    .slice(0, 50).map(x => x.b);
  swSel = 0;
  paintSwitcher();
}
function paintSwitcher() {
  const list = $('#swList');
  if (!swItems.length) { list.innerHTML = '<div class="sw-empty">No matching buffers</div>'; return; }
  list.innerHTML = swItems.map((b, i) =>
    `<button class="sw-item${i === swSel ? ' sel' : ''}" type="button" data-i="${i}" role="option"><span class="b-ico">${bufIcon(b)}</span>` +
    `<span class="b-name">${esc(bufLabel(b))}</span><small>${esc(b.lv.server || b.lv.plugin || '')}</small>${badgeHtml(b)}</button>`).join('');
  list.children[swSel]?.scrollIntoView({ block: 'nearest' });
}
function pickSwitcher(i) {
  const b = swItems[i];
  $('#switcherDlg').close();
  if (b) activate(b.id);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Command palette (#31)
   ═══════════════════════════════════════════════════════════════════════════ */
// Help for WeeChat's built-in commands: [plugin, description, arguments],
// taken from WeeChat 4.9's own /help. The relay only gives command names
// (via completion), so scripts and aliases are listed without a description.
const CMD_HELP = {
  action: ["irc", "Send a CTCP action to a nick or channel", "[-server <server>] <target>[,<target>...] <text>"],
  admin: ["irc", "Find information about the administrator of the server", "[<target>]"],
  allbuf: ["weechat", "Execute a command on all buffers", "<command>"],
  allchan: ["irc", "Execute a command on all channels of all connected servers", "[-current] [-parted|-all] [-exclude=<channel>[,<channel>...]] <command> || [-current] [-parted|-all] [-include=<channel>[,<channel>...]] <command>"],
  allpv: ["irc", "Execute a command on all private buffers of all connected servers", "[-current] [-exclude=<nick>[,<nick>...]] <command> || [-current] [-include=<nick>[,<nick>...]] <command>"],
  allserv: ["irc", "Execute a command on all connected servers", "[-exclude=<server>[,<server>...]] <command> || [-include=<server>[,<server>...]] <command>"],
  auth: ["irc", "Authenticate with SASL", "[<username> <password>]"],
  autojoin: ["irc", "Configure the \"autojoin\" server option", "add [<channel>...] || addraw <channel1>[,<channel2>...] [<key1>[,<key2>...]] || del [<channel>...] || apply || join || sort [buffer]"],
  away: ["weechat", "Set or remove away status", "[-all] [<message>]"],
  ban: ["irc", "Ban nicks or hosts", "[<channel>] [<nick>...]"],
  bar: ["weechat", "Manage bars", "list|listfull|listitems || add|addreplace <name> <type>[,<conditions>] <position> <size> <separator> <item1>[,<item2>...] || default \u2026"],
  buffer: ["weechat", "Manage buffers", "list || add [-free] [-switch] <name> || clear [<id>|<number>|<name>|-merged|-all [<id>|<number>|<name>...]] || move <number>|-|+ || swap \u2026"],
  buflist: ["buflist", "Bar item with list of buffers", "enable|disable|toggle || bar || refresh [<item>[,<item>...]]"],
  cap: ["irc", "Client capability negotiation", "ls || list || req|ack [<capability>...] || end"],
  charset: ["charset", "Change charset for current buffer", "decode|encode <charset> || reset"],
  color: ["weechat", "Define color aliases and display palette of colors", "alias <color> <name> || unalias <color> || reset || term2rgb <color> || rgb2term <rgb> [<limit>] || -o"],
  command: ["weechat", "Launch explicit WeeChat or plugin command", "[-buffer <name>] <plugin> <command> || -s <command>[;<command>...]"],
  connect: ["irc", "Connect to IRC server(s)", "[<server>...] [-<option>[=<value>]] [-no<option>] [-nojoin] [-switch] || -all|-auto|-open [-nojoin] [-switch]"],
  ctcp: ["irc", "Send a CTCP message (Client-To-Client Protocol)", "[-server <server>] <target>[,<target>...] <type> [<arguments>]"],
  cursor: ["weechat", "Free movement of cursor on screen to execute actions on specific areas of screen", "go chat|<bar> [top_left|top_right|bottom_left|bottom_right] || go <x>,<y> || move \u2026"],
  cycle: ["irc", "Leave and rejoin a channel", "[<channel>[,<channel>...]] [<message>]"],
  dcc: ["irc", "Start a DCC (passive file transfer or direct chat)", "chat <nick> || send <nick> <file>"],
  debug: ["weechat", "Debug functions", "list || set <plugin> <level> || dump [<plugin>] || hooks [<plugin_mask> [<hook_type>...]] || \u2026"],
  dehalfop: ["irc", "Remove channel half-operator status from nick(s)", "<nick>... || * -yes"],
  deop: ["irc", "Remove channel operator status from nick(s)", "<nick>... || * -yes"],
  devoice: ["irc", "Remove voice from nick(s)", "<nick>... || * -yes"],
  die: ["irc", "Shutdown the server", "[<target>]"],
  disconnect: ["irc", "Disconnect from one or all IRC servers", "[<server>|-all|-pending [<reason>]]"],
  eval: ["weechat", "Evaluate expression", "[-n|-s] [-e] [-d] <expression> || [-n] [-d [-d]] -c <expression1> <operator> <expression2>"],
  exec: ["exec", "Execute external commands", "-list || [-sh|-nosh] [-bg|-nobg] [-stdin|-nostdin] [-buffer <name>] [-l|-o|-oc|-n|-nf] [-oerr] [-cl|-nocl] [-sw|-nosw] [-ln|-noln] [-flush|-noflush] [-color \u2026"],
  fifo: ["fifo", "Fifo plugin configuration", "enable|disable|toggle"],
  filter: ["weechat", "Filter messages in buffers, to hide/show them according to tags or regex", "list || enable|disable|toggle [<name>|<mask>|@...] || add|addreplace <name> <buffer>[,<buffer>...] <tags> <regex> || rename <name> <new_name> || recreate \u2026"],
  fset: ["fset", "Fast set WeeChat and plugins options", "-bar|-refresh|-up|-down|-left|-right|-go|-toggle|-add|-reset|-unset|-set|-setnew|-append|-mark|-format|-export|<filter>"],
  halfop: ["irc", "Give channel half-operator status to nick(s)", "<nick>... || * -yes"],
  help: ["weechat", "Display help about commands and options", "-list|-listfull [<plugin>...] || <command> || <option>"],
  history: ["weechat", "Show buffer command history", "clear || <value>"],
  hotlist: ["weechat", "Manage hotlist", "add [low|message|private|highlight] || clear [<level>] || remove || restore [-all]"],
  ignore: ["irc", "Ignore nicks/hosts from servers or channels", "list || add|addreplace [re:]<nick> [<server> [<channel>]] || del <number>|-all"],
  info: ["irc", "Get information describing the server", "[<target>]"],
  input: ["weechat", "Functions for command line", "<action> [<arguments>]"],
  invite: ["irc", "Invite a nick on a channel", "<nick>... [<channel>]"],
  ison: ["irc", "Check if a nick is currently on IRC", "<nick>..."],
  item: ["weechat", "Manage custom bar items", "list || add|addreplace <name> \"<conditions>\" \"<content>\" || rename <name> <new_name> || refresh <name>|<mask>... || recreate <name> || del <name>|<mask>..."],
  join: ["irc", "Join a channel", "[-noswitch] [-server <server>] [<channel1>[,<channel2>...]] [<key1>[,<key2>...]]"],
  key: ["weechat", "Bind/unbind keys", "[list|listdefault|listdiff] [<context>] || bind <key> [<command> [<args>]] || bindctxt <context> <key> [<command> [<args>]] || unbind <key> || unbindctxt \u2026"],
  kick: ["irc", "Kick a user out of a channel", "[<channel>] <nick> [<reason>]"],
  kickban: ["irc", "Kick a user out of a channel and ban the host", "[<channel>] <nick> [<reason>]"],
  kill: ["irc", "Close client-server connection", "<nick> [<reason>]"],
  knock: ["irc", "Send a notice to an invitation-only channel, requesting an invite", "<channel> [<message>]"],
  layout: ["weechat", "Manage buffers/windows layouts", "store [<name>] [buffers|windows] || apply [<name>] [buffers|windows] || leave || del [<name>] [buffers|windows] || rename <name> <new_name>"],
  links: ["irc", "List all server names which are known by the server answering the query", "[[<target>] <server_mask>]"],
  list: ["irc", "List channels and their topics", "[-server <server>] [<channel>[,<channel>...]] [<target>] || [-server <server>] [-raw *|<regex>] || -up|-down [<number>] || -left|-right [<percent>] || -go \u2026"],
  logger: ["logger", "Logger plugin configuration", "list || set <level> || flush || disable"],
  lua: ["lua", "List/load/unload scripts", "list|listfull [<name>] || load [-q] <filename> || autoload || reload|unload [-q] [<name>] || eval [-o|-oc] <code> || version"],
  lusers: ["irc", "Get statistics about the size of the IRC network", "[<mask> [<target>]]"],
  map: ["irc", "Show a graphical map of the IRC network", ""],
  me: ["xfer", "Send a CTCP action to remote host", "<message>"],
  me: ["irc", "Send a CTCP action to the current channel", "<message>"],
  mode: ["irc", "Change channel or user mode", "[<channel>] [+|-]o|p|s|i|t|n|m|l|b|e|v|k [<arguments>] || <nick> [+|-]i|s|w|o"],
  motd: ["irc", "Get the \"Message Of The Day\"", "[<target>]"],
  mouse: ["weechat", "Mouse control", "enable|disable|toggle [<delay>]"],
  msg: ["irc", "Send message to a nick or channel", "[-server <server>] <target>[,<target>...] <text>"],
  mute: ["weechat", "Execute a command silently", "[-core|-current|-buffer <name>] <command>"],
  names: ["irc", "List nicks on channels", "[-count | -x] [<channel>[,<channel>...]]"],
  nick: ["irc", "Change current nick", "[-all] <nick>"],
  notice: ["irc", "Send notice message to user", "[-server <server>] <target> <text>"],
  notify: ["irc", "Add a notification for presence or away status of nicks on servers", "add|addreplace <nick> [<server> [-away]] || del <nick>|-all [<server>]"],
  op: ["irc", "Give channel operator status to nick(s)", "<nick>... || * -yes"],
  oper: ["irc", "Get operator privileges", "<user> <password>"],
  part: ["irc", "Leave a channel", "[<channel>[,<channel>...]] [<message>]"],
  perl: ["perl", "List/load/unload scripts", "list|listfull [<name>] || load [-q] <filename> || autoload || reload|unload [-q] [<name>] || eval [-o|-oc] <code> || version"],
  ping: ["irc", "Send a ping to server", "<target1> [<target2>]"],
  pipe: ["weechat", "Redirect command output to a buffer, a file or a hsignal", "[-buffer <name>|-file <filename>|-hsignal <name>] [-color strip|keep|ansi] [-concat <separator>] [-strip <chars>] [-skipempty] [-c] [-o] [-g] [-nl] <command>"],
  plugin: ["weechat", "List/load/unload plugins", "list [-o|-ol|-i|-il|<name>] || listfull [<name>] || load <filename> [<arguments>] || autoload [<arguments>] || reload [<name>|* [<arguments>]] || unload \u2026"],
  pong: ["irc", "Answer to a ping message", "<daemon> [<daemon2>]"],
  print: ["weechat", "Display text on a buffer", "[-buffer <id>|<number>|<name>] [-newbuffer <name>] [-free] [-switch] [-core|-current] [-y <line>] [-escape] [-date <date>] [-tags <tags>] \u2026"],
  proxy: ["weechat", "Manage proxies", "list || add|addreplace <name> <type> <address> <port> [<username> [<password>]] || del <name>|<mask>... || set <name> <option> <value>"],
  python: ["python", "List/load/unload scripts", "list|listfull [<name>] || load [-q] <filename> || autoload || reload|unload [-q] [<name>] || eval [-o|-oc] <code> || version"],
  query: ["irc", "Send a private message to a nick", "[-noswitch] [-server <server>] <nick>[,<nick>...] [<text>]"],
  quiet: ["irc", "Quiet nicks or hosts", "[<channel>] [<nick>...]"],
  quit: ["weechat", "Quit WeeChat", "[-yes] [<arguments>]"],
  quote: ["irc", "Send raw data to server without parsing", "[-server <server>] <data>"],
  reconnect: ["irc", "Reconnect to server(s)", "<server>... [-nojoin] [-switch] || -all [-nojoin] [-switch]"],
  rehash: ["irc", "Tell the server to reload its config file", "[<option>]"],
  relay: ["relay", "Relay control", "list|listfull|listrelay || add|addreplace <name> <port>|<path> || del|start|restart|stop <name> || raw || tlscertkey"],
  reload: ["weechat", "Reload configuration files from disk", "[<file>...]"],
  remote: ["relay", "Control of remote relay servers", "list|listfull [<name>] || add|addreplace <name> <url> [-<option>[=<value>]] || connect|reconnect|disconnect|del <name> || send <name> <json> || rename \u2026"],
  remove: ["irc", "Force a user to leave a channel", "[<channel>] <nick> [<reason>]"],
  repeat: ["weechat", "Execute a command several times", "[-interval <delay>[<unit>]] <count> <command>"],
  reset: ["weechat", "Reset config options", "<option> || -mask <option>"],
  restart: ["irc", "Tell the server to restart itself", "[<target>]"],
  rules: ["irc", "Request the server rules", ""],
  sajoin: ["irc", "Force a user to join channel(s)", "<nick> <channel>[,<channel>...]"],
  samode: ["irc", "Change mode on channel, without having operator status", "[<channel>] <mode>"],
  sanick: ["irc", "Force a user to use another nick", "<nick> <new_nick>"],
  sapart: ["irc", "Force a user to leave channel(s)", "<nick> <channel>[,<channel>...]"],
  saquit: ["irc", "Force a user to quit server with a reason", "<nick> <reason>"],
  save: ["weechat", "Save configuration files to disk", "[<file>...]"],
  script: ["script", "WeeChat script manager", "list|search|show|load|unload|reload|autoload|noautoload|install|remove|installremove|hold|update|upgrade"],
  secure: ["weechat", "Manage secured data (passwords or private data encrypted in file sec.conf)", "passphrase <passphrase>|-delete || decrypt <passphrase>|-discard || set <name> <value> || del <name>"],
  server: ["irc", "List, add or remove IRC servers", "list|listfull [-connected] [<name>] || add|addreplace <name> <hostname>[/<port>] [-<option>[=<value>]] [-no<option>] || copy|rename <name> <new_name> || \u2026"],
  service: ["irc", "Register a new service", "<nick> <reserved> <distribution> <type> <reserved> <info>"],
  servlist: ["irc", "List services currently connected to the network", "[<mask> [<type>]]"],
  set: ["weechat", "Set config options and environment variables", "[<option> [<value>]] || diff [<option>...] || env [<variable> [<value>]]"],
  setname: ["irc", "Set real name", "<realname>"],
  spell: ["spell", "Spell plugin configuration", "enable|disable|toggle || listdict || setdict -|<dict>[,<dict>...] || deldict || addword [<dict>] <word>"],
  squery: ["irc", "Deliver a message to a service", "<service> <text>"],
  squit: ["irc", "Disconnect server links", "<target> <comment>"],
  stats: ["irc", "Query statistics about server", "[<query> [<target>]]"],
  summon: ["irc", "Give users who are on a host running an IRC server a message asking them to please join IRC", "<user> [<target> [<channel>]]"],
  sys: ["weechat", "System actions", "get rlimit|rusage || malloc_trim [<size>] || suspend || waitpid <number>"],
  time: ["irc", "Query local time from server", "[<target>]"],
  toggle: ["weechat", "Toggle value of a config option", "<option> [<value>...]"],
  topic: ["irc", "Get/set channel topic", "[<channel>] [<topic>|-delete]"],
  trace: ["irc", "Find the route to specific server", "[<target>]"],
  trigger: ["trigger", "Manage triggers, the Swiss Army knife for WeeChat", "list [-o|-ol|-i|-il] || listfull || listdefault || add|addoff|addreplace <name> <hook> [\"<arguments>\" [\"<conditions>\" [\"<regex>\" [\"<command>\" \u2026"],
  unban: ["irc", "Unban nicks or hosts", "[<channel>] <nick>|<number>|<n1>-<n2>..."],
  unquiet: ["irc", "Unquiet nicks or hosts", "[<channel>] <nick>|<number>|<n1>-<n2>..."],
  unset: ["weechat", "Unset/reset config options", "<option> || -mask <option>"],
  upgrade: ["weechat", "Save WeeChat session and reload the WeeChat binary without disconnecting from servers", "[-yes] [<path_to_binary>|-save|-quit] || -o|-ol"],
  uptime: ["weechat", "Show WeeChat uptime", "[-o|-ol]"],
  userhost: ["irc", "Return a list of information about nicks", "<nick>..."],
  users: ["irc", "List of users logged into the server", "[<target>]"],
  version: ["weechat", "Show WeeChat version and compilation date", "[-o|-ol] [-v]"],
  version: ["irc", "Give the version info of nick or server (current or specified)", "[<target>|<nick>]"],
  voice: ["irc", "Give voice to nick(s)", "<nick>... || * -yes"],
  wait: ["weechat", "Schedule a command execution in future", "<number>[<unit>] <command>"],
  wallchops: ["irc", "Send a notice to channel ops", "[<channel>] <text>"],
  wallops: ["irc", "Send a message to all currently connected users who have set the \"w\" user mode for themselves", "<text>"],
  who: ["irc", "Generate a query which returns a list of information", "[<mask> [o]]"],
  whois: ["irc", "Query information about user(s)", "[<target>] [<nick>[,<nick>...]]"],
  whowas: ["irc", "Ask for information about a nick which no longer exists", "<nick>[,<nick>...] [<count> [<target>]]"],
  window: ["weechat", "Manage windows", "list || -1|+1|b#|up|down|left|right [-window <number>] || <number> || splith|splitv [-window <number>] [<pct>] || resize [-window <number>] [h|v][+|-]<pct> \u2026"],
  xfer: ["xfer", "Xfer control", "[list|listfull]"],
};
let palItems = [], palSel = 0;
async function openPalette() {
  if (!S.connected) return;
  const d = $('#paletteDlg');
  $('#palInput').value = '';
  if (!S.cmdNames) {
    S.cmdNames = Object.keys(CMD_HELP);
    const b = activeBuf();
    if (b) request('POST', '/api/completion', { buffer_name: b.name, command: '/', position: 1 })
      .then(r => { if (r.body?.list?.length) { S.cmdNames = r.body.list.map(c => c.replace(/^\//, '')); if (d.open) renderPalette(); } })
      .catch(() => {});
  }
  renderPalette();
  if (!d.open) { d.showModal(); overlayOpened(); }
  $('#palInput').focus();
}
function renderPalette() {
  const q = $('#palInput').value.trim().toLowerCase().replace(/^\//, '');
  palItems = [...new Set(S.cmdNames)].map(c => {
    const h = CMD_HELP[c];
    const sc = Math.max(fuzzyScore(q, c), h && q && h[1].toLowerCase().includes(q) ? 10 : -1);
    return { c, h, sc };
  }).filter(x => x.sc >= 0)
    .sort((x, y) => (y.sc - x.sc) || (!!y.h - !!x.h) || (x.c < y.c ? -1 : 1))
    .slice(0, 80);
  palSel = 0;
  paintPalette();
}
function paintPalette() {
  const list = $('#palList');
  list.innerHTML = palItems.length ? palItems.map(({ c, h }, i) =>
    `<button class="sw-item pal-item${i === palSel ? ' sel' : ''}" type="button" data-i="${i}" role="option">` +
    `<span class="pal-cmd">/${esc(c)}</span><span class="pal-desc">${esc(h ? h[1] : '')}</span>` +
    (h && h[0] !== 'weechat' ? `<small>${esc(h[0])}</small>` : '') + `</button>`).join('')
    : '<div class="sw-empty">No matching commands</div>';
  list.children[palSel]?.scrollIntoView({ block: 'nearest' });
  const cur = palItems[palSel];
  $('#palArgs').innerHTML = cur ? `<b>/${esc(cur.c)}</b> ${esc(cur.h?.[2] || '')}` : '';
}
// Puts "/cmd " in the message box, in front of anything already typed there
// that isn't a command ("hello" → "/me hello").
function pickPalette(i) {
  const it = palItems[i];
  $('#paletteDlg').close();
  if (!it) return;
  const inp = $('#input');
  const rest = inp.value.startsWith('/') ? '' : inp.value;
  inp.value = `/${it.c} ${rest}`;
  inp.focus();
  inp.selectionStart = inp.selectionEnd = it.c.length + 2;
  saveDraft(activeBuf(), inp.value);
  autosize(); updateSendBtn();
}
// Full help goes to the WeeChat core buffer, as in the terminal.
function paletteHelp(i) {
  const it = palItems[i];
  if (!it) return;
  $('#paletteDlg').close();
  const core = [...S.buffers.values()].find(b => b.name === 'core.weechat');
  sendInput({ name: 'core.weechat' }, '/help ' + it.c);
  if (core) activate(core.id);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Notifications, title, favicon
   ═══════════════════════════════════════════════════════════════════════════ */
function notify(b, line) {
  const isPriv = b.lv.type === 'private';
  const who = stripAnsi(line.prefix).replace(/^[~&@%+]/, '').trim();
  const title = isPriv ? who : `${who} in ${b.short_name || b.name}`;
  // While you're using the app, a clickable in-app toast is enough; system
  // notifications are for when the app is in the background.
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    const t = toast(stripAnsi(line.message).slice(0, 140), { title, ms: 6000, onClick: () => activate(b.id) });
    t.dataset.buf = b.id;
    return;
  }
  if (!settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body: stripAnsi(line.message).slice(0, 240), tag: 'weave-' + b.id, icon: faviconData(true) });
    n.onclick = () => { window.focus(); activate(b.id); n.close(); };
    n.onclose = () => { if (liveNotes.get(b.id) === n) liveNotes.delete(b.id); };
    liveNotes.set(b.id, n);   // one per buffer: the tag replaces the previous one
  } catch {}
}
// Notifications are dismissed once you open their buffer (or mute it).
const liveNotes = new Map();
function closeNotifications(b) {
  const n = liveNotes.get(b.id);
  if (n) { liveNotes.delete(b.id); try { n.close(); } catch {} }
  $$(`#toasts .toast[data-buf="${CSS.escape(b.id)}"]`).forEach(t => t.remove());
}
function totalMentions() { let n = 0; for (const b of S.buffers.values()) n += b.mentions; return n; }
function titleText() {
  const m = totalMentions();
  const b = activeBuf();
  return (m ? `(${m}) ` : '') + (b ? `${b.short_name || b.name} · ` : '') + 'Weave';
}
function updateTitle() { document.title = titleText(); updateFavicon(); }
function faviconData(alert) {
  const accent = cssVar('--accent') || ACCENTS.indigo;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${LOGO_SVG.replace('var(--accent)', accent)}` +
    (alert ? '<circle cx="26" cy="6" r="5.5" fill="#f2555a" stroke="#fff" stroke-width="1.5"/>' : '') + '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
let lastFavicon = '';
function updateFavicon() {
  const href = faviconData(totalMentions() > 0);
  if (href !== lastFavicon) { $('#favicon').href = href; lastFavicon = href; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Screens, status, drawers
   ═══════════════════════════════════════════════════════════════════════════ */
function showScreen(name) {
  $('#connectScreen').hidden = name !== 'connect';
  $('#chatScreen').hidden = name !== 'chat';
}
function setConnecting(on) {
  const b = $('#cSubmit');
  b.disabled = on;
  b.innerHTML = on ? '<span class="spinner"></span>Connecting…' : 'Connect';
}
function setConnStatus(kind, label, sub) {
  $('#connDot').className = 'dot ' + (kind || '');
  $('#connLabel').textContent = label;
  if (sub !== undefined) $('#connSub').textContent = sub;
  updateSendBtn();
}
function showBanner(text, { login = false } = {}) {
  const bn = $('#banner');
  if (!text) { bn.hidden = true; return; }
  $('#bannerText').textContent = text;
  $('#bannerLogin').hidden = !login;
  bn.hidden = false;
}
function closeDrawers() {
  $('#sidebar').classList.remove('open');
  $('#nicklist').classList.remove('open');
  $('#scrim').hidden = true;
  $('#btnMembers').classList.toggle('on', matchMedia('(min-width: 1081px)').matches && !$('#nicklist').hidden);
  overlaysClosed();
}
function openDrawer(which) {
  closePopover();
  $('#sidebar').classList.remove('open');
  $('#nicklist').classList.remove('open');
  $(which).classList.add('open');
  $('#scrim').hidden = false;
  if (which === '#nicklist') { $('#btnMembers').classList.add('on'); if (S.nlDirty) renderNicklist(); }
  overlayOpened();
}
function renderAbout() {
  const v = S.version;
  $('#verLabel').textContent = v ? 'WeeChat ' + v.weechat_version : '';
  $('#aboutText').innerHTML = `Weave — a self-contained web client for the WeeChat API relay.<br>` +
    (PUBLIC ? `Served by <b>${esc(location.host || 'this site')}</b>, which stores nothing: settings, drafts and history stay in this browser, and it connects straight to your relay.<br>` : '') +
    (v ? `Connected to WeeChat <b>${esc(v.weechat_version)}</b>, relay API <b>${esc(v.relay_api_version)}</b>.` : 'Not connected.');
}

/* ═══════════════════════════════════════════════════════════════════════════
   Settings dialog
   ═══════════════════════════════════════════════════════════════════════════ */
function openSettings(section) {
  syncSettingsUI();
  renderAbout();
  renderInstallRow();
  renderRecentUploads();
  const d = $('#settingsDlg');
  if (!d.open) { d.showModal(); overlayOpened(); }
  if (settings.uploadBackend === 'jirafeau') testUploadServer();
  if (section === 'uploads') { const body = $('#settingsDlg .dlg-b'); body.scrollTop = $('#setUploads').offsetTop - body.offsetTop; }
}

function syncSettingsUI() {
  $$('#settingsDlg [data-setting]').forEach(el => {
    const k = el.dataset.setting;
    if (el.classList.contains('seg')) $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(settings[k])));
    else if (el.type === 'checkbox') el.checked = !!settings[k];
    else if (el.matches('input, select') && document.activeElement !== el) el.value = settings[k] ?? '';
  });
  $('#upJirafeau').hidden = settings.uploadBackend !== 'jirafeau';
  $('#upLitterbox').hidden = settings.uploadBackend !== 'litterbox';
  $('#upTmpfiles').hidden = settings.uploadBackend !== 'tmpfiles';
  $('#upFilebin').hidden = settings.uploadBackend !== 'filebin';
  $('#swatches').innerHTML =
    `<button type="button" data-accent="auto" title="Theme's accent" aria-label="Theme's accent" style="--sw:var(--theme-accent)" class="sw-theme${ACCENTS[settings.accent] ? '' : ' on'}">A</button>` +
    Object.entries(ACCENTS).map(([k, v]) =>
      `<button type="button" data-accent="${k}" title="${k}" style="background:${v};--sw:${v}" class="${settings.accent === k ? 'on' : ''}"></button>`).join('');
  for (const mode of ['dark', 'light']) {
    const cur = effectivePalette(mode);
    $('#' + mode + 'Themes').innerHTML = Object.entries(THEMES[mode]).map(([k, name]) =>
      `<button type="button" class="theme-card${k === cur ? ' on' : ''}" data-mode="${mode}" data-palette="${k}" data-theme-pick="${mode}Theme" aria-pressed="${k === cur}">` +
      `<span class="tc-name">${name}</span>` +
      `<span class="tc-dots">${[1, 2, 3, 4, 5, 6].map(i => `<i style="background:var(--a${i})"></i>`).join('')}</span></button>`).join('');
  }
}
async function setSetting(k, v) {
  if (k === 'notify' && v) {
    if (!('Notification' in window)) { toast('Notifications are not supported in this browser', { error: true }); v = false; }
    else if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { toast('Notification permission was denied', { error: true }); v = false; }
    }
  }
  settings[k] = v;
  saveSettings();
  if (k === 'saveHistory') saveHistory();
  if (k === 'uploadUrl' || k === 'uploadBackend') { UP.info = null; testUploadServer(); }
  syncSettingsUI();
  applySettings({ rerender: true });
  if (['accent', 'theme', 'darkTheme', 'lightTheme'].includes(k)) updateAppManifest();   // after applySettings: reads the new colours
}

/* ═══════════════════════════════════════════════════════════════════════════
   Installable app — manifest and icons generated at runtime, so no extra
   files are needed. The manifest is a blob: URL (same origin as the page,
   unlike data:), which lets it name this page as the app's start URL.
   ═══════════════════════════════════════════════════════════════════════════ */
const APP = { manifestUrl: null, prompt: null };
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iP(hone|od|ad)/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// The logo (see LOGO_SVG) as a PNG. "maskable" fills the whole square and
// keeps the glyph inside the central safe zone that launchers may crop to;
// "square" is for iOS, which rounds the corners itself.
function drawAppIcon(size, { maskable = false, square = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = cssVar('--accent') || ACCENTS.indigo;
  if (maskable || square) g.fillRect(0, 0, size, size);
  else {
    g.beginPath();
    if (g.roundRect) g.roundRect(0, 0, size, size, size * 9 / 32); else g.rect(0, 0, size, size);
    g.fill();
  }
  const glyph = maskable ? 0.8 : square ? 0.86 : 1;   // share of the icon the 32-unit logo spans
  const k = size * glyph / 32;
  g.translate(size * (1 - glyph) / 2, size * (1 - glyph) / 2);
  g.scale(k, k);
  g.strokeStyle = cssVar('--on-accent') || '#fff';
  g.lineWidth = LOGO_STROKE;
  g.lineCap = g.lineJoin = 'round';
  for (const [d, o] of LOGO_STRANDS) { g.globalAlpha = o; g.stroke(new Path2D(d)); }
  return c.toDataURL('image/png');
}

function updateAppManifest() {
  $('#appleIcon').href = drawAppIcon(180, { square: true });
  if (!/^https?:$/.test(location.protocol)) return;   // file:// pages can't be installed
  const start = location.origin + location.pathname;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111318';
  const manifest = {
    id: location.pathname,
    name: 'Weave',
    short_name: 'Weave',
    description: 'Web client for the WeeChat relay',
    start_url: start,
    scope: start.replace(/[^/]*$/, ''),
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: drawAppIcon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: drawAppIcon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: drawAppIcon(512, { maskable: true }), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  let link = $('link[rel="manifest"]');
  if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
  link.href = url;
  if (APP.manifestUrl) URL.revokeObjectURL(APP.manifestUrl);
  APP.manifestUrl = url;
}

// Settings → App: an Install button where the browser offers one (Chrome,
// Edge, Android), instructions on iOS, nothing once running as the app.
function renderInstallRow() {
  const sec = $('#appSec'), btn = $('#btnInstall'), hint = $('#installHint');
  if (isStandalone()) { sec.hidden = true; return; }
  if (APP.prompt) {
    sec.hidden = false; btn.hidden = false;
    hint.textContent = 'Add it to your home screen or desktop. It opens in its own window, without the browser\'s address bar.';
  } else if (!window.isSecureContext) {
    // Browsers only install apps from HTTPS (or localhost) pages.
    sec.hidden = false; btn.hidden = true;
    hint.textContent = `Can't be installed from this address: browsers only install apps served over HTTPS, and this page is plain ${location.protocol.replace(':', '')}. Serve Weave over HTTPS (see the README), then open that address instead.`;
  } else if (isIOS()) {
    sec.hidden = false; btn.hidden = true;
    hint.textContent = 'In Safari, tap Share, then "Add to Home Screen".';
  } else sec.hidden = true;
}

async function installApp() {
  const p = APP.prompt;
  if (!p) return;
  APP.prompt = null;   // a prompt can only be shown once
  p.prompt();
  try { const { outcome } = await p.userChoice; if (outcome === 'accepted') toast('Weave installed'); } catch {}
  renderInstallRow();
}

/* ═══════════════════════════════════════════════════════════════════════════
   Phones: layout detection, back button, swipes, on-screen keyboard
   ═══════════════════════════════════════════════════════════════════════════ */
// Keep in sync with the phone @media rule in the stylesheet.
const PHONE_MQ = matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 500px)');
const TOUCH_MQ = matchMedia('(hover: none) and (pointer: coarse)');
const isPhone = () => PHONE_MQ.matches;

// Android's back button (and back gestures) should close whatever is open —
// drawer, dialog, menu — instead of leaving the app. Each time something
// opens we make sure one history entry of ours sits on top to absorb "back".
function anyOverlayOpen() {
  return $('#sidebar').classList.contains('open') || $('#nicklist').classList.contains('open') ||
    !!document.querySelector('dialog[open]') || !!popEl;
}
function overlayOpened() {
  if (S.overlayPushed || !(isPhone() || TOUCH_MQ.matches)) return;
  if (history.state?.weaveOverlay) { S.overlayPushed = true; return; }   // reuse the entry a closed overlay left
  history.pushState({ weaveOverlay: true }, '');
  S.overlayPushed = true;
}
function overlaysClosed() { if (!anyOverlayOpen()) S.overlayPushed = false; }
function closeAllOverlays() {
  closePopover();
  $$('dialog[open]').forEach(d => d.close());
  closeDrawers();
}

// iOS Safari doesn't shrink the layout for the on-screen keyboard; size the
// app to the visible area so the composer stays above the keyboard.
function fitVisualViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  root.setProperty('--vv-h', Math.round(vv.height) + 'px');
  root.setProperty('--vv-top', Math.round(vv.offsetTop) + 'px');
}

// Swipe right anywhere in the chat for buffers, left for members.
function initSwipes() {
  let start = null;
  document.addEventListener('touchstart', e => {
    start = null;
    if (e.touches.length !== 1 || !isPhone() || $('#chatScreen').hidden || document.querySelector('dialog[open]')) return;
    if (e.target.closest('textarea, input, .media, .row.free, .pop')) return;
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!start) return;
    const t = e.changedTouches[0], s0 = start;
    start = null;
    const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5 || Date.now() - s0.at > 700) return;
    const sideOpen = $('#sidebar').classList.contains('open'), nlOpen = $('#nicklist').classList.contains('open');
    if (dx > 0) {
      if (nlOpen) closeDrawers();
      else if (!sideOpen) openDrawer('#sidebar');
    } else {
      if (sideOpen) closeDrawers();
      else if (!nlOpen && activeBuf()?.nicklist) openDrawer('#nicklist');
    }
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Wiring
   ═══════════════════════════════════════════════════════════════════════════ */
const isLoopback = host => /^(localhost|127\.|\[?::1\]?$)/i.test(String(host));

// Public mode: show the privacy note and the relay-owner checklist, with the
// allowed-origins command for this page's own address.
function setupPublicConnect() {
  if (!PUBLIC) return;
  $('#cTagline').textContent = 'Connect to your own WeeChat relay';
  $('#cPrivacy').hidden = false;
  $('#personalSetup').hidden = true;
  $('#publicSetup').hidden = false;
  const origin = /^https?:$/.test(location.protocol) ? location.origin : 'https://weave.example.com';
  const re = '^' + origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  $('#originCmd').textContent = `/set relay.network.websocket_allowed_origins "${re}"`;
  const links = [];
  if (CONFIG.sourceUrl) links.push(`<a href="${esc(CONFIG.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source code</a>`);
  if (CONFIG.downloadUrl) links.push(`<a href="${esc(CONFIG.downloadUrl)}" download>Download Weave</a> to host it yourself or open it locally`);
  if (links.length) { $('#publicLinks').innerHTML = links.join(' · '); $('#publicLinks').hidden = false; }
}

// Public mode: fill in host and port only if a WeeChat relay actually answers
// at this page's own address (POST /api/handshake needs no auth). Otherwise
// the fields stay empty for the user's own relay.
async function detectOwnRelay() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch(location.origin + '/api/handshake', {
      method: 'POST', signal: ctl.signal,
      body: JSON.stringify({ password_hash_algo: ['pbkdf2+sha512', 'pbkdf2+sha256', 'sha512', 'sha256', 'plain'] }),
    });
    clearTimeout(t);
    if (!res.ok) return;
    const hs = await res.json();
    if (!hs || !('password_hash_algo' in hs)) return;
  } catch { return; }
  if ($('#cHost').value || $('#cPort').value) return;   // the user has started typing
  $('#cHost').value = location.hostname;
  $('#cPort').value = location.port || (location.protocol === 'https:' ? '443' : '80');
  $('#cTls').checked = location.protocol === 'https:';
  if (document.activeElement === $('#cHost')) $('#cPass').focus();
}

function readConnectForm() {
  return {
    host: $('#cHost').value.trim(),
    port: $('#cPort').value.trim(),
    password: $('#cPass').value,
    tls: $('#cTls').checked,
    remember: $('#cRemember').checked,
    auto: $('#cAuto').checked,
    path: $('#cPath').value.trim() || '/api',
    auth: $('#cAuth').value,
  };
}

// Sidebar width: drag its right edge (or focus it and use the arrow keys);
// double-click resets. Kept per browser, like the buffer order.
const SIDE_MIN = 220, SIDE_MAX = 480;
function initSideResize() {
  const handle = $('#sideResize'), app = $('#chatScreen');
  const root = document.documentElement;
  const apply = w => {
    if (w == null) { root.style.removeProperty('--side-w'); return; }
    root.style.setProperty('--side-w', Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w))) + 'px');
  };
  const current = () => $('#sidebar').getBoundingClientRect().width;
  const save = () => store.set('sideW', Math.round(current()));
  apply(store.get('sideW', null));

  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX, startW = current();
    handle.classList.add('dragging');
    app.classList.add('resizing');
    const move = ev => apply(startW + ev.clientX - startX);
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.classList.remove('dragging');
      app.classList.remove('resizing');
      save();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end, { once: true });
    handle.addEventListener('pointercancel', end, { once: true });
  });
  handle.addEventListener('dblclick', () => { apply(null); store.del('sideW'); });
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') apply(current() - step);
    else if (e.key === 'ArrowRight') apply(current() + step);
    else return;
    e.preventDefault();
    save();
  });
}

function init() {
  hydrateIcons();
  applySettings({ rerender: false });
  saveHistory();
  darkMQ.addEventListener('change', () => { if (settings.theme === 'system') applySettings(); });
  renderAbout();
  setupPublicConnect();

  // Connect form
  const saved = store.get('conn', null);
  const defHost = PUBLIC ? '' : location.hostname || 'localhost';
  const defPort = location.protocol === 'https:' ? (location.port || '443') : '9000';
  $('#cHost').value = saved?.host ?? defHost;
  $('#cPort').value = saved?.port ?? (PUBLIC ? '' : defPort);
  $('#cTls').checked = saved?.tls ?? (PUBLIC || location.protocol === 'https:');
  $('#cPath').value = saved?.path ?? '/api';
  $('#cAuth').value = saved?.auth ?? 'auto';
  $('#cRemember').checked = !!saved?.remember;
  $('#cAuto').checked = !!saved?.auto;
  if (nativeSecrets?.label) $('#cRemember').nextElementSibling.nextElementSibling.textContent = nativeSecrets.label;

  $('#cPassToggle').addEventListener('click', () => {
    const p = $('#cPass'); const show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#cPassToggle').textContent = show ? 'Hide' : 'Show';
  });
  $('#connectForm').addEventListener('submit', e => {
    e.preventDefault();
    const cfg = readConnectForm();
    $('#cError').hidden = true;
    if (!cfg.host) { $('#cError').textContent = 'Enter the relay host.'; $('#cError').hidden = false; return; }
    if (cfg.port && !/^\d{1,5}$/.test(cfg.port)) { $('#cError').textContent = 'Port must be a number.'; $('#cError').hidden = false; return; }
    const blocked = [1,7,9,11,13,15,17,19,20,21,22,23,25,37,42,43,53,69,77,79,87,95,101,102,103,104,109,110,111,113,115,117,119,123,135,137,139,143,161,179,389,427,465,512,513,514,515,526,530,531,532,540,548,554,556,563,587,601,636,989,990,993,995,1719,1720,1723,2049,3659,4045,5060,5061,6000,6566,6665,6666,6667,6668,6669,6697,10080];
    if (blocked.includes(+cfg.port)) { $('#cError').textContent = `Browsers refuse to connect to port ${cfg.port}. Use another relay port, e.g. 9000.`; $('#cError').hidden = false; return; }
    if (!cfg.tls && location.protocol === 'https:' && !isLoopback(cfg.host)) { $('#cError').textContent = 'This page uses HTTPS, so browsers only allow secure relays. Turn on "Use TLS (wss://)"; the relay needs a TLS certificate (tls.api, or a proxy in front of it).'; $('#cError').hidden = false; return; }
    setConnecting(true);
    S.everConnected = false;
    S.forcePlain = false;
    S.failures = 0;
    connect(cfg);
  });

  // Sidebar
  initSideResize();
  $('#bufList').addEventListener('click', e => {
    if (S.suppressClick) { S.suppressClick = false; e.preventDefault(); return; }   // the long-press already opened a menu
    if (e.target.closest('[data-markall]')) { markAllRead(); return; }
    const close = e.target.closest('[data-close]');
    if (close) {
      e.stopPropagation();
      const b = S.buffers.get(close.dataset.close);
      if (!b) return;
      // First tap arms, second tap (within 4 s) leaves: the × is easy to hit by accident.
      if (S.closeConfirm?.id === b.id) { S.closeConfirm = null; sendInput(b, '/buffer close'); }
      else {
        S.closeConfirm = { id: b.id };
        clearTimeout(S.closeConfirmTimer);
        S.closeConfirmTimer = setTimeout(() => { S.closeConfirm = null; renderSidebar(); }, 4000);
      }
      renderSidebar();
      return;
    }
    const join = e.target.closest('[data-join]');
    if (join) { const b = S.buffers.get(join.dataset.join); if (b) openJoinPopover(join, b); return; }
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const k = tog.dataset.toggle;
      collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k);
      store.set('collapsed', [...collapsed]);
      renderSidebar();
      return;
    }
    const item = e.target.closest('[data-id]');
    if (item) activate(item.dataset.id);
  });
  // Start loading a buffer's history as soon as the pointer is over (or
  // touches) it — usually 100+ ms before the click, which hides the fetch.
  const prefetch = e => {
    const it = e.target.closest('[data-id]');
    const b = it && S.buffers.get(it.dataset.id);
    if (b?.lazy && S.connected) ensureLoaded(b);
  };
  $('#bufList').addEventListener('pointerover', prefetch);
  $('#bufList').addEventListener('pointerdown', prefetch);
  $('#swList').addEventListener('pointerover', e => { const it = e.target.closest('[data-i]'); const b = it && swItems[+it.dataset.i]; if (b?.lazy && S.connected) ensureLoaded(b); });
  // Buffer menu: right-click / keyboard context-menu key, and long-press on touch.
  const bufList = $('#bufList');
  bufList.addEventListener('contextmenu', e => {
    const it = e.target.closest('.buf[data-id]');
    if (!it) return;
    e.preventDefault();
    if (Date.now() - (S.longPressAt || 0) < 800) return;   // Android also fires contextmenu on long-press
    const b = S.buffers.get(it.dataset.id);
    if (b) openBufferMenu(it, b);
  });
  let lp = null;
  const cancelLongPress = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  bufList.addEventListener('pointerdown', e => {
    const it = e.target.closest('.buf[data-id]');
    if (!it || e.pointerType === 'mouse') return;
    cancelLongPress();
    lp = { x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      lp = null;
      const b = S.buffers.get(it.dataset.id);
      if (!b) return;
      S.longPressAt = Date.now();
      S.suppressClick = true;
      setTimeout(() => { S.suppressClick = false; }, 700);
      navigator.vibrate?.(10);
      openBufferMenu(it, b);
    }, 500) };
  });
  bufList.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLongPress(); });
  for (const ev of ['pointerup', 'pointercancel', 'scroll']) bufList.addEventListener(ev, cancelLongPress, { passive: true });

  // Drag and drop to reorder (desktop): within a group, into Pinned, or out of Pinned back home.
  const clearDropMarks = () => $$('#bufList .drop-before, #bufList .drop-after').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  const dropAllowed = (from, row) => {
    const to = row.dataset.group, b = S.buffers.get(from.id);
    return b && (to === from.group || to === 'pinned' || (from.group === 'pinned' && to === naturalGroupKey(b)));
  };
  bufList.addEventListener('dragstart', e => {
    const it = e.target.closest('.buf[data-id]');
    if (!it) return;
    const row = it.closest('.buf-row');
    S.drag = { id: it.dataset.id, group: row.dataset.group };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', S.buffers.get(it.dataset.id)?.name || '');
    row.classList.add('dragging');
  });
  bufList.addEventListener('dragover', e => {
    const row = e.target.closest('.buf-row');
    if (!S.drag || !row || !dropAllowed(S.drag, row)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = row.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    clearDropMarks();
    row.classList.add(after ? 'drop-after' : 'drop-before');
  });
  bufList.addEventListener('drop', e => {
    const row = e.target.closest('.buf-row');
    if (!S.drag || !row || !dropAllowed(S.drag, row)) return;
    e.preventDefault();
    const after = row.classList.contains('drop-after');
    const dragged = S.buffers.get(S.drag.id), target = S.buffers.get(row.querySelector('.buf').dataset.id);
    const toKey = row.dataset.group;
    S.drag = null;
    if (!dragged || !target || dragged === target) { clearDropMarks(); renderSidebar(); return; }
    const pinIdx = layout.pinned.indexOf(dragged.name);
    if (toKey !== 'pinned' && pinIdx >= 0) layout.pinned.splice(pinIdx, 1);   // dragged out of Pinned: unpin
    const g = buildGroups().find(x => x.key === toKey) || { items: [] };
    const items = g.items.filter(x => x !== dragged);
    const at = items.indexOf(target);
    items.splice(at < 0 ? items.length : at + (after ? 1 : 0), 0, dragged);
    setGroupOrder(toKey, items);
  });
  bufList.addEventListener('dragend', () => {
    S.drag = null;
    clearDropMarks();
    $$('#bufList .dragging').forEach(r => r.classList.remove('dragging'));
    if (S.sidebarPending) { S.sidebarPending = false; renderSidebar(); }
  });
  $('#btnSwitcher').addEventListener('click', openSwitcher);
  $('#btnTheme').addEventListener('click', () => setSetting('theme', effectiveMode() === 'dark' ? 'light' : 'dark'));
  $('#btnSettings').addEventListener('click', () => openSettings());
  $('#btnDisconnect').addEventListener('click', disconnect);
  $('#bannerBtn').addEventListener('click', reconnectNow);
  $('#bannerLogin').addEventListener('click', () => backToLogin(null));

  // Header
  $('#btnMenu').addEventListener('click', () => openDrawer('#sidebar'));
  $('#scrim').addEventListener('click', closeDrawers);
  $('#btnMembers').addEventListener('click', () => {
    if (matchMedia('(min-width: 1081px)').matches) setSetting('nicklist', !settings.nicklist);
    else if ($('#nicklist').classList.contains('open')) closeDrawers();
    else { openDrawer('#nicklist'); $('#btnMembers').classList.add('on'); }
  });
  $('#btnNlClose').addEventListener('click', () => {
    if (matchMedia('(min-width: 1081px)').matches) setSetting('nicklist', false); else closeDrawers();
  });
  $('#btnFilter').addEventListener('click', () => {
    const b = activeBuf(); if (!b) return;
    b.filterOverride = !(b.filterOverride ?? settings.smartFilter);
    renderHeader();
    scheduleRerender();
  });
  $('#tbTopic').addEventListener('click', e => { if (!e.target.closest('a')) e.currentTarget.classList.add('open'); });

  // Messages
  const box = $('#msgs');
  box.addEventListener('scroll', () => {
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    if (atBottom !== S.pinned) { S.pinned = atBottom; if (atBottom) S.newCount = 0; updateJump(); }
    if (box.scrollTop < 120) { const b = activeBuf(); if (b && (b.renderStart > 0 || b.hasMore) && !b.loadingMore) loadOlder(); }
  }, { passive: true });
  new ResizeObserver(() => { if (S.pinned && activeBuf()?.type !== 'free') box.scrollTop = box.scrollHeight; }).observe(box);
  box.addEventListener('load', e => { if (e.target.tagName === 'IMG' && S.pinned) box.scrollTop = box.scrollHeight; }, true);
  box.addEventListener('click', e => {
    if (e.target.closest('[data-more]')) { loadOlder(); return; }
    const nick = e.target.closest('.nick[data-nick]');
    if (nick && nick.dataset.nick) { openNickMenu(nick, nick.dataset.nick); return; }
    const chan = e.target.closest('.chan-link');
    if (chan) {
      const b = activeBuf(); const name = chan.dataset.chan;
      const ex = [...S.buffers.values()].find(x => x.short_name?.toLowerCase() === name.toLowerCase() && x.lv.server === b?.lv.server);
      if (ex) activate(ex.id); else if (b) { sendInput(b, '/join ' + name); noteSwitchIntent(b, '/join ' + name); }
      return;
    }
    const mb = e.target.closest('.media-btn');
    if (mb) {
      const next = mb.nextElementSibling;
      if (next && next.classList.contains('media')) { next.remove(); mb.classList.remove('on'); }
      else { mb.insertAdjacentHTML('afterend', mediaHtml(mb.dataset.src, mb.dataset.kind)); mb.classList.add('on'); }
      return;
    }
    const fr = e.target.closest('.row.free[data-y]');
    if (fr && activeBuf()?.lv.plugin === 'fset') { fsetClick(activeBuf(), +fr.dataset.y); return; }
    const img = e.target.closest('.media img');
    if (img) window.open(img.dataset.full, '_blank', 'noopener');
  });
  // Message menu: right-click (unless on a link or selected text), long-press on touch.
  const msgRow = t => t.closest('#msgs .row[data-id]:not(.free)');
  box.addEventListener('contextmenu', e => {
    const row = msgRow(e.target);
    if (!row || e.target.closest('a') || String(window.getSelection() || '').trim()) return;
    e.preventDefault();
    if (Date.now() - (S.longPressAt || 0) < 800) return;
    openMessageMenu(row);
  });
  let mlp = null;
  const cancelMsgPress = () => { if (mlp) { clearTimeout(mlp.timer); mlp = null; } };
  box.addEventListener('pointerdown', e => {
    const row = msgRow(e.target);
    if (!row || e.pointerType === 'mouse' || e.target.closest('a, .nick, button')) return;
    cancelMsgPress();
    mlp = { x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      mlp = null;
      S.longPressAt = Date.now();
      navigator.vibrate?.(10);
      window.getSelection()?.removeAllRanges();
      openMessageMenu(row);
    }, 500) };
  });
  box.addEventListener('pointermove', e => { if (mlp && Math.hypot(e.clientX - mlp.x, e.clientY - mlp.y) > 10) cancelMsgPress(); });
  for (const ev of ['pointerup', 'pointercancel', 'scroll']) box.addEventListener(ev, cancelMsgPress, { passive: true });
  $('#jump').addEventListener('click', scrollToBottom);
  // A double-click's two clicks already select and then edit an fset option;
  // just keep the browser from also selecting a word.
  box.addEventListener('dblclick', e => {
    if (e.target.closest('.row.free[data-y]') && activeBuf()?.lv.plugin === 'fset') window.getSelection()?.removeAllRanges();
  });
  $('#fsetBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd]');
    const b = activeBuf();
    if (btn && b) runBufferCommand(b, btn.dataset.cmd);
  });

  // Search
  const si = $('#searchInput');
  let searchTimer = 0;
  si.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 150); });
  si.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      if (!S.search || S.search.q !== si.value.trim().toLowerCase()) runSearch();
      else goToHit(S.search.idx + (e.shiftKey ? 1 : -1));
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
  });
  $('#btnSearch').addEventListener('click', () => ($('#searchBar').hidden ? openSearch() : closeSearch()));
  $('#searchPrev').addEventListener('click', () => S.search && goToHit(S.search.idx - 1));
  $('#searchNext').addEventListener('click', () => S.search && goToHit(S.search.idx + 1));
  $('#searchClose').addEventListener('click', () => closeSearch());
  $('#searchMore').addEventListener('click', searchOlder);
  $('#searchOnly').addEventListener('click', () => {
    if (!S.search) return;
    S.search.only = !S.search.only;
    renderMessages();
    if (S.search.idx >= 0) goToHit(S.search.idx); else updateSearchUI();
  });

  // Nicklist
  $('#nlBody').addEventListener('click', e => {
    const n = e.target.closest('[data-nick]');
    if (n) openNickMenu(n, n.dataset.nick);
  });

  // Composer
  const inp = $('#input');
  inp.addEventListener('keydown', onInputKeydown);
  inp.addEventListener('input', () => {
    saveDraft(activeBuf(), inp.value);
    if (S.confirmPaste != null && inp.value !== S.confirmPaste) cancelPasteConfirm();
    autosize(); updateSendBtn();
    // A lone "/" offers the command palette.
    const lone = inp.value === '/' && S.confirmPaste == null;
    if (lone) setHint(`<button class="cmd-hint" type="button" data-palette>Browse commands… <kbd>${navigator.platform.startsWith('Mac') ? '⇧⌘P' : 'Ctrl Shift P'}</kbd></button>`);
    else if ($('#composerHint [data-palette]')) setHint('');
  });
  $('#composerHint').addEventListener('click', e => { if (e.target.closest('[data-palette]')) { setHint(''); openPalette(); } });
  $('#btnSend').addEventListener('click', () => { submitInput(); inp.focus(); });
  // Tapping these must not blur the input, or the phone keyboard closes.
  for (const id of ['#btnSend', '#btnTab']) $(id).addEventListener('pointerdown', e => { if (document.activeElement === inp) e.preventDefault(); });
  $('#btnTab').addEventListener('click', () => { if (inp.value.trim()) tabComplete(1); else inp.focus(); });

  // Uploads: button, paste, drag & drop
  $('#btnAttach').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', e => { queueUploads([...e.target.files]); e.target.value = ''; });
  $('#uploads').addEventListener('click', e => { const c = e.target.closest('[data-cancel-up]'); if (c) cancelUpload(+c.dataset.cancelUp); });
  inp.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length || !uploadsEnabled()) return;
    e.preventDefault();
    queueUploads(files.map(renamePasted));
  });
  const main = $('.main');
  const draggingFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  let dragDepth = 0;
  main.addEventListener('dragenter', e => { if (!draggingFiles(e) || !uploadsEnabled()) return; e.preventDefault(); if (++dragDepth === 1) showDropZone(true); });
  main.addEventListener('dragover', e => { if (draggingFiles(e) && uploadsEnabled()) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  main.addEventListener('dragleave', e => { if (!draggingFiles(e) || !uploadsEnabled()) return; if (--dragDepth <= 0) { dragDepth = 0; showDropZone(false); } });
  main.addEventListener('drop', e => {
    if (!draggingFiles(e) || !uploadsEnabled()) return;
    e.preventDefault();
    dragDepth = 0;
    showDropZone(false);
    queueUploads([...e.dataTransfer.files]);
  });
  // A drop that misses the chat area must not navigate away from the app.
  window.addEventListener('dragover', e => { if (draggingFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (draggingFiles(e)) e.preventDefault(); });

  // Switcher
  $('#swInput').addEventListener('input', renderSwitcher);
  $('#swInput').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); swSel = Math.min(swSel + 1, swItems.length - 1); paintSwitcher(); }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); swSel = Math.max(swSel - 1, 0); paintSwitcher(); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSwitcher(swSel); }
  });
  $('#swList').addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) pickSwitcher(+it.dataset.i); });
  $('#switcherDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#switcherDlg').addEventListener('close', () => { overlaysClosed(); if (!matchMedia('(hover: none)').matches) inp.focus(); });
  // Command palette
  $('#palInput').addEventListener('input', renderPalette);
  $('#palInput').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); palSel = Math.min(palSel + 1, palItems.length - 1); paintPalette(); }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); palSel = Math.max(palSel - 1, 0); paintPalette(); }
    else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); paletteHelp(palSel); }
    else if (e.key === 'Enter') { e.preventDefault(); pickPalette(palSel); }
  });
  $('#palList').addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) pickPalette(+it.dataset.i); });
  $('#palHelp').addEventListener('click', () => paletteHelp(palSel));
  $('#paletteDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#paletteDlg').addEventListener('close', () => { overlaysClosed(); if (!matchMedia('(hover: none)').matches) inp.focus(); });
  $('#settingsDlg').addEventListener('close', overlaysClosed);
  window.addEventListener('popstate', () => {
    S.overlayPushed = false;
    if (anyOverlayOpen()) closeAllOverlays();
  });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', fitVisualViewport);
    visualViewport.addEventListener('scroll', fitVisualViewport);
    fitVisualViewport();
  }
  initSwipes();

  // Installable app
  updateAppManifest();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); APP.prompt = e; renderInstallRow(); });
  window.addEventListener('appinstalled', () => { APP.prompt = null; renderInstallRow(); });
  $('#btnInstall').addEventListener('click', installApp);
  PHONE_MQ.addEventListener('change', () => { closeAllOverlays(); renderNicklist(); });

  // Settings dialog
  const sd = $('#settingsDlg');
  sd.addEventListener('click', e => {
    if (e.target === sd || e.target.closest('[data-close]')) { sd.close(); return; }
    const seg = e.target.closest('.seg button');
    if (seg) { setSetting(seg.parentElement.dataset.setting, seg.dataset.v); return; }
    const sw = e.target.closest('[data-accent]');
    if (sw) { setSetting('accent', sw.dataset.accent); return; }
    const tc = e.target.closest('[data-theme-pick]');
    if (tc) {
      // Show the pick straight away, unless the mode follows the system.
      if (settings.theme !== 'system') settings.theme = tc.dataset.mode;
      setSetting(tc.dataset.themePick, tc.dataset.palette);
    }
  });
  sd.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset.setting) return;
    if (el.type === 'checkbox') setSetting(el.dataset.setting, el.checked);
    else setSetting(el.dataset.setting, el.value.trim());
  });
  $('#btnUpTest').addEventListener('click', testUploadServer);

  // Global keys
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;   // already handled (e.g. by the message box)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !$('#chatScreen').hidden) { e.preventDefault(); openSwitcher(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p' && !$('#chatScreen').hidden) { e.preventDefault(); openPalette(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f' && !$('#chatScreen').hidden && !document.querySelector('dialog[open]')) {
      e.preventDefault(); openSearch(); return;
    }
    if ($('#chatScreen').hidden || document.querySelector('dialog[open]')) return;
    const t0 = e.target;
    if (!(t0 instanceof HTMLInputElement || t0 instanceof HTMLSelectElement) && handleBufferKey(e)) return;
    if (e.key === 'Escape' && e.shiftKey) { e.preventDefault(); markAllRead(); return; }
    if (e.key === 'Escape') { closePopover(); closeDrawers(); if (!$('#searchBar').hidden) closeSearch(); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBuffer(activeBuf(), e.key === 'ArrowUp' ? -1 : 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); cycleBuffer(-1); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); cycleBuffer(1); return; }
      if (e.code === 'KeyA') { e.preventDefault(); nextActive(); return; }
      const dm = e.code.match(/^Digit(\d)$/);
      if (dm) {
        e.preventDefault();
        const n = dm[1] === '0' ? 10 : +dm[1];
        const b = [...S.buffers.values()].filter(x => x.number === n && !x.hidden).sort((x, y) => (x.lv.type === 'server') - (y.lv.type === 'server'))[0];
        if (b) activate(b.id);
        return;
      }
    }
    // Typing anywhere focuses the composer.
    const t = e.target;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable)) {
      inp.focus();
    }
  });
  document.addEventListener('pointerdown', e => { if (popEl && !popEl.contains(e.target)) closePopover(); }, true);
  // Phones fire resize when the address bar hides or the keyboard opens; only a
  // real width change (rotation, window resize) should close open menus.
  let lastWidth = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth !== lastWidth) { lastWidth = innerWidth; closePopover(); scheduleNicklist(); }
  });
  $('#msgs').addEventListener('scroll', closePopover, { passive: true });

  // Visibility: place an "unread" marker for lines that arrive while away.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkConnection();
    const b = activeBuf();
    if (!b) return;
    if (document.hidden) {
      const last = b.lines[b.lines.length - 1];
      S.awayMarker = !!last;
      if (last) b.lastReadId = last.id;
    } else {
      S.awayMarker = false;
      b.unread = 0; b.mentions = 0;
      closeNotifications(b);
      renderSidebar(); updateTitle();
      markReadSoon(b);
    }
  });
  window.addEventListener('online', checkConnection);
  window.addEventListener('pageshow', e => { if (e.persisted) checkConnection(); });

  restoreLogin(saved);
}

// Fills in the remembered password (it may come from the host app's keychain,
// so this is async) and auto-connects.
async function restoreLogin(saved) {
  const password = await loadPassword(saved);
  if (password) $('#cPass').value = password;
  if (saved?.auto && saved.host && password) {
    setConnecting(true);
    connect({ ...saved, password, path: saved.path || '/api', auth: saved.auth || 'auto' });
    return;
  }
  showScreen('connect');
  (saved?.host ? $('#cPass') : $('#cHost')).focus();
  if (PUBLIC && !saved?.host) detectOwnRelay();
}

init();

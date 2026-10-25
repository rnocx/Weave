// Injected into every page load by the Mac app (WKUserScript, document start).
// weave.js is not changed: this makes the browser APIs it already uses
// (Notification, document.title) reach macOS.
(() => {
  const post = m => window.webkit.messageHandlers.weave.postMessage(m);

  let permission = 'default';
  post({ type: 'permissionStatus' }).then(p => { permission = p; }).catch(() => {});

  const live = new Map();
  let seq = 0;
  class WeaveNotification {
    constructor(title, opts = {}) {
      this.title = String(title);
      this.body = opts.body || '';
      this.tag = opts.tag || '';
      this.onclick = null;
      this._id = ++seq;
      live.set(this._id, this);
      post({ type: 'show', id: this._id, title: this.title, body: this.body, tag: this.tag });
    }
    close() { live.delete(this._id); post({ type: 'close', id: this._id, tag: this.tag }); }
    static get permission() { return permission; }
    static requestPermission(cb) {
      return post({ type: 'requestPermission' }).then(p => { permission = p; if (cb) cb(p); return p; });
    }
  }
  Object.defineProperty(window, 'Notification', { value: WeaveNotification, configurable: true, writable: true });

  // Called by the app when a notification is clicked.
  window.__weaveNotificationClick = id => {
    const n = live.get(id);
    if (!n) return;
    live.delete(id);
    if (typeof n.onclick === 'function') n.onclick(new Event('click'));
  };

  // The remembered relay password lives in the Keychain, not localStorage (see weave.js).
  window.__weaveSecrets = {
    label: 'Remember password (stored in the macOS Keychain)',
    get: account => post({ type: 'secretGet', account }),
    set: (account, value) => post({ type: 'secretSet', account, value }),
    del: account => post({ type: 'secretDelete', account }),
  };

  // ── Look and feel (Mac only) ───────────────────────────────────────────────
  const root = document.documentElement;
  root.classList.add('native-mac');

  // Mac-only stylesheet, served by the app at weave://app/mac.css.
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'weave://app/mac.css';
  root.appendChild(css);

  const $ = s => document.querySelector(s);
  const chatVisible = () => { const c = $('#chatScreen'); return !!c && !c.hidden; };

  // Native layout facts (title bar height, traffic-light width, full screen).
  window.__weaveMacLayout = ({ top, lights, fullscreen }) => {
    root.style.setProperty('--mac-top', top + 'px');
    root.style.setProperty('--mac-lights', lights + 'px');
    root.classList.toggle('mac-fs', !!fullscreen);
  };

  // Menu-bar actions. They drive the page through its own buttons and shortcuts.
  const key = init => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  const actions = {
    settings:   () => $('#btnSettings').click(),
    switcher:   () => key({ key: 'k', code: 'KeyK', metaKey: true }),
    palette:    () => key({ key: 'P', code: 'KeyP', metaKey: true, shiftKey: true }),
    search:     () => key({ key: 'f', code: 'KeyF', metaKey: true }),
    prev:       () => key({ key: 'ArrowUp', code: 'ArrowUp', altKey: true }),
    next:       () => key({ key: 'ArrowDown', code: 'ArrowDown', altKey: true }),
    unread:     () => key({ key: 'a', code: 'KeyA', altKey: true }),
    markAll:    () => key({ key: 'Escape', code: 'Escape', shiftKey: true }),
    members:    () => { const b = $('#btnMembers'); if (b && !b.hidden) b.click(); },
    theme:      () => $('#btnTheme').click(),
    disconnect: () => $('#btnDisconnect').click(),
  };
  window.__weaveMacAction = name => { if (chatVisible() && actions[name]) actions[name](); };

  // Dragging the window by its top bar, and double-click to zoom.
  const INTERACTIVE = 'button,a,input,textarea,select,label,summary,dialog,[role=button],[contenteditable],.tb-topic,.connect-card';
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest(INTERACTIVE)) return;
    const inBar = e.target.closest('.topbar, .nl-head') || (e.clientY < 44 && e.target.closest('.sidebar, .connect-screen'));
    if (inBar) post({ type: e.detail > 1 ? 'titlebarDoubleClick' : 'dragWindow' });
  });

  // After weave.js has loaded: offer the macOS accent colour, and keep the
  // window's appearance (vibrancy, traffic lights) in step with the chosen theme.
  const finish = () => {
    // weave.js defaults the host to the page's own host, which here is "app".
    try { const h = $('#cHost'); if (h && !store.get('conn', null) && h.value === location.hostname) h.value = ''; } catch {}
    if (typeof ACCENTS === 'object') ACCENTS.system = window.__weaveMacAccent || '#007aff';
    const sync = () => {
      let mode = null;   // follow the system
      try { if (settings.theme !== 'system') mode = effectiveMode(); } catch {}
      post({ type: 'appearance', mode });
    };
    if (typeof applySettings === 'function') {
      const orig = applySettings;
      window.applySettings = function () { const r = orig.apply(this, arguments); sync(); return r; };
      applySettings({ rerender: false });   // re-resolve an already-chosen "system" accent
    }
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finish); else finish();

  // The Mac's accent colour changed (System Settings → Appearance).
  window.__weaveMacSetAccent = hex => {
    window.__weaveMacAccent = hex;
    if (typeof ACCENTS === 'object') {
      ACCENTS.system = hex;
      try { if (settings.accent === 'system') applySettings({ rerender: false }); } catch {}
    }
  };
})();

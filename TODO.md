# TODO

Improvements for Weave, ranked by impact on real users (stability first, then
performance, security, usability). Line numbers refer to `index.html` as of
this writing and may drift.

Effort: **S** = under an hour · **M** = a few hours · **L** = a day or more.

## P1 — Fix first ✅ done

All seven are implemented and covered by an end-to-end test against a live
relay (20/20 passing).

- [x] **1. Detect dead connections** — **S**
  - *Problem:* the keepalive ping ignores failures (`index.html:1093`). After a
    network switch or sleep, the socket can die silently while the UI still
    says "Connected".
  - *Fix:* if a ping fails or times out, close the socket so the normal
    reconnect path runs.

- [x] **2. Reconnect when the tab becomes visible** — **S**
  - *Problem:* only the `online` event triggers an immediate retry
    (`index.html:2279`). Background timers are throttled, so after a laptop
    wakes, the reconnect can wait up to 30s of backoff.
  - *Fix:* on `visibilitychange` → visible, reconnect immediately if
    disconnected; if connected, send one ping to check.

- [x] **3. Stop retrying forever on auth failure** — **S**
  - *Problem:* a wrong or changed password looks like a network error, so the
    reconnect loop never ends (`index.html:993`).
  - *Fix:* after ~5 failed attempts, show "Still can't reconnect" with a
    button back to the login screen.

- [x] **4. Explain clock-drift login failures** — **S**
  - *Problem:* hashed auth uses the device clock as the salt; WeeChat rejects
    it if the clock is more than `relay.network.time_window` (default 5s) off.
    The user only sees the generic "check host/port/password" error
    (`index.html:974`).
  - *Fix:* when hashed auth fails, mention the clock in the error. Optionally
    retry once with the plain password, but only over TLS.

- [x] **5. Remove the regex lookbehind** — **S**
  - *Problem:* `(?<=…)` in `URL_RE` (`index.html:763`) is a syntax error in
    Safari before 16.4, so the whole app fails to load there.
  - *Fix:* rewrite the channel-link match with a capture group.

- [x] **6. Keep secrets out of saved input history** — **S**
  - *Problem:* history goes to `localStorage` in plain text
    (`index.html:1822`), including `/msg NickServ IDENTIFY …`, `/set …password…`
    and `/secure set`.
  - *Fix:* don't save lines matching those patterns; add a setting to turn off
    saving history.

- [x] **7. Confirm multi-line pastes** — **S**
  - *Problem:* pasted text is split and sent line by line at once
    (`index.html:1824`). A 40-line paste floods the channel and can get the
    user kicked.
  - *Fix:* ask for confirmation above ~3 lines (later: offer a pastebin
    upload).

## P2 — Performance ✅ done

Measured on a heavy test account (35 buffers, a 2,000-member channel, ~9,000
lines of history), median of three runs, desktop / phone (CPU slowed 4×):
startup download 2.7 MB → 467 KB; memory 5.3 → 2.8 MB; phone startup
3.1 → 2.0 s; opening the 2,000-member channel 351 → 132 ms / 1.9 → 0.3 s;
main thread blocked by a 300-event join/part flood 1.2 → 0.16 s / 3.0 → 0.06 s.

- [x] **8. Lighter startup load** — **M**
  - *Problem:* startup fetches 200 lines plus the full member list for every
    buffer (`index.html:1088`). With many large channels that's megabytes
    before the first render, which hurts on mobile.
  - *Fix:* load ~30 lines and no nicks per buffer at startup; fetch full
    history and members when a buffer is first opened.

- [x] **9. Faster rendering of big buffers** — **S** (step 1), **M** (step 2)
  - *Problem:* switching buffers rebuilds every loaded line, up to 4,000
    (`index.html:1574`).
  - *Step 1:* add `content-visibility: auto` to `.row` so the browser skips
    off-screen rows.
  - *Step 2:* render only the last ~500 lines and add older ones on scroll.

- [x] **10. Cheaper member list updates** — **M**
  - *Problem:* the list is fully rebuilt on every resize event
    (`index.html:2261`) and every join/part batch, and nick colours are
    re-parsed each time (`index.html:1705`).
  - *Fix:* throttle the resize handler and cache parsed nick colours. For
    channels with thousands of members, only draw the visible part of the
    list.

- [x] **11. Throttle read-state sync** — **S**
  - *Problem:* the `/buffer set hotlist -1` sync is debounced
    (`index.html:1320`): it never fires in busy channels and fires after
    almost every line in quiet ones.
  - *Fix:* throttle to at most one call per ~5s.

- [x] **12. Compute sidebar groups once per render** — **S**
  - *Problem:* `renderSidebar` calls `buildGroups()` again inside its own loop
    (`index.html:1422`).
  - *Fix:* compute the groups once at the start of the render.

## P3 — Security hardening

- [x] **13. Add a Content-Security-Policy** — **S** *(done after splitting the
  app into `index.html` + `weave.css` + `weave.js`: `script-src 'self'` allows
  only Weave's own script. Styles still allow inline `style=""` attributes,
  used for nick colours. `frame-ancestors` needs a server header; see
  PUBLIC-HOSTING.md.)*
  - *Why:* a `<meta http-equiv="Content-Security-Policy">` limits the damage if
    a rendering bug ever lets chat HTML through.
  - *Policy:* inline scripts and styles only; `connect-src` for `ws:`, `wss:`,
    `http:`, `https:` (needed for the handshake and for Jirafeau uploads to
    any configured server); `img-src` and `media-src` open, for previews.

- [x] **14. Label "Remember password" honestly** — **S**
  - *Why:* the password is stored unencrypted. That's unavoidable, because each
    hashed login needs the real password, but the checkbox should say so.
  - *Change:* label it "Remember password (stored unencrypted on this
    device)".

## P4 — Usability

- [x] **15. Confirm before leaving a channel** — **S**
  - *Problem:* the hover × in the sidebar leaves a channel with a single click
    (`index.html:2126`).
  - *Fix:* use a two-step "click again" confirm, like the kick button.

- [x] **16. Keep scroll position on setting changes** — **S**
  - *Problem:* changing any setting calls `renderMessages()`
    (`index.html:663`), which jumps to the bottom.
  - *Fix:* restore the previous scroll offset after re-rendering.

- [x] **17. Smarter notifications** — **S**
  - *Problem:* desktop notifications fire even while the tab is focused.
  - *Fix:* when the tab is focused, show an in-app toast for highlights in
    other buffers instead. Add an optional sound on highlight.

- [~] **18. Accessibility fixes** — **M** *(partly done: the close button is a
  real, keyboard-reachable button. Popover focus handling and badge labels
  remain.)*
  - *Problems:*
    - The close button is a `<span role="button">` nested inside a `<button>`
      (`index.html:1440`), which is invalid and not keyboard-reachable.
    - Popovers don't move focus to their first item.
    - The active buffer has no `aria-current`; badges have no accessible
      labels.
  - *Fix:* address each of these.

- [x] **19. Keep drafts across reloads** — **S**
  - *Problem:* per-buffer drafts live only in memory.
  - *Fix:* persist them in `sessionStorage`.

- [x] **20. Sidebar polish** — **S**
  - *Problem:* when IRC servers are present, the core group shows a "WEECHAT"
    header over a single "weechat" item, which looks redundant.
  - *Fix:* show the core buffer at the top without a group header.

## P5 — New features

- [x] **21. Search within a buffer** — **M**: search bar (Ctrl/⌘+F or the 🔍
  button) with highlighted matches, "N of M" and ↑/↓ (Enter / Shift+Enter),
  an "Only matches" filter, "Search older" to pull more history from the
  relay, and live matching of new messages.
- [x] **22. "Mark all as read"** — **S**: a row at the top of the buffer list
  (only when something is unread) and Shift+Esc. Syncs to WeeChat with
  `/hotlist clear` + `/allbuf /buffer set unread`.
- [x] **23. Installable app** — **M**: manifest and icons generated at runtime
  (the manifest as a same-origin `blob:` URL), Apple web-app tags, and an
  Install row in Settings. Verified installable in Chromium.
- [x] **24. Reorder or pin buffers** — **L**: a Pinned group, drag and drop on
  desktop, a buffer menu (right-click / long-press: pin, move, mark as read,
  reset order, leave), and Alt+Shift+↑/↓. Stored in the browser only;
  WeeChat's buffer numbers are untouched.
- [ ] **25. Jirafeau download passwords** — **S**: optional per-upload
  password field (`key`), for servers with `download_password_requirement`.

## P6 — Next ideas

- [~] **26. Protect the remembered password** — **M**: encrypt it in the
  browser with a PIN or passkey and unlock it when the app opens (today it's
  stored unencrypted). *(Mac app done: it's in the Keychain, via the
  `window.__weaveSecrets` hook. The browser still stores it unencrypted.)*
- [x] **27. Mute / notification level per buffer** — **S–M**: all messages,
  mentions only, or mute, in the buffer menu; stored in the browser like pins.
  *(Not done: syncing with WeeChat's `/buffer set notify`.)*
- [ ] **28. Multiple saved relays (profiles)** — **M**: also needed for public
  hosting (see PUBLIC-HOSTING.md).
- [ ] **29. Instant startup / offline shell** — **S**: a service worker caches
  the three app files, so the installed app opens immediately.
- [x] **30. Reply, quote and copy a message** — **S**: a message menu
  (right-click / long-press): reply (channels), quote (`> <nick> text` on its
  own line above your message), copy text, copy links. Right-clicking a link
  or selected text keeps the normal menu.
- [x] **31. Command palette** — **M**: Ctrl/⌘+Shift+P, or type `/` in the
  message box. The relay's own command list (`/api/completion`) with
  descriptions and arguments from WeeChat 4.9's /help; Enter inserts the
  command, Shift+Enter shows its full /help in the core buffer.
- [ ] **32. Push notifications while the app is closed** — **L**: needs a small
  WeeChat-side script plus Web Push; doesn't fit the "nothing on the server"
  public mode.
- [x] **33. Better fset integration** — **M**: the buffer's own WeeChat keys
  (from the relay's key map) work in Weave, including two-step keys; click or
  tap to select an option and again to edit it in the message box; a toolbar
  for touch screens; tool buffers open at the top, keep their scroll position
  and scroll sideways on phones.

## P7 — Public hosting

Anyone opens Weave from a public address and connects to their own relay;
the server stores nothing. Plan and details: PUBLIC-HOSTING.md.

- [x] **34. Deployment switch** — **S**: `CONFIG.mode: 'personal' | 'public'`;
  `deploy/build-public.sh` builds the public copy into `deploy/dist/`.
- [x] **35. Uploads off in public mode** — **S**: no Jirafeau default (the URL
  is blanked in the public build); Litterbox, tmpfiles.org and Filebin stay
  available to pick in Settings.
- [x] **36. Smarter connect form** — **S**: empty host and TLS on, unless a
  WeeChat relay answers `POST /api/handshake` at the page's own address, which
  then fills in host and port. An HTTPS page refuses TLS-off relays with an
  explanation instead of failing silently.
- [x] **37. Connect-screen hints** — **S**: privacy note, and the relay-owner
  checklist with the exact `websocket_allowed_origins` command for the page's
  address. A relay that refuses the WebSocket gets that command in the error.
- [x] **38. Static hosting config** — **S**: `deploy/Caddyfile` and
  `deploy/nginx.conf`: only the app's files over HTTPS, no request logs,
  security headers, `Cache-Control: no-cache` with ETags.
- [x] **39. Relay-owner checklist in the README** — **S**
- [x] **40. Downloadable app** — **S**: `weave.zip`, linked from the connect
  screen, for self-hosting or opening locally.
- [ ] **41. Publish the source** — **S**: then pass its URL to
  `deploy/build-public.sh <url>` so the connect screen links to it.
- [ ] **42. Pre-launch checks on real devices** — **M**: from a fresh desktop
  and phone browser, connect to a relay with a real certificate and to one on a
  tailnet, and confirm the live server leaves no log entries. *(Done locally:
  25 browser checks against Caddy, a TLS proxy and WeeChat 4.9: empty form,
  uploads Off, only the page's own origin before connecting and only the relay
  after, hashed login cross-origin, same-origin pre-fill, personal mode
  unchanged, phone width.)*
- [ ] **28. Multiple saved relays** (above) — optional for launch.

Also useful for public users, not required: #26 (protect the remembered
password), #29 (service worker for instant startup), #25 (Jirafeau download
passwords). #32 (push notifications) doesn't fit public mode.

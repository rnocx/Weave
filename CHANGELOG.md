# Changelog

Notable changes to Weave, newest first. Weave has no version numbers yet, so
entries are grouped by date. The Mac app is version 1.0 throughout.

## 2026-10-25

### Added
- **Notification level per buffer**, in the buffer menu: all messages, mentions
  only, or mute. With "mentions only", ordinary messages don't count as unread
  or notify; highlights and private messages still do. The sidebar shows an @
  for mentions-only buffers and a crossed-out bell for muted ones.
- **Message menu** (right-click, or long-press on touch screens): reply to the
  sender (in channels), quote the message on its own line above your text,
  copy its text, copy its links. Right-clicking a link or selected text still
  opens the normal menu.

### Changed
- Buffers muted on 2026-10-24 keep their setting as "mute".

## 2026-10-24

### Added
- **Mute** a buffer from its menu: no notifications and no unread or mention
  counts. Stored in the browser, like pins.
- **Dismiss notifications**: in-app notifications have a × button, and a
  buffer's notifications (in-app and system) are cleared when you open it or
  come back to it.
- **Command palette** (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>,
  or type `/` in an empty message box): the relay's own command list, with
  descriptions and arguments from WeeChat 4.9's `/help`. <kbd>Enter</kbd>
  inserts the command, <kbd>Shift</kbd>+<kbd>Enter</kbd> shows its full help.
- Mac app: the remembered password is kept in the **macOS Keychain**. A
  password saved by an earlier version is moved there on first launch.
- Mac app: **self-signed relay certificates** are trusted on first use. The
  app shows the certificate's SHA-256 fingerprint once, remembers it per host
  and port, and warns if it changes. File → Forget Trusted Certificates
  resets this.
- Mac app: Go → Command Palette… (⇧⌘P).
- Web: an optional `window.__weaveSecrets` hook lets a host app store the
  remembered password somewhere safer than `localStorage`.

## 2026-10-21

### Added
- Resizable sidebar: drag its edge, double-click the edge to reset.

## 2026-09-29 – 2026-10-21

### Added
- **Mac app** (`macos/`): a native shell around the same three files, with
  system notifications, a Dock badge, native menus and shortcuts, a
  translucent sidebar, and the macOS accent colour. Closing the window keeps
  the connection running.
- **Public hosting**: `CONFIG.mode: 'public'`, `deploy/build-public.sh`, and
  Caddy and nginx configs that serve only the app's files with no request
  logs. In public mode the connect form detects a relay at the page's own
  address, uploads start off, and the connect screen shows a privacy note and
  the relay-owner checklist. A `weave.zip` download is offered for
  self-hosting.
- **Colour themes**: separate theme choices for dark mode (Weave, Solarized,
  Gruvbox, Catppuccin Mocha, Nord, Dracula, Monokai, Tokyo Night, One Dark,
  Glacier) and light mode (Weave, Solarized, Gruvbox, Catppuccin Latte).

## 2026-09-28 – 2026-09-29

### Added
- File uploads to **tmpfiles.org** and **Filebin**, alongside Jirafeau and
  Litterbox.

## Up to 2026-09-28

The first version, built up as a single `index.html` and then split into
`index.html`, `weave.css` and `weave.js`, with a Content-Security-Policy that
allows only Weave's own script.

### Added
- Chat over WeeChat's API relay (WeeChat ≥ 4.0) with hashed authentication,
  automatic reconnect, dead-connection detection, and clear errors for wrong
  passwords and clock drift.
- Sidebar grouped by IRC server with unread and mention badges, pinning and
  reordering, "Mark all as read", and a quick switcher
  (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>).
- Search within a buffer, server-side tab completion, input history, drafts,
  multi-line input with paste confirmation, and infinite scroll-back.
- Member list with ranks and a nick menu; WeeChat colours, highlights,
  day separators and an unread marker.
- WeeChat's tool buffers (`/fset`, `/script`, …) with their own keys, and an
  fset toolbar for touch screens.
- Read-state sync with WeeChat's hotlist and read marker.
- Desktop notifications and an unread count in the title and favicon.
- File uploads to Jirafeau and Litterbox, with optional inline media previews.
- Phone layout, installable web app, and setup notes for Tailscale Serve.
- Performance work for large accounts: lighter startup, windowed rendering,
  cheaper member-list updates.

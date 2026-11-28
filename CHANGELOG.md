# Changelog

Notable changes to Weave, newest first. Website releases use semantic versions
from VERSION and matching GitHub release tags (for example, v1.0.0).
Older entries are grouped by date. The Mac app has its own version.

## 1.2.4 — 2026-11-28

### Added
- Support newer relay history counts and visible-message pagination while
  retaining filtered lines between messages. Keep raw-line pagination for stable
  relays without those fields.
- Reorder whole networks in the sidebar by dragging their headings or using
  Move network up/down from their menus. Touch devices have a visible network
  menu button. Save network and channel order on the current device, with
  separate reset actions; WeeChat's buffer order stays unchanged.

### Fixed
- Refresh cached history on development relays' `buffer_lines_filtered` events,
  including rule changes that leave the per-buffer filter switch enabled.
  Defer inactive buffers until opened and repeat refreshes if filters change
  while a request is pending.
- Handle multiple nick prefixes in member grouping and moderation menus.
- Place read markers when nothing has been read or the last-read line is absent
  from loaded history, using the newer relay flag when available.
- Give local-network permission prompts time during initial relay connections,
  ask for a Connect tap when permission is needed before automatic login, and
  explain how to allow blocked access in browser site settings.
- Relay proxy examples close short HTTP connections after each response while
  preserving WebSockets, avoiding authentication-timeout messages from idle
  handshake connections. Deployment templates include opt-in relay blocks.
- The eye button toggles WeeChat's filters in the current buffer with
  `/filter toggle @` and refreshes loaded history on 4.10.5. Settings separately
  reads and changes the global `irc.look.smart_filter` option, following changes
  from other clients. Remove local smart-filter preferences and overrides;
  message visibility follows WeeChat's display flags.
- The eye icon reflects WeeChat's actual per-buffer filter switch, including
  on 4.10.5 and in empty buffers. Refresh the active buffer's state and history
  when filtering changes in another client.

## 1.2.3 — 2026-11-27

### Added
- Settings → About has Check for updates and Refresh app controls for installed
  apps and browser tabs. Refresh downloads the app files before reloading and
  keeps settings and saved drafts. Failed downloads leave the current app open.

### Changed
- Public builds include the release version in stylesheet and script URLs so
  a new release loads fresh assets even when older files are cached.

## 1.2.1 — 2026-11-27

### Changed
- Compact density uses tighter line spacing and smaller gaps between message
  groups, including stacked messages on phones. Text size stays the same.

### Fixed
- Installed iPhone web apps no longer use the translucent status-bar mode that
  could blur the header and leave an oversized gap below the composer. The
  page background follows the theme, and the composer has a smaller bottom inset.
- Loading older history keeps the visible message in place. Returning to the
  latest messages while a history request is pending keeps following new messages.
- Touch devices use actual message heights instead of off-screen estimates,
  and the history loading indicator keeps the same height as its button.

## 1.2.0 — 2026-11-26

### Added
- Script buffer toolbar for loading, unloading, reloading, autoload, holds,
  installation, and removal. Select rows by mouse, touch, or keyboard. Confirm
  before installing, removing, or enabling downloads.
- Appearance setting to replace private message initials with person outlines
  in the buffer list.
- Resizable member list that remembers its width. Double-click the resize
  handle to fit the longest nickname again.

### Fixed
- Release deployment checks and replaces `weave.zip` before uploading the
  website, then verifies all four files on the server. The download URL includes
  the release version so browsers don't reuse an older cached ZIP.
- TOTP login text now describes upstream support and older relays behind a
  proxy configured to translate WebSocket TOTP codes.
- Typing notifications accept upstream WeeChat's event names as well as the
  original experimental names.
- Settings and documentation give the typing requirement as WeeChat 5.0.0
  development builds with relay typing support, rather than relay API 0.8.0.

## 1.1.0 — 2026-11-12

### Added
- **Typing notifications.** A label above the message box says who is typing in
  the open channel, and your own typing is sent to WeeChat while you write.
  Needs relay API 0.8.0 or newer. On older relays Weave gives up after the
  first 404. Settings → Behaviour has a switch, on by default.
- **Experimental TOTP login** for relays running the totp-websocket branch of
  WeeChat. Tick TOTP on the connection form and enter the six-digit code beside
  the password. It needs TLS, and codes are never saved.

### Fixed
- Flipping a switch in Settings could scroll the dialog off screen. The next
  click then closed it and left the page blurred.

## 1.0.0 — 2026-11-09

### Added
- Configurable PrivateBin paste guard for messages longer than seven lines.
- GitHub repository link in the landing-page footer.
- Website release version in Settings → About.
- Deployment over SSH on port 2222 when a stable GitHub release is published,
  with version-tag validation and manual checks that do not upload files.

### Changed
- Removed letter avatars from the member list while retaining nick colors,
  role prefixes, and away indicators.
- Improved paste-upload connection error messages.
- Downloadable HTML includes its styles and script for local opening on Android.

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

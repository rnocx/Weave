# Weave

A self-contained web client for [WeeChat](https://weechat.org/)'s **API relay**
(WeeChat ≥ 4.0). The whole app is three static files — `index.html`,
`weave.css` and `weave.js` — with no build step, no dependencies, and no
external requests.

## Features

- Real-time chat over the relay's JSON/WebSocket API (`/api`), with automatic
  reconnect and exponential backoff
- **Hashed authentication**: the client asks the relay which algorithm it wants
  (`POST /api/handshake`) and sends a salted PBKDF2/SHA-2 hash, so your password
  is never sent in plain text. It falls back to a plain password if the
  handshake isn't reachable
- Sidebar grouped by IRC server, with unread and mention badges and
  collapsible groups; joining a channel from the sidebar
- Quick switcher (<kbd>Ctrl</kbd>+<kbd>K</kbd>) with fuzzy matching
- **Command palette** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>, or type
  `/` in the message box): every command your WeeChat has, with descriptions
  and arguments; <kbd>Enter</kbd> inserts it, <kbd>Shift</kbd>+<kbd>Enter</kbd>
  shows its full `/help`
- Search within a buffer (<kbd>Ctrl</kbd>+<kbd>F</kbd>): highlighted matches,
  step through them, "Only matches" filter, and "Search older" to pull more
  history from the relay
- Pin buffers to the top and reorder the sidebar (drag and drop, or
  right-click / long-press a buffer for its menu); kept in your browser, so
  WeeChat's own buffer numbers don't change
- "Mark all as read" (<kbd>Shift</kbd>+<kbd>Esc</kbd>), synced to WeeChat's hotlist
- Clean message view: day separators, an unread marker, grouping of consecutive
  messages, highlight styling, compact join/part rows, `/me` actions
- WeeChat colours rendered faithfully and contrast-corrected for the light and
  dark themes
- **Colour themes**: pick one for dark mode (Weave, Solarized, Gruvbox,
  Catppuccin Mocha, Nord, Dracula, Monokai, Tokyo Night, One Dark, Glacier) and
  one for light mode (Weave, Solarized, Gruvbox, Catppuccin Latte). Each sets
  the 16 terminal colours IRC colours use, from iTerm2-Color-Schemes, and the
  theme's own accent unless you pick one
- Member list with ranks (ops, voiced, …) and a nick menu (mention, query,
  whois, kick/ban for ops)
- **Server-side tab completion** via `POST /api/completion`: nicks, commands,
  channels and options, exactly as in WeeChat
- Input history, multi-line input, per-buffer drafts
- Infinite scroll-back that loads older lines on demand
- WeeChat's tool buffers work like in the terminal (`/fset`, `/script`, …):
  their own keys (e.g. <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>Alt</kbd>+<kbd>Space</kbd>,
  <kbd>Alt</kbd>+<kbd>Enter</kbd>) are passed through
- **fset, the options editor:** click or tap an option to select it, click it
  again to edit its value in the message box, a toolbar for touch screens
  (Edit, Toggle, −1/+1, Reset, Unset, Mark, Details), and typing filters the
  options
- Read-state sync: clears WeeChat's hotlist and moves its read marker as you
  read. Optionally switches WeeChat's current buffer too
- Desktop notifications for highlights and private messages; unread count in
  the page title and favicon. Notifications can be dismissed (× on in-app
  ones) and are cleared when you open their buffer
- **Per-buffer notifications** from the buffer menu (right-click / long-press):
  all messages, mentions only (only highlights count and notify), or mute (no
  notifications, no counts). Kept in your browser, like pins
- **Message menu** (right-click / long-press a message): reply to the sender,
  quote it, copy its text or its links
- **File uploads** to your own [Jirafeau](https://gitlab.com/jirafeau/Jirafeau)
  server, or to [Litterbox](https://litterbox.catbox.moe),
  [tmpfiles.org](https://tmpfiles.org) or [Filebin](https://filebin.net): attach, drag and
  drop, or paste a screenshot, and the link goes into your message
  (see [File uploads](#file-uploads))
- Optional inline image and video previews (off, on click, or automatic)
- Themes: system, light or dark; 7 accent colours; sans or mono font; four text
  sizes; comfortable or compact density; 12/24h clock
- Works on phones (portrait and landscape): see [On phones](#on-phones)

## WeeChat setup

```
/set relay.network.password "a-strong-password"
/relay add tls.api 9000        # TLS (needs relay.network.tls_cert_key)
# or, on a trusted LAN / localhost only:
/relay add api 9000
```

Don't use ports 6665–6669 or 6697: browsers refuse to connect to them.

## Running it

It's three static files; keep them together in one folder. Pick one:

- **Open it directly**: `index.html` via `file://` works against a `ws://` relay.
- **Serve it locally**: `python3 -m http.server 8080`, then open
  <http://localhost:8080>.
- **Host it behind your web server** (recommended). Serve the folder and
  proxy `/api` to the relay on the same origin, so a single TLS certificate
  covers both. The connect form defaults to the page's own host, port 443,
  TLS on.

### Caddy

```caddy
chat.example.com {
    root * /var/www/weave
    file_server
    reverse_proxy /api* 127.0.0.1:9000
}
```

### nginx

```nginx
location / {
    root /var/www/weave;
    index index.html;
}
location /api {
    proxy_pass http://127.0.0.1:9000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 1d;
}
```

With a proxy in front, the relay itself can be a plain `/relay add api 9000`
bound to localhost (`/set relay.network.bind_address "127.0.0.1"`).

### Mac app

`macos/` holds a native macOS shell (a `WKWebView` around these same three
files, with system notifications and a Dock badge). It builds from the files in
this folder, so one edit updates both. See `macos/README.md`.

### Public hosting

Weave can also be hosted publicly, so anyone opens it from one address and
connects to *their own* relay. The server only delivers the three files: it
stores nothing and never sees chat traffic or passwords, since the browser
talks straight to the user's relay. See `PUBLIC-HOSTING.md` for the full plan.

1. Build the public copy: `deploy/build-public.sh [source-url]`. It writes
   `deploy/dist/` with `CONFIG.mode` set to `'public'`, no Jirafeau default,
   and `weave.zip` (the app, for people who'd rather host it themselves or
   open it locally).
2. Copy `deploy/dist/*` to the web root and use `deploy/Caddyfile` or
   `deploy/nginx.conf`. Both serve only the app's files over HTTPS, write no
   request logs, and send the security headers (`frame-ancestors 'none'`,
   `no-referrer`, `nosniff`, HSTS, a locked-down `Permissions-Policy`,
   `Cache-Control: no-cache` with ETags).

In public mode:

- The connect form starts empty and TLS on, unless a WeeChat relay answers at
  the page's own address, in which case it's filled in.
- Uploads are **Off** until a user picks a service in Settings.
- The connect screen shows a privacy note and the relay-owner checklist
  below, with the exact `websocket_allowed_origins` command for the page's
  address.
- Before connecting, the only request other than the page itself is that
  check of the page's own `/api/handshake`; after that, only the user's relay.

#### Relay-owner checklist

To use a publicly hosted Weave (say `https://weave.example.com`), your relay
needs:

1. **TLS:** `/relay add tls.api 9000` with a certificate your browsers trust,
   or a reverse proxy or Tailscale Serve in front of a plain `api` relay. An
   HTTPS page can't connect to plain `ws://`, and self-signed certificates
   have to be accepted on every device, which is awkward on phones.
2. **To be reachable** from wherever your browser runs: over the internet, or on
   the same VPN or tailnet as your device.
3. **To allow the Weave origin:**
   `/set relay.network.websocket_allowed_origins "^https://weave\.example\.com$"`
4. **`relay.network.allowed_ips`** to allow your devices (or `127.0.0.1` when a
   proxy sits in front).
5. **A strong relay password.** It's sent hashed when the relay supports it
   (WeeChat's API answers cross-origin handshakes, so this works from any
   address).

Relays on private or Tailscale addresses may make the browser ask for
local-network access (e.g. Chrome's "Local Network Access" prompt).

### Self-signed certificates

If the relay uses a self-signed certificate, the connection fails until the
browser trusts it. The connect screen's error then links to
`https://host:port/api/version`: open it, accept the warning, and connect
again.

## File uploads

To upload, click 📎 in the message box, drop files onto the chat, or paste an
image. The link is inserted into the message box (or, if you choose, sent
right away). Four services are supported; pick one under
**Settings → File uploads**:

| | **Jirafeau** | **Litterbox** | **tmpfiles.org** | **Filebin** |
|---|---|---|---|---|
| Hosting | Your own server | Public (catbox.moe) | Public | Public |
| Setup | A CORS header on the server (below) | None | None | None |
| Max size | Your `maximal_upload_size` | 1 GB | 100 MB | Not published |
| Kept for | Any duration your server allows | 1 h, 12 h, 1 day or 3 days | 1 h, 6 h, 1 day or 2 days | About 6 days |
| Link goes to | The file (inline view for media) | The file | A download page | The file |
| Delete early | Yes: delete links under Recent uploads | Not possible | Not possible | Yes, on the bin page ("Manage…" under Recent uploads) |
| Progress bar | Yes | No (animated bar) | Yes | Yes |

The public services need no account, and anyone with a link can download the
file until it expires. Don't use them for anything private.

The default service is set in the `CONFIG` block near the top of `weave.js`; each
user can change it in Settings:

```js
const CONFIG = {
  mode: 'personal',                          // 'public': no upload default (see Public hosting)
  uploadBackend: 'jirafeau',                 // 'jirafeau', 'litterbox', 'tmpfiles', 'filebin' or 'off'
  uploadUrl: 'https://files.interdo.me/',   // Jirafeau base URL
  uploadTime: 'day',
  ...
};
```

### Litterbox

Uploads go to [litterbox.catbox.moe](https://litterbox.catbox.moe) with no
account. Anyone with the link can download the file until it expires. The
link keeps the file's extension, so chat clients show image previews. Don't
use it for anything private.

Litterbox rejects the CORS preflight a browser sends when a page tracks upload
progress, so Litterbox uploads show an animated "Uploading…" bar instead of a
percentage. Its firewall can also temporarily block a network after many
failed requests; the app then reports HTTP 403.

### tmpfiles.org

Uploads go to [tmpfiles.org](https://tmpfiles.org)'s API. The link opens the
file's download page rather than the file itself: tmpfiles.org's direct links
are signed and only work for a short time, so they can't be shared. Chat clients
therefore show no image preview for these links.

### Filebin

Uploads go to [filebin.net](https://filebin.net). Filebin keeps files in
"bins", and anyone who knows a bin's address can see and delete everything in
it. So Weave gives every upload its own randomly named bin. The link points
straight at the file and keeps its extension. File names are simplified to
letters, digits, `.`, `-` and `_`.

Filebin's CORS setup allows uploads from a web page but not the `DELETE`
request used for deleting. To delete a file, open **Manage…** next to it under
Recent uploads: that's the bin's page on filebin.net, which has a delete
button.

### Jirafeau

Tested with Jirafeau 4.7. Settings also offer an upload password (if the
server requires one), one-time downloads, and a **Test** button that checks the
server. Links to images, video, audio and plain text use Jirafeau's inline view
(`&p=1`) and carry the file name after `#`: `…/f.php?h=abc&p=1#cat.png`. The
server ignores that part, but readers see what the file is and chat clients
recognise it as media. Recent uploads, with their delete links, are listed in
Settings.

Uploads use Jirafeau's chunked API (`script.php?init_async/push_async/end_async`,
the same one its web page uses). Chunks are sized from the server's
`get_capacity`, so PHP's `upload_max_filesize` / `post_max_size` don't cap the
file size; the only limit is Jirafeau's `maximal_upload_size`. If a proxy
rejects a chunk as too large (HTTP 413), the client retries with smaller ones.

### Server requirement: CORS

The browser only lets Weave read Jirafeau's responses if `script.php` sends
an `Access-Control-Allow-Origin` header. Jirafeau doesn't do this by default.
Without it, uploads fail with "Can't talk to the upload server".

**Apache** (in the Jirafeau vhost; needs `mod_headers`, e.g. `a2enmod headers`):

```apache
<Files "script.php">
    Header always set Access-Control-Allow-Origin "https://chat.example.com"
</Files>
```

**nginx** (inside the `location` that runs `script.php` through PHP):

```nginx
add_header Access-Control-Allow-Origin "https://chat.example.com" always;
```

Use the exact origin Weave is served from (scheme, host and port, with no
trailing slash). `*` also works, and is needed if you open Weave from
`file://`, but it lets any website use your upload API from its visitors'
browsers. No preflight handling is needed: uploads are plain `multipart/form-data`
POSTs.

Alternatively, serve Jirafeau under the same origin as Weave through a
reverse proxy (e.g. `https://chat.example.com/files/` → Jirafeau) and set that
URL in Settings; then no CORS header is required.

Not supported: Jirafeau download passwords (`download_password_requirement =
'required'`) and client-side encryption options beyond what the server does
itself (`enable_crypt` links work).

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> | Jump to buffer |
| <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | Previous / next buffer |
| <kbd>Alt</kbd> + <kbd>A</kbd> | Next buffer with activity (mentions first) |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>F</kbd> | Search this buffer (<kbd>Enter</kbd> older, <kbd>Shift</kbd>+<kbd>Enter</kbd> newer) |
| <kbd>Shift</kbd> + <kbd>Esc</kbd> | Mark all buffers as read |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | Move the current buffer up / down in the sidebar |
| Right-click a buffer | Buffer menu: pin, move, mark as read, leave (long-press on touch screens) |
| In `/fset`, `/script`… | The buffer's own WeeChat keys (e.g. <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>Alt</kbd>+<kbd>Space</kbd> toggle, <kbd>Alt</kbd>+<kbd>Enter</kbd> edit, <kbd>Alt</kbd>+<kbd>F</kbd> <kbd>Alt</kbd>+<kbd>R</kbd> reset) |
| <kbd>Alt</kbd> + <kbd>1</kbd>…<kbd>0</kbd> | Buffer by number |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | Complete (cycle forward / back) |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Input history |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | New line |
| <kbd>PgUp</kbd> / <kbd>PgDn</kbd> | Scroll messages |
| <kbd>Esc</kbd> | Close menus and drawers |

Start typing anywhere to focus the input.

## On phones

On narrow screens, and on phones held sideways, Weave switches to a phone layout:

- **Buffers and members** are drawers: tap ☰ or swipe right for buffers, tap
  the member count or swipe left for members. A dot on ☰ shows activity in
  other buffers (red for mentions).
- **Back** (Android button or gesture) closes the open drawer, menu or
  settings instead of leaving the app.
- **Messages** are stacked: nick and time on one line, the text below, using
  the full width.
- **The ⇥ button** in the message box does nick/command completion, since
  phone keyboards have no Tab key. It and Send keep the keyboard open.
- **Nick menus** open as bottom sheets; **Settings** is full screen.
- Tap targets are finger-sized, and inputs use 16px text so iOS doesn't zoom
  in when you tap them. On iOS the layout follows the on-screen keyboard, so
  the message box stays visible above it.

### Install as an app

Weave can be installed to the home screen or desktop, and then opens in its
own window without the browser's address bar:

- **Android / Chrome / Edge:** Settings → App → **Install** (or the browser's
  own install menu entry).
- **iPhone / iPad:** in Safari, tap Share → **Add to Home Screen**.

The manifest and icons are generated by the page itself (in your accent
colour), so no extra files are needed. **Installing requires HTTPS** (or
`localhost`): from a plain `http://` address, such as a LAN or Tailscale IP,
browsers refuse with "This app cannot be installed". HTTPS also lets the
client hash your relay password instead of sending it in plain text.

#### HTTPS on a tailnet with Tailscale Serve

If you reach Weave over [Tailscale](https://tailscale.com), Tailscale Serve
gives it a real certificate without opening anything to the internet:

1. In the Tailscale admin console, under **DNS**, make sure MagicDNS is on and
   enable **HTTPS Certificates**.
2. On the machine running WeeChat, put the relay at the root of an HTTPS port
   and Weave under `/weave` (`8443` avoids clashing with another web server
   on 443):

   ```sh
   sudo tailscale serve --bg --https=8443 http://127.0.0.1:9000
   sudo tailscale serve --bg --https=8443 --set-path /weave /path/to/weave
   ```

   Point it at WeeChat's plain `api` port, not `tls.api`: Tailscale already
   provides the TLS. Browsers still connect with `wss://`, and only the hop
   inside the machine is unencrypted.

   Tailscale Serve strips a handler's path prefix before forwarding, and
   WeeChat only accepts its WebSocket at exactly `/api`. That's why the relay
   is mounted at `/`, which is forwarded unchanged, rather than at `/api`.

3. Open `https://<machine>.<tailnet>.ts.net:8443/weave/` on your devices. The
   connect form fills in that host, port 8443, TLS on and path `/api` by itself.

The relay then sees connections from `127.0.0.1`, so `relay.network.allowed_ips`
must include `127.0.0.1` (or be empty); you don't need to list each device.
Undo with `sudo tailscale serve --https=8443 off`.

## Privacy and storage

Settings (including an upload password, if set), recent upload links with
their delete codes, the last connection (host, port, TLS) and input history are kept in
`localStorage`. The password is stored only if you tick **Remember password**,
and then unencrypted. Input lines that look like secrets (NickServ/ChanServ
commands, `/secure`, `/oper`, channel keys, password options) are never saved
to history, and saving history can be turned off in Settings.
Media previews load images from the linked hosts, so they're off by default
("on click").

## Connection behaviour

- The client pings the relay every 30 seconds and reconnects if there's no
  answer within 10. It also checks immediately when the tab becomes visible
  again or the network changes.
- If a login is rejected, the client asks the relay why and says so: a wrong
  password, or a device clock more than `relay.network.time_window` seconds
  off (hashed passwords are salted with the current time). Over TLS, a clock
  problem falls back to the plain password automatically.
- A rejected login during reconnect goes straight back to the login screen
  instead of retrying. If the relay is unreachable, retries continue with
  backoff; after 5 failures the banner offers **Back to login**.
- Sending more than 3 lines at once asks for a second <kbd>Enter</kbd>.

## Notes

- WeeChat logs `relay: error decoding websocket frame` whenever a browser
  closes the connection normally. That's the relay reacting to the standard
  close frame and is harmless.
- Tested against WeeChat 4.9.0 (relay API 0.4.1).

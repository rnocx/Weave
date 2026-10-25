# Plan: public hosting of Weave

**Goal:** anyone can open Weave from a public address and connect to *their
own* WeeChat relay. The hosting server only serves the file: it stores
nothing and never sees chat traffic or passwords.

**Why this works:** Weave is a single static file with no backend. The
browser connects directly to the user's relay, and everything Weave remembers
(settings, saved connection, drafts, history) is kept in that browser's local
storage.

Status: Phases 1–4 are implemented except the optional saved relays (1.5)
and publishing the source (4.1); Phase 5 is partly done (tested locally, not
yet on real devices or a live server). Tracked as P7 in TODO.md.

## Phase 1 — App changes (`weave.js` / `index.html`)

1. ✅ **Deployment switch.** Add `CONFIG.mode: 'personal' | 'public'`, so a
   personal instance (e.g. behind Tailscale Serve) and the public one run the
   same file. *(`deploy/build-public.sh` sets it, and blanks the Jirafeau URL,
   in the copy it builds.)*
2. ✅ **Uploads off by default in public mode.** No Jirafeau default, so nobody
   uploads to the host's server. The public services (Litterbox, tmpfiles.org, Filebin) stay available as an opt-in per
   user.
3. ✅ **Smarter connect form.** Pre-fill host and port only if a WeeChat relay
   actually answers at the page's own address. Otherwise leave the host empty
   and focus it.
4. ✅ **Public-mode hints on the connect screen.** Explain that the relay needs
   `wss://` with a valid certificate, and link to the relay-owner checklist
   (Phase 3). *(The checklist is on the connect screen itself, with the
   `websocket_allowed_origins` command for the page's own address. A relay
   that refuses the WebSocket gets that command in the error too, and an HTTPS
   page refuses TLS-off relays with an explanation.)*
5. *(Optional, open: TODO #28)* **Several saved relays** per browser, each with its own name,
   host, port and password setting.

*Done when:* in public mode a fresh browser shows an empty host, uploads are
Off, and nothing is sent anywhere except to the relay the user enters.

## Phase 2 — Hosting server (static only) ✅

`deploy/Caddyfile` and `deploy/nginx.conf`, both tested locally (Caddy 2.10,
nginx 1.30): headers present, other paths 404, ETag revalidation, and no
request log entries.

1. **Serve only the three app files over HTTPS** (`index.html`, `weave.css`,
   `weave.js`), with Caddy or nginx and Let's Encrypt. No backend, and no
   proxying of anyone's relay.
2. **No logs.** Turn access logging off (or anonymise IPs), and don't log
   request details on errors.
3. **Security headers:**
   - `Content-Security-Policy: frame-ancestors 'none'` (this one only works as
     a header, not in the page)
   - `Referrer-Policy: no-referrer`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security`
   - `Permissions-Policy` locked down
   - leave `connect-src` open, since users' relays can be at any address
4. **Caching:** `Cache-Control: no-cache` plus ETag, so updates reach users
   promptly.
5. **No third parties:** no analytics or CDNs (Weave already loads nothing
   external).

*Done when:* a request to the site leaves no log entry, the headers above are
present, and the browser's network log shows only the page itself plus the
user's relay.

## Phase 3 — Relay-owner checklist ✅

Goes in the README and is linked from the connect screen.

1. **TLS relay:** `/relay add tls.api <port>` with a real certificate, or a
   reverse proxy or Tailscale Serve in front of the plain `api` port. An HTTPS
   page can't connect to plain `ws://`, and self-signed certificates must be
   accepted in every browser (painful on phones).
2. **Reachable** from wherever the user's browser runs: the internet, or the
   same VPN/tailnet as their device.
3. **Lock the relay to the Weave origin:**
   `/set relay.network.websocket_allowed_origins "^https://weave\.example\.com$"`
4. **`allowed_ips`** must allow the user's devices (or `127.0.0.1` when a
   proxy sits in front).
5. **A strong relay password.** Hashed login works automatically over HTTPS.
6. **Note:** relays on private or Tailscale addresses may trigger the
   browser's local-network permission prompt (e.g. Chrome's "Local Network
   Access").

## Phase 4 — Trust and transparency

Even with nothing stored on the server, users have to trust whoever serves the
file: whoever controls the server could change the code to capture passwords.

1. *(Open)* Publish the source, and state plainly that the server stores nothing.
2. ✅ Offer a download of the app (a zip of the three files, or a combined
   single-file build), so users can self-host it or open it locally instead.
   *(`weave.zip`, built by `deploy/build-public.sh` and linked from the
   connect screen. A single-file build would need an inline script, which the
   CSP forbids.)*
3. ✅ Short privacy note on the connect screen: "Your settings and password stay
   in this browser".

## Phase 5 — Verification before launch

1. **Test relays:** connect from a fresh browser (desktop and phone) to a
   relay with a real certificate, and to one on a tailnet.
2. **Nothing left behind:** confirm there's no server-side log entry, and that
   the browser's storage is the only place data lives.
3. **Regression:** run the existing test suites in public mode (connect,
   uploads Off and the public services, install, phones).

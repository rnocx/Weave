# Repository screenshots

These images show the web app with sample conversations and relay details.
They contain no real credentials or chat history.

To regenerate all seven screenshots from the repository root, install Playwright
in a temporary directory and use the installed Google Chrome:

```sh
npm install --prefix /tmp/weave-screenshots-runtime playwright --no-audit --no-fund
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/screenshots.cjs
```

The script runs a local server and a separate browser session. It blocks
external requests and sets the clock, locale, and timezone for consistent
captures. Weave renders the sample buffers, messages, and members; the script
opens settings and drawers through their buttons.

Desktop captures use a 1440 × 900 viewport; phone captures use 390 × 844.
All PNGs use 2× pixel density. Dark mode uses Weave; light mode uses
Catppuccin Latte. `settings.png` shows the Appearance section.
`scripts.png` shows the script buffer controls.

Review the images after capture, especially after changing how Weave renders
the page. The capture script fails if the page reports a JavaScript error.

To exercise script controls against a simulated relay (no real relay or
scripts are changed):

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-script-controls.cjs
```

To check scroll position during history loading, including messages arriving
while a request is pending and expanding history already in memory:

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-history-scroll.cjs
```

This uses a simulated relay and a touch viewport. Check flick scrolling on an
iPhone separately; browser automation does not reproduce native momentum.

To check app updates against a local server with long-lived HTTP caching:

```sh
deploy/build-public.sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-app-updates.cjs
```

This checks version detection, failed downloads, refreshed scripts and styles,
and settings and draft persistence after a reload.

To check the server's smart-filter option, changes from other clients, command
failures, stale responses, and message display flags:

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-message-filters.cjs
```

To check network and channel ordering, desktop dragging, touch menus,
persistence, resets, and preservation of WeeChat's buffer numbers:

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-sidebar-order.cjs
```

To check local-network permission handling and the stable/development relay
response formats (history counts, filtering events, read markers, and nick prefixes):

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-network-permissions.cjs
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-relay-compatibility.cjs
```

For live relay checks, the test starts and cleans up its own WeeChat instance,
using a temporary profile and a host port bound to loopback. Run it against the
latest release image and an installed headless binary built from upstream `main`:

```sh
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-relay-live.cjs --image weechat/weechat:4.10.5
NODE_PATH=/tmp/weave-screenshots-runtime/node_modules node tools/test-relay-live.cjs --binary /absolute/path/to/weechat-headless
```

This checks hashed login, history paging, counts and filter events when present,
stable fallbacks, and global option changes from a second relay client.

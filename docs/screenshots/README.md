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

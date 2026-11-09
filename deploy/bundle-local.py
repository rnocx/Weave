#!/usr/bin/env python3
"""Make a self-contained local index.html from the prepared public app files."""
import base64
import hashlib
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'weave.css').read_text(encoding='utf-8')
js = (root / 'weave.js').read_text(encoding='utf-8')
# Fail rather than silently producing HTML with prematurely closed raw-text tags.
if re.search(r'</style\b', css, re.I) or re.search(r'</script\b', js, re.I):
    raise SystemExit('bundle-local: embedded source contains a closing HTML tag')
digest = base64.b64encode(hashlib.sha256(js.encode('utf-8')).digest()).decode('ascii')
replacements = {
    '<link rel="stylesheet" href="weave.css">': '<style>' + css + '</style>',
    '<script src="weave.js"></script>': '<script>' + js + '</script>',
    "script-src 'self'": "script-src 'self' 'sha256-" + digest + "'",
    "<!-- Only Weave's own script may run (no inline or injected scripts).":
        "<!-- Only Weave's own script may run (the embedded script is hash-authorized).",
}
for old, new in replacements.items():
    if html.count(old) != 1:
        raise SystemExit(f'bundle-local: expected exactly one {old!r}')
    html = html.replace(old, new)
(root / 'index.html').write_text(html, encoding='utf-8')

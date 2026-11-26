#!/usr/bin/env python3
"""Verify that the website and its downloadable bundle contain the same release."""
import base64
import hashlib
from pathlib import Path
import re
import sys
from zipfile import BadZipFile, ZipFile


def verify(root, version):
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('expected version must use major.minor.patch')
    hosted_js = (root / 'weave.js').read_text(encoding='utf-8')
    hosted_css = (root / 'weave.css').read_text(encoding='utf-8')
    hosted_html = (root / 'index.html').read_text(encoding='utf-8')
    with ZipFile(root / 'weave.zip') as archive:
        damaged = archive.testzip()
        if damaged:
            raise ValueError(f'corrupt archive entry: {damaged}')
        local_js = archive.read('weave/weave.js').decode('utf-8')
        local_css = archive.read('weave/weave.css').decode('utf-8')
        local_html = archive.read('weave/index.html').decode('utf-8')
    for name, js in [('website', hosted_js), ('download', local_js)]:
        versions = re.findall(r"^  version: '([^']*)'", js, re.M)
        if versions != [version]:
            raise ValueError(f'{name} version {versions!r} does not match {version}')
    expected_url = f'weave.zip?v={version}'
    if re.findall(r"^  downloadUrl: '([^']*)'", hosted_js, re.M) != [expected_url]:
        raise ValueError('website must link to the versioned weave.zip download')
    # The website adds a download link. The rest of its code must match the ZIP.
    without_link, count = re.subn(r"^  downloadUrl: '[^']*'", "  downloadUrl: ''", hosted_js, flags=re.M)
    if count != 1 or without_link != local_js:
        raise ValueError('website JavaScript differs from the download')
    if hosted_css != local_css:
        raise ValueError('website CSS differs from the download')
    if f'<style>{local_css}</style>' not in local_html or f'<script>{local_js}</script>' not in local_html:
        raise ValueError('download HTML does not embed the current CSS and JavaScript')
    digest = base64.b64encode(hashlib.sha256(local_js.encode('utf-8')).digest()).decode('ascii')
    if f"'sha256-{digest}'" not in local_html:
        raise ValueError('download HTML does not authorize the embedded script')
    unbundled_html = local_html.replace(f'<style>{local_css}</style>', '<link rel="stylesheet" href="weave.css">', 1)
    unbundled_html = unbundled_html.replace(f'<script>{local_js}</script>', '<script src="weave.js"></script>', 1)
    unbundled_html = unbundled_html.replace(f"script-src 'self' 'sha256-{digest}'", "script-src 'self'", 1)
    unbundled_html = unbundled_html.replace(
        '<!-- Only Weave\'s own script may run (the embedded script is hash-authorized).',
        '<!-- Only Weave\'s own script may run (no inline or injected scripts).', 1)
    if unbundled_html != hosted_html:
        raise ValueError('website HTML differs from the download')


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]), sys.argv[2])
    except (IndexError, OSError, ValueError, KeyError, BadZipFile) as error:
        raise SystemExit(f'verify-public: {error}')
    print(f'Verified website and weave.zip for release {sys.argv[2]}')

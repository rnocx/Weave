#!/bin/sh
# Build the public site into deploy/dist/: the three app files with
# CONFIG.mode set to 'public' and no Jirafeau default, plus weave.zip (the
# same files, for people who want to host Weave themselves or open it locally).
# Usage: deploy/build-public.sh [source-url]
set -eu
cd "$(dirname "$0")/.."
out=deploy/dist
src_url=${1:-}
rm -rf "$out"
mkdir -p "$out/zip/weave"

# Apply one CONFIG edit and fail loudly if the line wasn't found.
edit() {  # edit <file> <sed-expr> <check-regex>
  sed -i "$2" "$1"
  grep -q "$3" "$1" || { echo "build-public: couldn't set $3 in $1" >&2; exit 1; }
}

cp index.html weave.css "$out/zip/weave/"
cp weave.js "$out/zip/weave/weave.js"
js=$out/zip/weave/weave.js
edit "$js" "s|^\(  mode: \)'personal'|\1'public'|" "^  mode: 'public'"
edit "$js" "s|^\(  uploadUrl: \)'[^']*'|\1''|" "^  uploadUrl: ''"
if [ -n "$src_url" ]; then
  esc=$(printf '%s' "$src_url" | sed 's/[|&\\]/\\&/g')
  edit "$js" "s|^\(  sourceUrl: \)'[^']*'|\1'$esc'|" "^  sourceUrl: '"
fi
cp README.md "$out/zip/weave/"
(cd "$out/zip" && zip -qrX ../weave.zip weave)

# The hosted copy also links to the zip.
cp "$out/zip/weave/index.html" "$out/zip/weave/weave.css" "$out/zip/weave/weave.js" "$out/"
edit "$out/weave.js" "s|^\(  downloadUrl: \)'[^']*'|\1'weave.zip'|" "^  downloadUrl: 'weave.zip'"
rm -rf "$out/zip"
ls -l "$out"

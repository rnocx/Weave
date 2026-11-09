#!/bin/sh
# Build the public site into deploy/dist/: the three app files with
# CONFIG.mode set to 'public' and no Jirafeau default, plus weave.zip (the
# same files, for people who want to host Weave themselves or open it locally).
# Usage: deploy/build-public.sh [source-url]
set -eu
cd "$(dirname "$0")/.."
out=deploy/dist
src_url=${1:-}
version=$(cat VERSION)
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo 'build-public: VERSION must use major.minor.patch' >&2
  exit 1
}
rm -rf "$out"
mkdir -p "$out/zip/weave"

# Apply one CONFIG edit and fail loudly if the line wasn't found.
edit() {  # edit <file> <sed-expr> <check-regex>
  sed "$2" "$1" > "$1.tmp"
  mv "$1.tmp" "$1"
  grep -q "$3" "$1" || { echo "build-public: couldn't set $3 in $1" >&2; exit 1; }
}

cp index.html weave.css "$out/zip/weave/"
cp weave.js "$out/zip/weave/weave.js"
js=$out/zip/weave/weave.js
edit "$js" "s|^\(  version: \)'[^']*'|\1'$version'|" "^  version: '$version'"
edit "$js" "s|^\(  mode: \)'personal'|\1'public'|" "^  mode: 'public'"
edit "$js" "s|^\(  uploadUrl: \)'[^']*'|\1''|" "^  uploadUrl: ''"
if [ -n "$src_url" ]; then
  esc=$(printf '%s' "$src_url" | sed 's/[|&\\]/\\&/g')
  edit "$js" "s|^\(  sourceUrl: \)'[^']*'|\1'$esc'|" "^  sourceUrl: '"
fi
# Keep personal deployment addresses out of the downloadable documentation.
sed 's|https://files.interdo.me/|https://files.example.com/|g' README.md > "$out/zip/weave/README.md"

# The hosted copy also links to the zip.
cp "$out/zip/weave/index.html" "$out/zip/weave/weave.css" "$out/zip/weave/weave.js" "$out/"
edit "$out/weave.js" "s|^\(  downloadUrl: \)'[^']*'|\1'weave.zip'|" "^  downloadUrl: 'weave.zip'"
# Android file openers may grant access to only the selected HTML file.
# Bundle the local entry point after copying the separate hosted files.
python3 deploy/bundle-local.py "$out/zip/weave"
(cd "$out/zip" && zip -qrX ../weave.zip weave)
rm -rf "$out/zip"
ls -l "$out"

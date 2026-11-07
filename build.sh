#!/usr/bin/env bash
# Build de Cloudflare Pages: publica solo el sitio, no docs/ ni supabase/.
set -euo pipefail

rm -rf dist
mkdir -p dist

cp *.html robots.txt llms.txt sitemap.xml _headers .nojekyll dist/
cp -r assets dist/

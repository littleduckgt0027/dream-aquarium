#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null; then echo 'Install Node.js 24 LTS first.'; exit 1; fi
npm ci
npm run db:migrate
npm run build
echo 'Dream Aquarium is starting. Open http://localhost:3000 in your browser.'
COOKIE_SECURE=false npm start

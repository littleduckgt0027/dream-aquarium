#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm_cache_dir="${1:-/tmp/dream-aquarium-npm-cache}"
# Downloads over normal verified TLS first. npm ci --offline still verifies lockfile integrity.
npm ci --cache "$npm_cache_dir"
docker build --build-context "npm-cache=$npm_cache_dir/_cacache" -f Dockerfile.offline -t dream-aquarium:local .

#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "$APP_DIR"

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ "$NODE_MAJOR" != "22" ]]; then
  echo "FlowChart requires Node.js 22.x (found $(node --version))." >&2
  exit 1
fi

# `npm run deploy` applies pending D1 migrations, builds the OpenNext bundle,
# then publishes it to the Worker configured in wrangler.jsonc.
npm ci
npm run type-check
npm run deploy

APP_URL="$(node -e 'const c=JSON.parse(require("fs").readFileSync("wrangler.jsonc","utf8")); process.stdout.write(c.vars.NEXT_PUBLIC_APP_URL)')"
curl --fail --silent --show-error --max-time 30 "$APP_URL/api/health" >/dev/null
echo "FlowChart deployed successfully to $APP_URL."

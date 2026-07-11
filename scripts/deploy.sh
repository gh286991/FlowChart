#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

npm install
npm run db:migrate
npm run build
npm run pm2:start
npx pm2 save

curl --fail --silent --show-error "http://127.0.0.1:3000/api/health" >/dev/null
echo "FlowChart deployed successfully with PM2."

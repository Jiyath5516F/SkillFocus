#!/usr/bin/env bash
# Install or update Mira on an Ubuntu VPS under /opt/mira, served at /Mira via nginx. Run as root.
set -euo pipefail
REPO=${REPO:-https://github.com/Jiyath5516F/SkillFocus.git}
APP=/opt/mira
DATA=/var/lib/mira

node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' \
  || { echo "Node >= 22.13 required (node:sqlite). Install Node 22 LTS first."; exit 1; }

id mira >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin mira
mkdir -p "$DATA" && chown mira:mira "$DATA" && chmod 700 "$DATA"

if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone --depth 1 "$REPO" "$APP"; fi
cd "$APP"
npm ci --no-audit --no-fund
MIRA_BASE_PATH=/Mira npm run build

if [ ! -f "$APP/.env" ]; then
  cp .env.example .env
  sed -i 's#^MIRA_BASE_PATH=.*#MIRA_BASE_PATH=/Mira#; s#^MIRA_DB_PATH=.*#MIRA_DB_PATH=/var/lib/mira/mira.db#; s#^HOST=.*#HOST=127.0.0.1#' .env
  echo ">>> Edit $APP/.env and set ANTHROPIC_API_KEY, then re-run this script."
fi
chown -R mira:mira "$APP" && chmod 600 "$APP/.env"

cp deploy/mira.service /etc/systemd/system/mira.service
systemctl daemon-reload
systemctl enable --now mira
systemctl restart mira
sleep 2
curl -fsS http://127.0.0.1:8090/Mira/api/health && echo " <- Mira API healthy"

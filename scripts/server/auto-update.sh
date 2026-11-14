#!/usr/bin/env bash
# Holt neue Versionen von GitHub und baut Resello neu – läuft alle 10 Minuten (systemd-Timer).
# data/, .env und Tailscale-Zustand stehen in .gitignore und bleiben unberührt.
set -euo pipefail
cd "$(dirname "$0")/../.."
export GIT_SSH_COMMAND="ssh -i /root/.ssh/resello-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "${1:-}" != "--jetzt" ]; then
  exit 0
fi
echo "$(date -Is) Update auf $(git rev-parse --short origin/main)"
git reset --quiet --hard origin/main
chown -R 1000:1000 data 2>/dev/null || true
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "$(date -Is) fertig"

#!/usr/bin/env bash
# Resello auf dem Linux-Server einrichten und starten (einmalig).
# Aufruf im Projektordner:  bash scripts/server/einrichten.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
gruen() { printf '\033[32m%s\033[0m\n' "$1"; }
gelb() { printf '\033[33m%s\033[0m\n' "$1"; }

echo; gruen "Resello – Server-Einrichtung"; echo "Ordner: $(pwd)"; echo

if ! command -v docker >/dev/null 2>&1; then
  gelb "Docker fehlt – wird installiert …"
  curl -fsSL https://get.docker.com | sh
fi

mkdir -p data tailscale/state

if [ -f .env ]; then
  gelb ".env gibt es schon – bleibt unverändert."
else
  read -rp "1/3  Tailscale-Auth-Key (beginnt mit tskey-auth-): " TSKEY
  read -rp "2/3  Gemini-API-Key (leer lassen = später eintragen): " GEMINI
  read -rsp "3/3  Passwort für das Resello-Dashboard: " PASS; echo
  TOKEN=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40 || true)
  sed -e "s|^APP_PASSWORD=.*|APP_PASSWORD=${PASS}|" \
      -e "s|^EXTENSION_TOKEN=.*|EXTENSION_TOKEN=${TOKEN}|" \
      -e "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${GEMINI}|" \
      -e "s|^TS_AUTHKEY=.*|TS_AUTHKEY=${TSKEY}|" \
      .env.example > .env
  chmod 600 .env
  gruen "✔ .env angelegt"
fi

# Container läuft als Benutzer 1000
chown -R 1000:1000 data

# Automatische Updates von GitHub alle 10 Minuten
cat > /etc/systemd/system/resello-update.service <<UNIT
[Unit]
Description=Resello: Update von GitHub
After=network-online.target docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash $(pwd)/scripts/server/auto-update.sh
UNIT
cat > /etc/systemd/system/resello-update.timer <<UNIT
[Unit]
Description=Resello: alle 10 Minuten nach Updates schauen
[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now resello-update.timer >/dev/null
gruen "✔ Automatische Updates aktiv (alle 10 Minuten)"

echo; gelb "Baue und starte Resello – beim ersten Mal ca. 5 Minuten …"
docker compose up -d --build

echo
gruen "✔ Läuft. Öffne am PC/Handy (Tailscale an):  https://resello.<dein-tailnet>.ts.net"
echo "  Die genaue Adresse steht in der Tailscale-App unter „Machines“ → resello."
echo "  Protokoll:   docker compose logs -f app"
echo

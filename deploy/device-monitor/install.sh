#!/bin/bash
# Pasang/perbarui agent device-monitor di PC lokal.
# Usage: sudo bash deploy/device-monitor/install.sh [/path/ke/file.env]
#   file.env hanya diperlukan saat pemasangan pertama (berisi MONITOR_TOKEN).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo"; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/device-monitor
RUN_USER=trans-laut-jatim
ENV_SRC="${1:-}"

install -d -o root -g root -m 755 "$DEST"
install -o root -g root -m 644 "$SRC/agent.mjs" "$DEST/agent.mjs"

if [ -n "$ENV_SRC" ]; then
  install -o "$RUN_USER" -g "$RUN_USER" -m 600 "$ENV_SRC" "$DEST/.env"
  echo "Env dipasang ke $DEST/.env (izin 600)"
elif [ ! -f "$DEST/.env" ]; then
  echo "Belum ada $DEST/.env: jalankan ulang dengan path file env berisi MONITOR_TOKEN"; exit 1
fi
grep -q '^MONITOR_TOKEN=.\+' "$DEST/.env" || { echo "MONITOR_TOKEN kosong di $DEST/.env"; exit 1; }

install -o root -g root -m 644 "$SRC/device-monitor.service" /etc/systemd/system/device-monitor.service
systemctl daemon-reload
systemctl enable device-monitor.service >/dev/null
systemctl restart device-monitor.service
sleep 8
systemctl --no-pager --lines=15 status device-monitor.service || true

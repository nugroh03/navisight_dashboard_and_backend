#!/bin/bash
# Pemulihan rekaman per kamera: jika kamera online tetapi tidak ada file rekaman
# baru, restart monitor Shinobi itu saja. Tidak pernah me-reboot PC; Shinobi yang
# mati total ditangani shinobi-health.sh.
# Pakai APPLY=0 untuk hanya mencatat tanpa me-restart.
set -uo pipefail

ENV_FILE="${ENV_FILE:-/etc/shinobi-watch.env}"
[ -r "$ENV_FILE" ] && . "$ENV_FILE"

APPLY="${APPLY:-0}"
GROUP_KEY="${GROUP_KEY:-WL3ksOMv0g}"
SHINOBI_API_KEY="${SHINOBI_API_KEY:-}"
URL="${URL:-http://127.0.0.1:8080}"
VIDEOS="${VIDEOS:-/video/shinobi/videos/$GROUP_KEY}"
STATE_DIR="${STATE_DIR:-/var/lib/shinobi-watch}"
LOG="${LOG:-/var/log/shinobi-watch.log}"
STALE_MIN="${STALE_MIN:-12}"           # segmen rekaman 5 menit
BOOT_GRACE_SEC="${BOOT_GRACE_SEC:-600}"
COOLDOWN_SEC="${COOLDOWN_SEC:-900}"    # jeda antar-restart per kamera
MAX_RESTARTS="${MAX_RESTARTS:-4}"      # batas per WINDOW_SEC per kamera
WINDOW_SEC="${WINDOW_SEC:-21600}"
MAX_DISK_PCT="${MAX_DISK_PCT:-97}"

# monitor_id:ip_kamera
MONITORS=(
  cSLk5GJCDC:192.168.1.34
  IWZbQL1uJm:192.168.1.43
  lvWkO76ScO:192.168.1.51
  jzPE6pDnUs:192.168.1.102
  L1czXsWT8h:192.168.1.106
  5IlPRRxheX:192.168.1.130
  f960kt4AKJ:192.168.1.141
  LQIwuTCf5g:192.168.1.170
)

log() { echo "$(date '+%F %T') | $*" >> "$LOG"; }

mkdir -p "$STATE_DIR"
exec 9> "$STATE_DIR/lock"
flock -n 9 || exit 0

uptime_sec=$(cut -d. -f1 /proc/uptime)
[ "$uptime_sec" -lt "$BOOT_GRACE_SEC" ] && exit 0
[ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$URL/")" = "200" ] || exit 0

disk_pct=$(df --output=pcent "$VIDEOS" | tail -1 | tr -dc '0-9')
if [ "$disk_pct" -ge "$MAX_DISK_PCT" ]; then
  log "SKIP disk /video ${disk_pct}%: restart tidak akan membantu"
  exit 0
fi

now=$(date +%s)
for entry in "${MONITORS[@]}"; do
  mid="${entry%%:*}"
  ip="${entry##*:}"
  state_file="$STATE_DIR/$mid.state"
  history_file="$STATE_DIR/$mid.restarts"
  prev_state=$(cat "$state_file" 2>/dev/null || true)

  if [ -n "$(find "$VIDEOS/$mid" -type f -name '*.mp4' -mmin "-$STALE_MIN" -print -quit 2>/dev/null)" ]; then
    state=recording
  elif ! timeout 3 bash -c "</dev/tcp/$ip/554" 2>/dev/null; then
    state=camera_offline
  else
    state=stalled
  fi

  if [ "$state" != "$prev_state" ]; then
    log "$mid ($ip): ${prev_state:-awal} -> $state"
    echo "$state" > "$state_file"
  fi
  [ "$state" = stalled ] || continue

  if [ "$APPLY" != 1 ] || [ -z "$SHINOBI_API_KEY" ]; then
    log "$mid ($ip): macet, TIDAK di-restart (mode pantau)"
    continue
  fi

  # Monitor yang sengaja tidak bermode record tidak boleh dipaksa merekam.
  if ! curl -s -m 10 "$URL/$SHINOBI_API_KEY/monitor/$GROUP_KEY/$mid" |
    grep -qE '"mode": *"record"'; then
    log "$mid ($ip): mode bukan record atau tidak terbaca, dilewati"
    continue
  fi

  recent=$(awk -v min=$((now - WINDOW_SEC)) '$1 >= min' "$history_file" 2>/dev/null || true)
  last=$(tail -1 <<<"$recent")
  count=$(grep -c . <<<"$recent")
  if [ -n "$last" ] && [ $((now - last)) -lt "$COOLDOWN_SEC" ]; then
    continue
  fi
  if [ "$count" -ge "$MAX_RESTARTS" ]; then
    log "$mid ($ip): batas $MAX_RESTARTS restart tercapai, perlu dicek manual"
    continue
  fi

  code=$(curl -s -o /dev/null -m 30 -w '%{http_code}' \
    "$URL/$SHINOBI_API_KEY/monitor/$GROUP_KEY/$mid/record?reset=1")
  { [ -n "$recent" ] && echo "$recent"; echo "$now"; } > "$history_file"
  log "$mid ($ip): restart monitor, HTTP $code"
done

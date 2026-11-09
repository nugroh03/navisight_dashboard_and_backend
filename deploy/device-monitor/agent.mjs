#!/usr/bin/env node
// Agent pemantau hidup/mati PC lokal, kamera, dan internet Starlink.
// Melapor ke dashboard (POST /api/monitoring/report) tiap INTERVAL_SEC; laporan sekaligus
// heartbeat. Hanya membaca: cek TCP ke kamera/internet, membaca journal & /proc.
// TIDAK menyentuh Shinobi, go2rtc, atau kamera.
//
// Env (lihat .env.example): MONITOR_URL, MONITOR_TOKEN, CAMERAS, ROUTER_IP,
// INTERNET_TARGETS, INTERVAL_SEC, STATE_DIRECTORY. Flag: --once (satu siklus lalu keluar),
// --dry-run (cetak laporan, tidak mengirim).
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = new Set(process.argv.slice(2));
const ONCE = args.has('--once');
const DRY_RUN = args.has('--dry-run') || process.env.DRY_RUN === '1';

const env = process.env;
const CONFIG = {
  url: env.MONITOR_URL ?? 'https://translautjatim.com/api/monitoring/report',
  token: env.MONITOR_TOKEN ?? '',
  intervalMs: Math.max(10, Number(env.INTERVAL_SEC) || 30) * 1000,
  stateDir: env.STATE_DIRECTORY || env.STATE_DIR || '/var/lib/device-monitor',
  routerIp: env.ROUTER_IP || '192.168.1.1',
  internetTargets: (env.INTERNET_TARGETS || '1.1.1.1:443,8.8.8.8:443')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
  // "192.168.1.34=Kamera Dek,192.168.1.43" (nama opsional; dashboard memakai nama kamera bila cocok)
  cameras: (env.CAMERAS || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [ip, ...name] = c.split('=');
      return { ip: ip.trim(), name: name.join('=').trim() || `Kamera ${ip.trim()}` };
    }),
  failuresBeforeOffline: 2,
  maxEventsPerReport: 1000,
};

const STATE_FILE = join(CONFIG.stateDir, 'state.json');
const log = (...m) => console.log(new Date().toISOString(), ...m);

// ---------- state (bertahan antar restart & reboot) ----------
function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveState(state) {
  mkdirSync(CONFIG.stateDir, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, STATE_FILE);
}

// ---------- info boot ----------
const readBootId = () =>
  readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim().replace(/-/g, '');
function readBootedAt() {
  const btime = readFileSync('/proc/stat', 'utf8').match(/^btime (\d+)/m);
  return new Date(Number(btime[1]) * 1000);
}

async function listBoots() {
  const { stdout } = await run('journalctl', ['--list-boots', '-o', 'json', '--no-pager'], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout).map((b) => ({
    bootId: b.boot_id,
    firstAt: new Date(Math.floor(b.first_entry / 1000)),
    lastAt: new Date(Math.floor(b.last_entry / 1000)),
  }));
}

// Penyebab boot berakhir, dari baris terakhir journal boot itu.
async function bootEndReason(bootId) {
  try {
    const { stdout } = await run('journalctl', ['-b', bootId, '-n', '400', '--no-pager', '-o', 'cat'], {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (/plymouth-reboot\.service|System is rebooting|Reached target .*Reboot/.test(stdout)) return 'REBOOT';
    if (/plymouth-(poweroff|halt)\.service|System is powering down|Reached target .*(Power Off|Halt)/.test(stdout)) {
      return 'SHUTDOWN';
    }
    if (/Stopped target local-fs\.target/.test(stdout)) return 'SHUTDOWN';
  } catch {
    // journal boot itu sudah terhapus/rusak: anggap mati mendadak
  }
  return 'POWER_LOSS';
}

async function previousBootInfo(state, bootId) {
  const boots = await listBoots().catch(() => []);
  const idx = boots.findIndex((b) => b.bootId === bootId);
  const prev = idx > 0 ? boots[idx - 1] : boots.at(-2);
  if (!prev || prev.bootId === bootId) return null;

  let lastSeenAt = prev.lastAt;
  // Journal di-flush berkala; jam hidup terakhir dari agent sendiri bisa lebih akurat.
  if (state.bootId === prev.bootId && state.lastAliveAt) {
    const own = new Date(state.lastAliveAt);
    if (own > lastSeenAt) lastSeenAt = own;
  }
  const endReason =
    state.shutdownFor === prev.bootId ? state.shutdownReason : await bootEndReason(prev.bootId);
  return { lastSeenAt: lastSeenAt.toISOString(), endReason };
}

async function bootHistory(bootId) {
  const boots = await listBoots();
  const out = [];
  for (const b of boots) {
    if (b.bootId === bootId || b.lastAt <= b.firstAt) continue;
    out.push({
      bootId: b.bootId,
      bootedAt: b.firstAt.toISOString(),
      lastSeenAt: b.lastAt.toISOString(),
      endReason: await bootEndReason(b.bootId),
    });
  }
  return out;
}

// ---------- pengecekan ----------
const tcpCheck = (host, port, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const socket = new Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });

async function routerReachable() {
  if (await tcpCheck(CONFIG.routerIp, 80)) return true;
  try {
    await run('ping', ['-c', '1', '-W', '2', CONFIG.routerIp]);
    return true;
  } catch {
    return false;
  }
}

async function internetReachable() {
  const results = await Promise.all(
    CONFIG.internetTargets.map((t) => {
      const [host, port] = t.split(':');
      return tcpCheck(host, Number(port) || 443, 3000);
    })
  );
  return results.some(Boolean);
}

/**
 * Catat perubahan status. Gagal harus terjadi FAILURES_BEFORE_OFFLINE kali berturut-turut
 * (gangguan sesaat Starlink diabaikan); waktu event = saat gagal pertama.
 */
function observe(state, key, ok, failStatus, failReason, now) {
  state.statuses ??= {};
  state.failures ??= {};
  const current = state.statuses[key];

  if (ok) {
    delete state.failures[key];
    if (current !== 'ONLINE') {
      state.statuses[key] = 'ONLINE';
      queueEvent(state, key, 'ONLINE', current === undefined ? null : 'RECOVERED', now);
    }
    return;
  }

  const f = state.failures[key] ?? { count: 0, since: now.toISOString() };
  f.count += 1;
  state.failures[key] = f;
  if (f.count >= CONFIG.failuresBeforeOffline && current !== failStatus) {
    state.statuses[key] = failStatus;
    queueEvent(state, key, failStatus, failReason, new Date(f.since));
  }
}

function queueEvent(state, key, status, reason, at) {
  state.queue ??= [];
  state.queue.push({ key, status, reason, at: at.toISOString() });
  // Batas aman antrean (mis. internet putus berhari-hari): buang yang paling lama.
  if (state.queue.length > 20000) state.queue.splice(0, state.queue.length - 20000);
  log(`status ${key} -> ${status}${reason ? ` (${reason})` : ''}`);
}

function devices() {
  return [
    { key: 'pc', kind: 'PC', name: 'PC lokal' },
    { key: 'internet', kind: 'INTERNET', name: 'Internet Starlink' },
    ...CONFIG.cameras.map((c) => ({ key: c.ip, kind: 'CAMERA', name: c.name })),
  ];
}

async function checkAll(state) {
  const now = new Date();
  const [router, internet, cams] = await Promise.all([
    routerReachable(),
    internetReachable(),
    Promise.all(CONFIG.cameras.map((c) => tcpCheck(c.ip, 80))),
  ]);

  observe(state, 'internet', internet, 'OFFLINE', router ? 'NO_INTERNET' : 'ROUTER_DOWN', now);
  CONFIG.cameras.forEach((c, i) => {
    // Router/LAN putus: kamera tidak bisa dinilai, jangan dicatat mati.
    observe(state, c.ip, cams[i], router ? 'OFFLINE' : 'UNKNOWN', router ? 'UNREACHABLE' : 'LAN_DOWN', now);
  });
  state.lastAliveAt = now.toISOString();
}

// ---------- kirim ----------
async function send(state, boot, extra = {}, timeoutMs = 15000) {
  const events = (state.queue ?? []).slice(0, CONFIG.maxEventsPerReport);
  const body = {
    bootId: boot.id,
    bootedAt: boot.bootedAt.toISOString(),
    previousBoot: state.previousBootSentFor === boot.id ? null : boot.previous,
    devices: devices(),
    events,
    ...extra,
  };

  if (DRY_RUN) {
    log('DRY RUN laporan:', JSON.stringify({ ...body, bootHistory: body.bootHistory?.length }, null, 2));
    return { ok: true, sent: events.length };
  }

  const res = await fetch(CONFIG.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const result = await res.json();
  state.queue.splice(0, events.length);
  state.previousBootSentFor = boot.id;
  return { ok: true, sent: events.length, result };
}

// ---------- shutdown ----------
async function systemShutdownReason() {
  try {
    const { stdout } = await run('systemctl', ['is-system-running']).catch((e) => e);
    if (!String(stdout).includes('stopping')) return null;
    const jobs = await run('systemctl', ['list-jobs', '--no-legend']).catch((e) => e);
    return /reboot\.target/.test(String(jobs.stdout)) ? 'REBOOT' : 'SHUTDOWN';
  } catch {
    return null;
  }
}

// ---------- main ----------
async function main() {
  if (!CONFIG.token && !DRY_RUN) throw new Error('MONITOR_TOKEN belum diisi');
  if (CONFIG.cameras.length === 0) log('PERINGATAN: CAMERAS kosong, hanya PC & internet dipantau');

  const state = loadState();
  const boot = { id: readBootId(), bootedAt: readBootedAt(), previous: null };

  if (state.bootId !== boot.id) {
    if (state.bootId) boot.previous = await previousBootInfo(state, boot.id);
    // Boot baru: status kamera/internet dinilai ulang dari nol (dashboard sudah
    // menandainya "tidak terpantau" saat PC mati). Antrean lama tetap dikirim.
    state.statuses = {};
    state.failures = {};
    state.bootId = boot.id;
    state.previousBootSentFor = null;
  } else if (state.previousBoot) {
    boot.previous = state.previousBoot;
  }
  state.previousBoot = boot.previous;
  saveState(state);
  log(`agent mulai: boot ${boot.id.slice(0, 8)} sejak ${boot.bootedAt.toISOString()}, ${CONFIG.cameras.length} kamera`);

  let stopping = false;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await checkAll(state);
      const extra = {};
      if (!state.historySent) extra.bootHistory = await bootHistory(boot.id).catch(() => []);
      const r = await send(state, boot, extra);
      if (extra.bootHistory) {
        state.historySent = true;
        log(`riwayat boot terkirim: ${extra.bootHistory.length} boot, diimpor ${r.result?.imported ?? '-'}`);
      }
      if (r.sent) log(`terkirim ${r.sent} event`);
    } catch (error) {
      log(`gagal kirim (${(state.queue ?? []).length} event antre): ${error.message}`);
    } finally {
      saveState(state);
      busy = false;
    }
  };

  const onStop = async (signal) => {
    if (stopping) return;
    stopping = true;
    const reason = await systemShutdownReason();
    if (reason) {
      queueEvent(state, 'pc', 'OFFLINE', reason, new Date());
      state.shutdownFor = boot.id;
      state.shutdownReason = reason;
      saveState(state);
      try {
        await send(state, boot, {}, 4000);
      } catch (error) {
        log(`event ${reason} disimpan untuk dikirim setelah menyala: ${error.message}`);
      }
      saveState(state);
    }
    log(`berhenti (${signal}${reason ? `, sistem ${reason}` : ''})`);
    process.exit(0);
  };
  process.on('SIGTERM', () => onStop('SIGTERM'));
  process.on('SIGINT', () => onStop('SIGINT'));

  await tick();
  if (ONCE) return;
  setInterval(() => {
    if (!stopping) tick();
  }, CONFIG.intervalMs);
}

main().catch((error) => {
  log('fatal:', error.message);
  process.exit(1);
});

import { Socket } from 'net';
import { isPrivateIPv4 } from '@/lib/isapi';

// Status kamera ditentukan dari koneksi TCP ke port HTTP kamera (lewat Tailscale),
// bukan dari nilai yang diisi manual. Hasil disimpan di memori proses: dashboard
// berjalan sebagai satu proses Node, dan banyak penonton cukup memicu satu cek.
const PROBE_PORT = 80;
const PROBE_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 15_000;
// Satu kegagalan bisa hanya gangguan sesaat di Starlink; video jangan langsung ditutup.
const FAILURES_BEFORE_OFFLINE = 2;

type HostState = { reachable: boolean; failures: number; checkedAt: number };

const hostStates = new Map<string, HostState>();
const pendingProbes = new Map<string, Promise<boolean>>();

const probe = (host: string) =>
  new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(PROBE_PORT, host);
  });

const isReachable = (host: string) => {
  const state = hostStates.get(host);
  if (state && Date.now() - state.checkedAt < CACHE_TTL_MS) {
    return Promise.resolve(state.reachable);
  }

  const pending = pendingProbes.get(host);
  if (pending) return pending;

  const check = probe(host)
    .then((ok) => {
      const failures = ok ? 0 : (hostStates.get(host)?.failures ?? 0) + 1;
      // Cek pertama yang gagal langsung offline: belum ada video yang perlu dijaga.
      const reachable =
        ok ||
        (hostStates.has(host) && failures < FAILURES_BEFORE_OFFLINE
          ? hostStates.get(host)!.reachable
          : false);
      hostStates.set(host, { reachable, failures, checkedAt: Date.now() });
      return reachable;
    })
    .finally(() => pendingProbes.delete(host));
  pendingProbes.set(host, check);
  return check;
};

type StatusInput = { status: string | null; isapiHost: string | null };

/**
 * MAINTENANCE tetap diatur manual. Kamera tanpa isapiHost privat tidak bisa dicek,
 * jadi memakai nilai tersimpan.
 */
export async function resolveCameraStatus(camera: StatusInput) {
  const stored = (camera.status || 'OFFLINE') as
    | 'ONLINE'
    | 'OFFLINE'
    | 'MAINTENANCE';

  if (
    stored === 'MAINTENANCE' ||
    !camera.isapiHost ||
    !isPrivateIPv4(camera.isapiHost)
  ) {
    return stored;
  }

  return (await isReachable(camera.isapiHost)) ? 'ONLINE' : 'OFFLINE';
}

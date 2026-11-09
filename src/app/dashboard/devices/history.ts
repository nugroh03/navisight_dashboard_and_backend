// Tipe, format waktu, dan pengelompokan kejadian untuk halaman Riwayat Perangkat.

export type Status = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export type Period = {
  status: Status;
  reason: string | null;
  startedAt: string;
  endedAt: string | null;
  provisional: boolean;
};

export type DeviceKind = 'PC' | 'CAMERA' | 'INTERNET' | 'RECORDING';

export type Device = {
  id: string;
  kind: DeviceKind;
  key: string;
  name: string;
  location: string | null;
  currentStatus: Status;
  statusSince: string | null;
  lastCheckedAt: string | null;
  stats: {
    onlineMs: number;
    offlineMs: number;
    unknownMs: number;
    uptimePct: number | null;
    outages: number;
  };
  periods: Period[];
};

export type Agent = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  lostAt: string | null;
  online: boolean;
};

export type DevicesData = {
  from: string;
  to: string;
  now: string;
  truncated: boolean;
  agents: Agent[];
  devices: Device[];
};

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
const WIB_OFFSET_MS = 7 * HOUR_MS;
const TZ = 'Asia/Jakarta';

export const STATUS_LABEL: Record<Status, string> = {
  ONLINE: 'Hidup',
  OFFLINE: 'Mati',
  UNKNOWN: 'Tidak terpantau',
};
const RECORDING_LABEL: Record<Status, string> = {
  ONLINE: 'Merekam',
  OFFLINE: 'Tidak merekam',
  UNKNOWN: 'Tidak terpantau',
};
export const statusLabel = (kind: DeviceKind, status: Status) =>
  kind === 'RECORDING' ? RECORDING_LABEL[status] : STATUS_LABEL[status];

export const REASON_LABEL: Record<string, string> = {
  BOOT: 'PC menyala',
  POWER_LOSS: 'Mati mendadak (listrik padam/hang)',
  REBOOT: 'Restart',
  SHUTDOWN: 'Dimatikan dengan normal',
  NO_HEARTBEAT: 'PC tidak melapor',
  PC_OFF: 'PC mati, tidak bisa dicek',
  NO_INTERNET: 'Internet putus',
  ROUTER_DOWN: 'Router tidak terjangkau',
  UNREACHABLE: 'Tidak terjangkau di jaringan',
  LAN_DOWN: 'Jaringan lokal putus',
  RECOVERED: 'Pulih',
  NOT_RECORDING: 'Kamera hidup tapi tidak merekam',
  CAMERA_OFF: 'Kamera mati, rekaman tidak dinilai',
};

export const reasonText = (p: Period) =>
  p.provisional
    ? 'Menunggu laporan PC'
    : (p.reason && REASON_LABEL[p.reason]) || STATUS_LABEL[p.status];

/** Kunci hari (YYYY-MM-DD) dalam WIB. */
export const dayKey = (ms: number) => new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
/** Awal hari WIB (epoch ms) dari sebuah waktu. */
export const startOfDayWib = (ms: number) =>
  Math.floor((ms + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;

const fmt = (ms: number | string | Date, options: Intl.DateTimeFormatOptions) =>
  new Date(ms).toLocaleString('id-ID', { timeZone: TZ, ...options }).replace(/\./g, ':');

/** "16:09" */
export const formatClock = (value: number | string) =>
  fmt(value, { hour: '2-digit', minute: '2-digit', hour12: false });
/** "16:09:12" */
export const formatClockSec = (value: number | string) =>
  fmt(value, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
/** "9 Nov" */
export const formatShortDate = (value: number | string) =>
  new Date(value).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short' });
/** "9 Nov 16:09" (untuk rentang tanggal) */
export const formatDateTime = (value: number | string) =>
  `${formatShortDate(value)} ${formatClock(value)}`;

/** Jam saja bila hari ini, "kemarin 16:09", atau "8 Nov 16:09". */
export function formatWhen(value: number | string, nowMs: number) {
  const ms = new Date(value).getTime();
  const diffDays = Math.round((startOfDayWib(nowMs) - startOfDayWib(ms)) / DAY_MS);
  if (diffDays === 0) return formatClock(ms);
  if (diffDays === 1) return `kemarin ${formatClock(ms)}`;
  return formatDateTime(ms);
}

/** "Hari ini · Senin, 9 November" */
export function formatDayHeading(key: string, nowMs: number) {
  const ms = new Date(`${key}T12:00:00+07:00`).getTime();
  const label = new Date(ms).toLocaleDateString('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (key === dayKey(nowMs)) return `Hari ini · ${label}`;
  if (key === dayKey(nowMs - DAY_MS)) return `Kemarin · ${label}`;
  return label;
}

export const formatDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} detik`;
  if (totalSec < 600) {
    const sec = totalSec % 60;
    return sec ? `${Math.floor(totalSec / 60)} menit ${sec} detik` : `${totalSec / 60} menit`;
  }
  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} jam ${minutes % 60} menit` : `${hours} jam`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} hari ${hours % 24} jam` : `${days} hari`;
};

// ---------------------------------------------------------------------------
// Kejadian: gangguan (status Mati) beberapa perangkat yang mulai hampir
// bersamaan digabung jadi satu kejadian, mis. listrik padam mematikan PC dan
// beberapa kamera sekaligus.

export type Outage = {
  device: Device;
  period: Period;
  start: number;
  end: number | null; // null = masih berlangsung
};

export type Incident = {
  id: string;
  start: number;
  end: number | null; // null bila masih ada perangkat yang belum pulih
  title: string;
  outages: Outage[];
};

/** Gangguan yang mulai dalam jarak ini dari awal kejadian dianggap satu kejadian. */
export const GROUP_WINDOW_MS = 3 * MINUTE_MS;

const KIND_RANK: Record<DeviceKind, number> = { PC: 0, INTERNET: 1, CAMERA: 2, RECORDING: 3 };

function incidentTitle(outages: Outage[]) {
  const pc = outages.find((o) => o.device.kind === 'PC');
  if (pc) {
    switch (pc.period.reason) {
      case 'POWER_LOSS':
        return 'Listrik padam / PC mati mendadak';
      case 'SHUTDOWN':
        return 'PC dimatikan';
      case 'REBOOT':
        return 'PC restart';
      default:
        return 'PC tidak melapor';
    }
  }
  const cameras = outages.filter((o) => o.device.kind === 'CAMERA');
  const recordings = outages.filter((o) => o.device.kind === 'RECORDING');
  const internet = outages.find((o) => o.device.kind === 'INTERNET');
  if (internet && outages.length === 1) return 'Internet (Starlink) putus';
  if (cameras.length > 1) return `${cameras.length} kamera mati bersamaan`;
  if (cameras.length === 1 && outages.length === 1) return `${cameras[0].device.name} mati`;
  if (recordings.length === outages.length) {
    return recordings.length === 1
      ? `${recordings[0].device.name.replace(/^Rekaman /, '')} tidak merekam`
      : `${recordings.length} kamera tidak merekam`;
  }
  return `${outages.length} perangkat bermasalah`;
}

/**
 * Bangun daftar kejadian (terbaru dulu).
 * @param minMs gangguan selesai yang lebih singkat dari ini disembunyikan;
 *              gangguan yang masih berlangsung selalu ditampilkan.
 */
export function buildIncidents(
  devices: Device[],
  { minMs = 0, deviceId }: { minMs?: number; deviceId?: string } = {}
): Incident[] {
  const outages: Outage[] = [];
  for (const device of devices) {
    if (deviceId && device.id !== deviceId) continue;
    for (const period of device.periods) {
      if (period.status !== 'OFFLINE') continue;
      const start = new Date(period.startedAt).getTime();
      const end = period.endedAt ? new Date(period.endedAt).getTime() : null;
      // Kejadian PC (listrik padam, restart, dimatikan) selalu ditampilkan walau singkat.
      const important = device.kind === 'PC';
      if (end !== null && end - start < minMs && !important) continue;
      outages.push({ device, period, start, end });
    }
  }
  outages.sort((a, b) => a.start - b.start);

  const groups: Outage[][] = [];
  for (const o of outages) {
    const last = groups[groups.length - 1];
    if (last && o.start - last[0].start <= GROUP_WINDOW_MS) last.push(o);
    else groups.push([o]);
  }

  return groups
    .map((group) => {
      group.sort(
        (a, b) => KIND_RANK[a.device.kind] - KIND_RANK[b.device.kind] || a.start - b.start
      );
      const ongoing = group.some((o) => o.end === null);
      return {
        id: `${group[0].device.id}-${group[0].start}`,
        start: Math.min(...group.map((o) => o.start)),
        end: ongoing ? null : Math.max(...group.map((o) => o.end as number)),
        title: incidentTitle(group),
        outages: group,
      };
    })
    .reverse();
}

/** Beri rekaman nama kameranya ("Rekaman Ruang A") bila kameranya dikenal. */
export function withRecordingNames(devices: Device[]): Device[] {
  const cameraName = new Map(
    devices.filter((d) => d.kind === 'CAMERA').map((d) => [d.key, d.name] as const)
  );
  return devices.map((d) => {
    if (d.kind !== 'RECORDING') return d;
    const name = cameraName.get(d.key.replace(/^rec:/, ''));
    return name ? { ...d, name: `Rekaman ${name}` } : d;
  });
}

/** Kelompokkan kejadian per hari WIB (berdasarkan waktu mulai). */
export function groupByDay(incidents: Incident[]) {
  const days: { key: string; incidents: Incident[] }[] = [];
  for (const incident of incidents) {
    const key = dayKey(incident.start);
    const last = days[days.length - 1];
    if (last?.key === key) last.incidents.push(incident);
    else days.push({ key, incidents: [incident] });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Penanda waktu untuk linimasa.

export function timelineTicks(from: number, to: number) {
  const span = to - from;
  const step =
    span <= 1.5 * DAY_MS
      ? 3 * HOUR_MS
      : span <= 3 * DAY_MS
        ? 6 * HOUR_MS
        : span <= 10 * DAY_MS
          ? DAY_MS
          : span <= 40 * DAY_MS
            ? 5 * DAY_MS
            : 10 * DAY_MS;
  const ticks: { at: number; label: string; major: boolean }[] = [];
  let t = startOfDayWib(from);
  while (t < from) t += step;
  for (; t <= to; t += step) {
    const midnight = startOfDayWib(t) === t;
    ticks.push({
      at: t,
      label: step < DAY_MS ? (midnight ? formatShortDate(t) : formatClock(t)) : formatShortDate(t),
      major: midnight,
    });
  }
  return ticks;
}

/**
 * Periode yang paling cocok dengan titik ketuk pada linimasa: periode yang
 * memuat titik itu, tapi bila itu "Hidup", utamakan gangguan terdekat dalam
 * jarak toleransi (bar gangguan singkat sangat tipis, sulit diketuk di HP).
 */
export function pickPeriod(device: Device, at: number, toleranceMs: number, nowMs: number) {
  let containing: number | null = null;
  let nearest: { index: number; distance: number } | null = null;
  device.periods.forEach((p, index) => {
    const start = new Date(p.startedAt).getTime();
    const end = p.endedAt ? new Date(p.endedAt).getTime() : nowMs;
    if (at >= start && at <= end) containing = index;
    if (p.status === 'ONLINE') return;
    const distance = at < start ? start - at : at > end ? at - end : 0;
    if (distance <= toleranceMs && (!nearest || distance < nearest.distance)) {
      nearest = { index, distance };
    }
  });
  const near = nearest as { index: number; distance: number } | null;
  if (containing !== null && device.periods[containing].status !== 'ONLINE') return containing;
  return near?.index ?? containing;
}

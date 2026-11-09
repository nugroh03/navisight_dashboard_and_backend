// Tes integrasi riwayat perangkat (src/lib/device-monitoring.ts).
// HANYA untuk database Postgres sementara: data di tabel monitoring dihapus.
//
//   DATABASE_URL=postgresql://postgres:pg@127.0.0.1:54329/test npx prisma migrate deploy
//   DATABASE_URL=postgresql://postgres:pg@127.0.0.1:54329/test npx tsx scripts/test-device-monitoring.ts
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import {
  hashAgentToken,
  ingestReport,
  markLostAgents,
  startMonitoringChecker,
  type MonitoringReport,
} from '@/lib/device-monitoring';

const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost):54329\//.test(url)) {
  throw new Error('Tes hanya boleh ke database sementara di port 54329, bukan produksi');
}

const D = (hm: string) => new Date(`2026-11-09T${hm}:00+07:00`);
const devices: MonitoringReport['devices'] = [
  { key: 'pc', kind: 'PC', name: 'PC lokal' },
  { key: 'internet', kind: 'INTERNET', name: 'Starlink' },
  { key: '192.168.1.141', kind: 'CAMERA', name: 'Kamera .141' },
  { key: '192.168.1.34', kind: 'CAMERA', name: 'Kamera .34' },
];
const report = (
  bootId: string,
  bootedAt: string,
  events: MonitoringReport['events'],
  previousBoot?: MonitoringReport['previousBoot']
): MonitoringReport => ({ bootId, bootedAt: D(bootedAt), devices, events, previousBoot });
const ev = (
  key: string,
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN',
  hm: string,
  reason?: string
) => ({ key, status, at: D(hm), reason });

const fmt = (d: Date | null) =>
  d
    ? d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 5)
    : '…';

async function history(key: string) {
  const logs = await prisma.deviceStatusLog.findMany({
    where: { device: { key } },
    orderBy: { startedAt: 'asc' },
  });
  return logs.map(
    (l) =>
      `${l.status}${l.reason ? '/' + l.reason : ''} ${fmt(l.startedAt)}-${fmt(l.endedAt)}${l.provisional ? ' (prov)' : ''}`
  );
}

async function checkIntegrity(label: string) {
  for (const d of await prisma.monitoredDevice.findMany()) {
    const logs = await prisma.deviceStatusLog.findMany({
      where: { deviceId: d.id },
      orderBy: { startedAt: 'asc' },
    });
    const open = logs.filter((l) => !l.endedAt);
    assert.equal(open.length, 1, `${label}: ${d.key} harus punya tepat 1 periode terbuka`);
    assert.equal(open[0].id, logs.at(-1)!.id, `${label}: ${d.key} periode terbuka harus yang terakhir`);
    for (let i = 1; i < logs.length; i++) {
      assert.equal(
        logs[i - 1].endedAt!.getTime(),
        logs[i].startedAt.getTime(),
        `${label}: ${d.key} periode harus bersambung`
      );
      assert.notEqual(logs[i - 1].status, logs[i].status, `${label}: ${d.key} status berurutan tidak boleh sama`);
    }
    assert.equal(d.currentStatus, open[0].status, `${label}: ${d.key} currentStatus cocok`);
  }
}

async function main() {
  await prisma.deviceStatusLog.deleteMany();
  await prisma.monitoredDevice.deleteMany();
  await prisma.monitorAgent.deleteMany();
  await prisma.camera.deleteMany({ where: { isapiHost: '192.168.1.141' } });
  const project = await prisma.project.create({ data: { name: 'Tes monitoring' } });
  const camera = await prisma.camera.create({
    data: { projectId: project.id, urlCamera: 'x', name: 'Kamera Dermaga', isapiHost: '192.168.1.141' },
  });
  const agent = await prisma.monitorAgent.create({
    data: { name: 'PC tes', tokenHash: hashAgentToken('t'.repeat(43)) },
  });

  // 1) Laporan pertama
  await ingestReport(agent.id, report('B1', '07:58', [
    ev('internet', 'ONLINE', '07:59'),
    ev('192.168.1.141', 'ONLINE', '07:59'),
    ev('192.168.1.34', 'OFFLINE', '07:59', 'UNREACHABLE'),
  ]), D('08:00'));
  await ingestReport(agent.id, report('B1', '07:58', [ev('192.168.1.34', 'ONLINE', '08:04', 'RECOVERED')]), D('08:05'));
  await ingestReport(agent.id, report('B1', '07:58', []), D('08:10'));
  await checkIntegrity('awal');
  const linked = await prisma.monitoredDevice.findFirst({ where: { key: '192.168.1.141' } });
  assert.equal(linked!.cameraId, camera.id, 'kamera .141 tertaut ke tabel cameras');

  // 2) Internet putus 08:10:30-08:19: VPS kehilangan heartbeat, lalu agent kembali (boot sama)
  assert.equal(await markLostAgents(D('08:12')), 0, 'belum 3 menit: belum hilang');
  assert.equal(await markLostAgents(D('08:14')), 1, 'lewat 3 menit: hilang');
  assert.deepEqual(await history('pc'), ['ONLINE/BOOT 07:58-08:10', 'UNKNOWN/NO_HEARTBEAT 08:10-… (prov)']);
  await checkIntegrity('saat hilang');
  await ingestReport(agent.id, report('B1', '07:58', [
    { key: 'internet', status: 'OFFLINE', at: new Date(D('08:10').getTime() + 30_000), reason: 'NO_INTERNET' },
    ev('internet', 'ONLINE', '08:19'),
  ]), D('08:20'));
  assert.deepEqual(await history('pc'), ['ONLINE/BOOT 07:58-…'], 'PC tetap hidup selama internet putus');
  assert.deepEqual(await history('internet'), ['ONLINE 07:59-08:10', 'OFFLINE/NO_INTERNET 08:10-08:19', 'ONLINE 08:19-…']);
  assert.deepEqual(await history('192.168.1.141'), ['ONLINE 07:59-…'], 'kamera tidak dicatat mati karena internet');
  await checkIntegrity('setelah internet kembali');

  // 3) Listrik mati: laporan terakhir 09:00, PC menyala lagi 09:28 (boot baru)
  await ingestReport(agent.id, report('B1', '07:58', []), D('09:00'));
  await markLostAgents(D('09:05'));
  await ingestReport(agent.id, report('B2', '09:28', [
    ev('internet', 'ONLINE', '09:29'),
    ev('192.168.1.141', 'ONLINE', '09:29'),
    ev('192.168.1.34', 'ONLINE', '09:29'),
  ], { lastSeenAt: D('09:01'), endReason: 'POWER_LOSS' }), D('09:30'));
  assert.deepEqual((await history('pc')).slice(-3), ['ONLINE/BOOT 07:58-09:01', 'OFFLINE/POWER_LOSS 09:01-09:28', 'ONLINE/BOOT 09:28-…']);
  assert.deepEqual(await history('192.168.1.141'), ['ONLINE 07:59-09:01', 'UNKNOWN/PC_OFF 09:01-09:29', 'ONLINE 09:29-…']);
  assert.equal(await prisma.deviceStatusLog.count({ where: { provisional: true } }), 0, 'tidak ada sisa provisional');
  await checkIntegrity('setelah listrik mati');

  // 4) Shutdown normal 17:00, event shutdown tertunda dan baru terkirim setelah boot 18:00
  await ingestReport(agent.id, report('B2', '09:28', []), D('10:00'));
  await markLostAgents(D('10:04'));
  await ingestReport(agent.id, report('B3', '18:00', [
    ev('pc', 'OFFLINE', '17:00', 'SHUTDOWN'),
    ev('192.168.1.141', 'ONLINE', '18:01'),
  ], { lastSeenAt: D('17:00'), endReason: 'SHUTDOWN' }), D('18:02'));
  assert.deepEqual((await history('pc')).slice(-3), ['ONLINE/BOOT 09:28-17:00', 'OFFLINE/SHUTDOWN 17:00-18:00', 'ONLINE/BOOT 18:00-…']);
  assert.deepEqual(
    (await history('192.168.1.34')).slice(-2),
    ['ONLINE 09:29-17:00', 'UNKNOWN/PC_OFF 17:00-…'],
    'kamera .34 belum dicek setelah boot: tetap tidak terpantau'
  );
  await checkIntegrity('setelah shutdown normal');

  // 5) Reboot cepat (< 3 menit) tanpa sempat ditandai hilang
  await ingestReport(agent.id, report('B4', '18:30', [], { lastSeenAt: D('18:29'), endReason: 'POWER_LOSS' }), D('18:31'));
  assert.deepEqual((await history('pc')).slice(-2), ['OFFLINE/POWER_LOSS 18:29-18:30', 'ONLINE/BOOT 18:30-…']);
  await checkIntegrity('reboot cepat');

  // 6) Event lama yang terkirim ulang tidak menimpa status lebih baru
  const before = await prisma.deviceStatusLog.count();
  await ingestReport(agent.id, report('B4', '18:30', [ev('192.168.1.141', 'ONLINE', '18:01')]), D('18:32'));
  assert.equal(await prisma.deviceStatusLog.count(), before, 'event basi diabaikan');
  assert.equal((await history('192.168.1.141')).at(-1), 'UNKNOWN/PC_OFF 18:29-…');

  // 7) Event sama dikirim dua kali (retry) tidak membuat duplikat
  const retry = [ev('192.168.1.141', 'ONLINE', '18:31')];
  await ingestReport(agent.id, report('B4', '18:30', retry), D('18:33'));
  const afterFirst = await prisma.deviceStatusLog.count();
  await ingestReport(agent.id, report('B4', '18:30', retry), D('18:34'));
  assert.equal(await prisma.deviceStatusLog.count(), afterFirst, 'retry tidak menambah periode');
  await checkIntegrity('event ulang');

  // 8) Impor riwayat boot dari journal (sebelum laporan pertama 07:58)
  const bootHistory = [
    { bootId: 'H1', bootedAt: D('05:00'), lastSeenAt: D('06:00'), endReason: 'REBOOT' as const },
    { bootId: 'H2', bootedAt: D('06:01'), lastSeenAt: D('07:30'), endReason: 'POWER_LOSS' as const },
    // boot sekarang dan boot yang sudah tercatat: diabaikan
    { bootId: 'B4', bootedAt: D('18:30'), lastSeenAt: D('18:35'), endReason: 'POWER_LOSS' as const },
    { bootId: 'B2', bootedAt: D('09:28'), lastSeenAt: D('17:00'), endReason: 'SHUTDOWN' as const },
  ];
  const r1 = await ingestReport(agent.id, { ...report('B4', '18:30', []), bootHistory }, D('18:40'));
  assert.equal(r1.imported, 2, 'hanya 2 boot lama yang diimpor');
  assert.deepEqual((await history('pc')).slice(0, 5), [
    'ONLINE/BOOT 05:00-06:00',
    'OFFLINE/REBOOT 06:00-06:01',
    'ONLINE/BOOT 06:01-07:30',
    'OFFLINE/POWER_LOSS 07:30-07:58',
    'ONLINE/BOOT 07:58-09:01',
  ]);
  const r2 = await ingestReport(agent.id, { ...report('B4', '18:30', []), bootHistory }, D('18:41'));
  assert.equal(r2.imported, 0, 'impor ulang tidak menambah apa pun');
  await checkIntegrity('impor riwayat');

  // 9) Pengecek berkala (startMonitoringChecker) menandai agent yang diam > timeoutSec
  await prisma.monitorAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: new Date(Date.now() - 200_000), lostAt: null },
  });
  startMonitoringChecker(100);
  startMonitoringChecker(100); // panggilan kedua diabaikan (tidak membuat timer ganda)
  for (let i = 0; i < 50; i++) {
    if ((await prisma.monitorAgent.findUniqueOrThrow({ where: { id: agent.id } })).lostAt) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(
    (await prisma.monitorAgent.findUniqueOrThrow({ where: { id: agent.id } })).lostAt,
    'pengecek berkala menandai agent hilang'
  );
  assert.equal((await history('pc')).at(-1)?.endsWith('(prov)'), true, 'PC jadi UNKNOWN sementara');
  clearInterval((globalThis as { __deviceMonitorTimer?: NodeJS.Timeout }).__deviceMonitorTimer);
  await checkIntegrity('pengecek berkala');

  for (const k of ['pc', 'internet', '192.168.1.141', '192.168.1.34']) {
    console.log(k.padEnd(14), (await history(k)).join(' | '));
  }
  console.log('\nSEMUA TES LULUS');
}

main().finally(() => prisma.$disconnect());

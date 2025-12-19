import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';

export default async function CctvPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? 'Pengguna';
  const role = session?.user?.role ?? 'Tamu';

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          CCTV
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Monitoring CCTV
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Halaman dasar untuk menyiapkan daftar stream, status perangkat, dan
          log inspeksi. Lengkapi dengan integrasi RTSP/HLS, health check kamera,
          serta jadwal pemeliharaan.
        </p>

        <div className='mt-6 grid gap-4 md:grid-cols-2'>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Daftar Feed
            </p>
            <p className='text-[var(--color-muted)]'>
              Placeholder untuk grid thumbnail dan status koneksi.
            </p>
          </div>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Alert & Health
            </p>
            <p className='text-[var(--color-muted)]'>
              Tempatkan alarm offline, latency, atau deteksi anomali.
            </p>
          </div>
        </div>

        <p className='mt-6 text-xs text-[var(--color-muted)]'>
          Sesi: {email} (Role: {role})
        </p>
      </div>
    </div>
  );
}

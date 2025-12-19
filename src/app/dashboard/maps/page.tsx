import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';

export default async function MapsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? 'Pengguna';
  const role = session?.user?.role ?? 'Tamu';

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Tracking and Maps
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Tracking and Maps
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Siapkan integrasi peta untuk lokasi perangkat, proyek, atau rute
          inspeksi. Pasangkan dengan filter layer dan detail marker untuk
          kebutuhan tim lapangan.
        </p>

        <div className='mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'>
          <p className='text-sm font-semibold text-amber-800'>
            Fitur tracking & maps belum tersedia
          </p>
          <p className='mt-1 text-sm text-amber-700'>
            Modul ini masih dalam pengembangan. Nantinya akan menampilkan peta
            real-time, dan detail marker.
          </p>
        </div>

        {/* <div className='mt-6 grid gap-4 md:grid-cols-2'>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Layer & Filter
            </p>
            <p className='text-[var(--color-muted)]'>
              Placeholder untuk kontrol layer, kategori, dan pencarian lokasi.
            </p>
          </div>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Detail Marker
            </p>
            <p className='text-[var(--color-muted)]'>
              Area untuk panel detail titik, status perangkat, atau foto
              lapangan.
            </p>
          </div>
        </div>

        <p className='mt-6 text-xs text-[var(--color-muted)]'>
          Sesi: {email} (Role: {role})
        </p> */}
      </div>
    </div>
  );
}

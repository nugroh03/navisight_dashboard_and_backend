import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';

export default async function MessagePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? 'Pengguna';
  const role = session?.user?.role ?? 'Tamu';

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Message
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Pesan & Notifikasi
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Rancang kanal komunikasi untuk broadcast,dan pesan operasional,
          Hubungkan dengan data perangkat atau proyek agar konteks lebih jelas.
        </p>

        <div className='mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'>
          <p className='text-sm font-semibold text-amber-800'>
            Fitur pesan belum tersedia
          </p>
          <p className='mt-1 text-sm text-amber-700'>
            Modul ini sedang dalam pengembangan. Nantinya Anda bisa mengelola
            inbox, template broadcast, dan log notifikasi di sini.
          </p>
        </div>

        {/* <div className='mt-6 grid gap-4 md:grid-cols-3'>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Inbox
            </p>
            <p className='text-[var(--color-muted)]'>
              Belum tersedia. Nantinya berisi daftar pesan terbaru dan filter
              status.
            </p>
          </div>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Template
            </p>
            <p className='text-[var(--color-muted)]'>
              Belum tersedia. Nantinya bisa menyusun template broadcast atau
              notifikasi otomatis.
            </p>
          </div>
          <div className='rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-4'>
            <p className='text-sm font-semibold text-[var(--color-text)]'>
              Log
            </p>
            <p className='text-[var(--color-muted)]'>
              Belum tersedia. Nantinya menampilkan audit trail pengiriman dan
              keterbacaan.
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

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { AlertTriangle, DatabaseBackup, Download, Loader2, Trash2 } from 'lucide-react';

type BackupData = {
  backups: {
    name: string;
    size: number;
    createdAt: string;
    type: 'auto' | 'manual';
  }[];
  listError: string | null;
  schedule: {
    enabled: boolean;
    time: string;
    keep: number;
    lastError: string | null;
  };
  storage: {
    accountId: string;
    bucket: string;
    accessKeyId: string;
    hasSecret: boolean;
  };
  encryptionReady: boolean;
  running: boolean;
  lastFailure: string | null;
};

type StorageForm = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type ScheduleForm = { enabled: boolean; time: string; keep: number };

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const sendJson = async (method: string, body?: unknown, path = '') => {
  const response = await fetch(`/api/backups${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? 'Permintaan gagal');
  }
};

export default function BackupPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  const queryClient = useQueryClient();
  // Null berarti form mengikuti nilai tersimpan; terisi setelah pengguna mengubahnya.
  const [edits, setEdits] = useState<ScheduleForm | null>(null);
  const [storageEdits, setStorageEdits] = useState<StorageForm | null>(null);
  const [storageNotice, setStorageNotice] = useState('');
  const [notice, setNotice] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await fetch('/api/backups');
      if (!response.ok) throw new Error('Gagal memuat data backup');
      return response.json() as Promise<BackupData>;
    },
    enabled: isAdmin,
    refetchInterval: (query) => (query.state.data?.running ? 3_000 : 30_000),
  });

  const form: ScheduleForm = edits ??
    (data && {
      enabled: data.schedule.enabled,
      time: data.schedule.time,
      keep: data.schedule.keep,
    }) ?? { enabled: true, time: '02:00', keep: 14 };
  const setForm = setEdits;

  const storageForm: StorageForm = storageEdits ?? {
    accountId: data?.storage.accountId ?? '',
    bucket: data?.storage.bucket ?? '',
    accessKeyId: data?.storage.accessKeyId ?? '',
    secretAccessKey: '',
  };
  const setStorageField = (field: keyof StorageForm, value: string) =>
    setStorageEdits({ ...storageForm, [field]: value });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['backups'] });
  const onError = (err: Error) => setNotice(err.message);

  const saveSettings = useMutation({
    mutationFn: () => sendJson('PATCH', form),
    onSuccess: () => {
      setNotice('Jadwal tersimpan.');
      setEdits(null);
      void refresh();
    },
    onError,
  });
  const onStorageError = (err: Error) => setStorageNotice(err.message);
  const testStorage = useMutation({
    mutationFn: () =>
      sendJson('POST', storageForm, '/storage/test'),
    onSuccess: () => setStorageNotice('Koneksi berhasil: bucket bisa ditulis dan dibaca.'),
    onError: onStorageError,
  });
  const saveStorage = useMutation({
    mutationFn: () => sendJson('PUT', storageForm, '/storage'),
    onSuccess: () => {
      setStorageNotice('Penyimpanan tersimpan.');
      setStorageEdits(null);
      void refresh();
    },
    onError: onStorageError,
  });
  const startBackup = useMutation({
    mutationFn: () => sendJson('POST'),
    onSuccess: () => {
      setNotice('Backup dimulai.');
      void refresh();
    },
    onError,
  });
  const removeBackup = useMutation({
    mutationFn: (name: string) =>
      sendJson('DELETE', undefined, `/${encodeURIComponent(name)}`),
    onSuccess: () => {
      setNotice('Backup dihapus.');
      void refresh();
    },
    onError,
  });

  if (status === 'loading' || (isAdmin && isLoading)) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-[var(--color-primary)]' />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <p className='text-center py-12 text-red-600'>
        Halaman ini khusus ADMINISTRATOR.
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className='text-center py-12 text-red-600'>
        Gagal memuat data backup.
      </p>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Backup
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Backup Database
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          File berisi seluruh data, termasuk data pengguna. Simpan salinannya
          di tempat yang aman.
        </p>
      </div>

      {!data.encryptionReady && (
        <div className='card p-5 flex gap-3 border-amber-300 bg-amber-50 text-amber-800 text-sm'>
          <AlertTriangle className='h-5 w-5 shrink-0' />
          BACKUP_ENCRYPTION_KEY belum diatur di server, jadi credential R2 belum
          bisa disimpan.
        </div>
      )}
      {!data.storage.hasSecret && data.encryptionReady && (
        <div className='card p-5 flex gap-3 border-amber-300 bg-amber-50 text-amber-800 text-sm'>
          <AlertTriangle className='h-5 w-5 shrink-0' />
          Penyimpanan R2 belum diatur, jadi backup belum berjalan.
        </div>
      )}
      {data.lastFailure && !data.running && (
        <div className='card p-5 flex gap-3 border-red-300 bg-red-50 text-red-800 text-sm'>
          <AlertTriangle className='h-5 w-5 shrink-0' />
          Backup terakhir gagal: {data.lastFailure}
        </div>
      )}
      {data.schedule.lastError && !data.lastFailure && (
        <div className='card p-5 flex gap-3 border-red-300 bg-red-50 text-red-800 text-sm'>
          <AlertTriangle className='h-5 w-5 shrink-0' />
          Backup otomatis terakhir gagal: {data.schedule.lastError}
        </div>
      )}

      <div className='card p-6 space-y-5'>
        <h2 className='font-semibold text-[var(--color-text)]'>
          Penyimpanan Cloudflare R2
        </h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {(
            [
              ['accountId', 'Account ID'],
              ['bucket', 'Nama bucket'],
              ['accessKeyId', 'Access Key ID'],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              className='text-sm text-[var(--color-text)] space-y-1'
            >
              <span className='block'>{label}</span>
              <input
                value={storageForm[field]}
                onChange={(event) =>
                  setStorageField(field, event.target.value.trim())
                }
                autoComplete='off'
                className='input-field w-full'
              />
            </label>
          ))}
          <label className='text-sm text-[var(--color-text)] space-y-1'>
            <span className='block'>Secret Access Key</span>
            <input
              type='password'
              value={storageForm.secretAccessKey}
              onChange={(event) =>
                setStorageField('secretAccessKey', event.target.value.trim())
              }
              placeholder={
                data.storage.hasSecret ? 'Tersimpan, isi untuk mengganti' : ''
              }
              autoComplete='new-password'
              className='input-field w-full'
            />
          </label>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={() => testStorage.mutate()}
            disabled={testStorage.isPending}
            className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-gray-50 disabled:opacity-50'
          >
            {testStorage.isPending && (
              <Loader2 className='h-4 w-4 animate-spin' />
            )}
            Tes koneksi
          </button>
          <button
            type='button'
            onClick={() => saveStorage.mutate()}
            disabled={saveStorage.isPending || !data.encryptionReady}
            className='btn-primary disabled:opacity-50'
          >
            Simpan
          </button>
          {storageNotice && (
            <p className='text-sm text-[var(--color-muted)]'>{storageNotice}</p>
          )}
        </div>
      </div>

      <div className='card p-6 space-y-5'>
        <h2 className='font-semibold text-[var(--color-text)]'>
          Jadwal otomatis
        </h2>
        <div className='flex flex-col sm:flex-row sm:items-end gap-4'>
          <label className='inline-flex items-center gap-2 text-sm text-[var(--color-text)] sm:pb-3'>
            <input
              type='checkbox'
              checked={form.enabled}
              onChange={(event) =>
                setForm({ ...form, enabled: event.target.checked })
              }
              className='h-4 w-4'
            />
            Aktif
          </label>
          <label className='text-sm text-[var(--color-text)] space-y-1'>
            <span className='block'>Jam (WIB)</span>
            <input
              type='time'
              value={form.time}
              onChange={(event) =>
                setForm({ ...form, time: event.target.value })
              }
              className='input-field'
            />
          </label>
          <label className='text-sm text-[var(--color-text)] space-y-1'>
            <span className='block'>Simpan backup otomatis terakhir</span>
            <input
              type='number'
              min={1}
              max={365}
              value={form.keep}
              onChange={(event) =>
                setForm({ ...form, keep: Number(event.target.value) })
              }
              className='input-field w-28'
            />
          </label>
          <button
            type='button'
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className='btn-primary disabled:opacity-50'
          >
            Simpan jadwal
          </button>
        </div>
        <p className='text-xs text-[var(--color-muted)]'>
          Backup otomatis yang lebih lama dihapus sendiri. Backup manual tidak
          dihapus otomatis.
        </p>
      </div>

      <div className='card p-6 space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='font-semibold text-[var(--color-text)]'>
              Daftar backup
            </h2>
            {data.listError && (
              <p className='text-xs text-red-600'>{data.listError}</p>
            )}
          </div>
          <button
            type='button'
            onClick={() => startBackup.mutate()}
            disabled={
              data.running || startBackup.isPending || !data.storage.hasSecret
            }
            className='btn-primary inline-flex items-center gap-2 disabled:opacity-50'
          >
            {data.running ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <DatabaseBackup className='h-4 w-4' />
            )}
            {data.running ? 'Sedang backup...' : 'Backup sekarang'}
          </button>
        </div>

        {notice && <p className='text-sm text-[var(--color-muted)]'>{notice}</p>}

        {data.backups.length === 0 ? (
          <p className='py-6 text-center text-sm text-[var(--color-muted)]'>
            Belum ada backup.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-xs uppercase tracking-wide text-[var(--color-muted)]'>
                  <th className='py-2 pr-4'>Waktu</th>
                  <th className='py-2 pr-4'>Ukuran</th>
                  <th className='py-2 pr-4'>Jenis</th>
                  <th className='py-2' />
                </tr>
              </thead>
              <tbody>
                {data.backups.map((backup) => (
                  <tr
                    key={backup.name}
                    className='border-t border-[var(--color-border)]'
                  >
                    <td className='py-3 pr-4 whitespace-nowrap'>
                      {new Date(backup.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className='py-3 pr-4 whitespace-nowrap'>
                      {formatSize(backup.size)}
                    </td>
                    <td className='py-3 pr-4'>
                      {backup.type === 'auto' ? 'Otomatis' : 'Manual'}
                    </td>
                    <td className='py-3'>
                      <div className='flex justify-end gap-2'>
                        <a
                          href={`/api/backups/${encodeURIComponent(backup.name)}`}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-gray-50'
                        >
                          <Download className='h-3.5 w-3.5' />
                          Download
                        </a>
                        <button
                          type='button'
                          onClick={() => {
                            if (window.confirm('Hapus backup ini?')) {
                              removeBackup.mutate(backup.name);
                            }
                          }}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

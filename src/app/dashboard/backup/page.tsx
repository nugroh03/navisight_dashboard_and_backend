'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Cloud,
  DatabaseBackup,
  Download,
  HardDrive,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';

type BackupItem = {
  name: string;
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
};

type BackupData = {
  backups: BackupItem[];
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

type ScheduleForm = { enabled: boolean; time: string; keep: number };

type StorageForm = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type Feedback = { ok: boolean; text: string } | null;

const FIELD_CLASS =
  'block h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-sm text-[var(--color-text)] placeholder:text-slate-400 transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20';
const SECONDARY_BUTTON_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-strong)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const formatDate = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className='block space-y-1.5'>
      <span className='block text-sm font-medium text-[var(--color-text)]'>
        {label}
      </span>
      {children}
      {hint && (
        <span className='block text-xs text-[var(--color-muted)]'>{hint}</span>
      )}
    </label>
  );
}

function FeedbackText({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const Icon = feedback.ok ? CheckCircle2 : XCircle;
  return (
    <p
      role='status'
      className={`flex items-start gap-2 text-sm ${feedback.ok ? 'text-emerald-700' : 'text-red-600'}`}
    >
      <Icon className='mt-0.5 h-4 w-4 shrink-0' />
      {feedback.text}
    </p>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'warning' | 'error';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
    >
      <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
      <span>{children}</span>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className='card flex items-center gap-4 p-5'>
      <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]'>
        {icon}
      </div>
      <div className='min-w-0'>
        <p className='text-xs font-medium text-[var(--color-muted)]'>{label}</p>
        <p className='font-semibold text-[var(--color-text)]'>{value}</p>
        <p className='text-xs text-[var(--color-muted)]'>{detail}</p>
      </div>
    </div>
  );
}

export default function BackupPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  const queryClient = useQueryClient();
  // Null berarti form mengikuti nilai tersimpan; terisi setelah pengguna mengubahnya.
  const [scheduleEdits, setScheduleEdits] = useState<ScheduleForm | null>(null);
  const [storageEdits, setStorageEdits] = useState<StorageForm | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<Feedback>(null);
  const [storageFeedback, setStorageFeedback] = useState<Feedback>(null);
  const [listFeedback, setListFeedback] = useState<Feedback>(null);

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

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['backups'] });

  const schedule: ScheduleForm = scheduleEdits ?? {
    enabled: data?.schedule.enabled ?? true,
    time: data?.schedule.time ?? '02:00',
    keep: data?.schedule.keep ?? 14,
  };
  const storage: StorageForm = storageEdits ?? {
    accountId: data?.storage.accountId ?? '',
    bucket: data?.storage.bucket ?? '',
    accessKeyId: data?.storage.accessKeyId ?? '',
    secretAccessKey: '',
  };
  const setStorageField = (field: keyof StorageForm, value: string) =>
    setStorageEdits({ ...storage, [field]: value });

  const saveSchedule = useMutation({
    mutationFn: () => sendJson('PATCH', schedule),
    onSuccess: () => {
      setScheduleFeedback({ ok: true, text: 'Jadwal tersimpan.' });
      setScheduleEdits(null);
      void refresh();
    },
    onError: (err: Error) =>
      setScheduleFeedback({ ok: false, text: err.message }),
  });
  const testStorage = useMutation({
    mutationFn: () => sendJson('POST', storage, '/storage/test'),
    onSuccess: () =>
      setStorageFeedback({
        ok: true,
        text: 'Koneksi berhasil. Bucket bisa ditulis, dibaca, dan dihapus.',
      }),
    onError: (err: Error) =>
      setStorageFeedback({ ok: false, text: err.message }),
  });
  const saveStorage = useMutation({
    mutationFn: () => sendJson('PUT', storage, '/storage'),
    onSuccess: () => {
      setStorageFeedback({ ok: true, text: 'Penyimpanan tersimpan.' });
      setStorageEdits(null);
      void refresh();
    },
    onError: (err: Error) =>
      setStorageFeedback({ ok: false, text: err.message }),
  });
  const startBackup = useMutation({
    mutationFn: () => sendJson('POST'),
    onSuccess: () => {
      setListFeedback({ ok: true, text: 'Backup dimulai.' });
      void refresh();
    },
    onError: (err: Error) => setListFeedback({ ok: false, text: err.message }),
  });
  const removeBackup = useMutation({
    mutationFn: (name: string) =>
      sendJson('DELETE', undefined, `/${encodeURIComponent(name)}`),
    onSuccess: () => {
      setListFeedback({ ok: true, text: 'Backup dihapus.' });
      void refresh();
    },
    onError: (err: Error) => setListFeedback({ ok: false, text: err.message }),
  });

  if (status === 'loading' || (isAdmin && isLoading)) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-[var(--color-primary)]' />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <p className='py-12 text-center text-red-600'>
        Halaman ini khusus ADMINISTRATOR.
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className='py-12 text-center text-red-600'>
        Gagal memuat data backup.
      </p>
    );
  }

  const latest = data.backups[0];
  const storageReady = data.storage.hasSecret;
  const canBackup = storageReady && !data.running && !startBackup.isPending;

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>
            Backup Database
          </h1>
          <p className='mt-1 text-sm text-[var(--color-muted)]'>
            Salinan database dalam format .sql, tersimpan di Cloudflare R2.
          </p>
        </div>
        <button
          type='button'
          onClick={() => startBackup.mutate()}
          disabled={!canBackup}
          className={PRIMARY_BUTTON_CLASS}
        >
          {data.running ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <DatabaseBackup className='h-4 w-4' />
          )}
          {data.running ? 'Sedang backup...' : 'Backup sekarang'}
        </button>
      </header>

      {!data.encryptionReady && (
        <Banner tone='warning'>
          <strong>BACKUP_ENCRYPTION_KEY</strong> belum diatur di server, jadi
          credential R2 belum bisa disimpan.
        </Banner>
      )}
      {data.encryptionReady && !storageReady && (
        <Banner tone='warning'>
          Penyimpanan R2 belum diatur, jadi backup belum berjalan.
        </Banner>
      )}
      {data.lastFailure && !data.running && (
        <Banner tone='error'>Backup terakhir gagal: {data.lastFailure}</Banner>
      )}
      {data.schedule.lastError && !data.lastFailure && (
        <Banner tone='error'>
          Backup otomatis terakhir gagal: {data.schedule.lastError}
        </Banner>
      )}

      <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Stat
          icon={<HardDrive className='h-5 w-5' />}
          label='Backup terakhir'
          value={latest ? formatDate(latest.createdAt) : 'Belum ada'}
          detail={latest ? formatSize(latest.size) : 'Buat backup pertama Anda'}
        />
        <Stat
          icon={<CalendarClock className='h-5 w-5' />}
          label='Jadwal otomatis'
          value={
            data.schedule.enabled
              ? `Setiap hari ${data.schedule.time} WIB`
              : 'Nonaktif'
          }
          detail={`Menyimpan ${data.schedule.keep} backup otomatis terakhir`}
        />
        <Stat
          icon={<Cloud className='h-5 w-5' />}
          label='Penyimpanan'
          value={storageReady ? data.storage.bucket : 'Belum diatur'}
          detail={storageReady ? 'Cloudflare R2' : 'Isi credential R2'}
        />
      </section>

      <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-5'>
        <section className='card overflow-hidden lg:col-span-3'>
          <div className='border-b border-[var(--color-border)] p-5'>
            <h2 className='font-semibold text-[var(--color-text)]'>
              Daftar backup
            </h2>
            <p className='mt-0.5 text-sm text-[var(--color-muted)]'>
              {data.backups.length} file tersimpan
            </p>
            {data.listError && (
              <p className='mt-2 text-sm text-red-600'>{data.listError}</p>
            )}
            {listFeedback && (
              <div className='mt-2'>
                <FeedbackText feedback={listFeedback} />
              </div>
            )}
          </div>

          {data.backups.length === 0 ? (
            <div className='flex flex-col items-center px-6 py-14 text-center'>
              <DatabaseBackup className='h-10 w-10 text-slate-300' />
              <p className='mt-3 font-medium text-[var(--color-text)]'>
                Belum ada backup
              </p>
              <p className='mt-1 max-w-xs text-sm text-[var(--color-muted)]'>
                {storageReady
                  ? 'Klik "Backup sekarang" untuk membuat backup pertama.'
                  : 'Atur penyimpanan R2 lebih dulu, lalu buat backup pertama.'}
              </p>
            </div>
          ) : (
            <ul className='divide-y divide-[var(--color-border)]'>
              {data.backups.map((backup) => (
                <li
                  key={backup.name}
                  className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5'
                >
                  <div className='min-w-0'>
                    <p className='font-medium text-[var(--color-text)]'>
                      {formatDate(backup.createdAt)}
                    </p>
                    <p className='mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]'>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          backup.type === 'auto'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {backup.type === 'auto' ? 'Otomatis' : 'Manual'}
                      </span>
                      {formatSize(backup.size)}
                    </p>
                  </div>
                  <div className='flex shrink-0 gap-2'>
                    <a
                      href={`/api/backups/${encodeURIComponent(backup.name)}`}
                      className='inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text)] transition hover:bg-slate-50'
                    >
                      <Download className='h-4 w-4' />
                      Download
                    </a>
                    <button
                      type='button'
                      aria-label={`Hapus backup ${formatDate(backup.createdAt)}`}
                      title='Hapus'
                      onClick={() => {
                        if (
                          window.confirm(
                            `Hapus backup ${formatDate(backup.createdAt)}?`
                          )
                        ) {
                          removeBackup.mutate(backup.name);
                        }
                      }}
                      className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className='space-y-6 lg:col-span-2'>
          <section className='card space-y-5 p-5'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='font-semibold text-[var(--color-text)]'>
                  Jadwal otomatis
                </h2>
                <p className='mt-0.5 text-sm text-[var(--color-muted)]'>
                  Berjalan sekali sehari.
                </p>
              </div>
              <label className='relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center'>
                <input
                  type='checkbox'
                  aria-label='Aktifkan jadwal otomatis'
                  checked={schedule.enabled}
                  onChange={(event) =>
                    setScheduleEdits({
                      ...schedule,
                      enabled: event.target.checked,
                    })
                  }
                  className='peer sr-only'
                />
                <span className='absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-[var(--color-primary-strong)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)]/40' />
                <span className='absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5' />
              </label>
            </div>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <Field label='Jam (WIB)'>
                <input
                  type='time'
                  value={schedule.time}
                  disabled={!schedule.enabled}
                  onChange={(event) =>
                    setScheduleEdits({ ...schedule, time: event.target.value })
                  }
                  className={`${FIELD_CLASS} disabled:bg-slate-50 disabled:text-slate-400`}
                />
              </Field>
              <Field label='Jumlah disimpan'>
                <input
                  type='number'
                  min={1}
                  max={365}
                  value={schedule.keep}
                  onChange={(event) =>
                    setScheduleEdits({
                      ...schedule,
                      keep: Number(event.target.value),
                    })
                  }
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
            <p className='text-xs text-[var(--color-muted)]'>
              Backup otomatis yang lebih lama terhapus sendiri. Backup manual
              tetap disimpan sampai Anda menghapusnya.
            </p>
            <FeedbackText feedback={scheduleFeedback} />
            <button
              type='button'
              onClick={() => saveSchedule.mutate()}
              disabled={!scheduleEdits || saveSchedule.isPending}
              className={`${PRIMARY_BUTTON_CLASS} w-full`}
            >
              {saveSchedule.isPending && (
                <Loader2 className='h-4 w-4 animate-spin' />
              )}
              Simpan jadwal
            </button>
          </section>

          <section className='card space-y-5 p-5'>
            <div>
              <h2 className='font-semibold text-[var(--color-text)]'>
                Penyimpanan Cloudflare R2
              </h2>
              <p className='mt-0.5 text-sm text-[var(--color-muted)]'>
                Pakai token khusus bucket ini dengan izin Object Read &amp;
                Write.
              </p>
            </div>
            <Field label='Account ID' hint='32 karakter, ada di halaman R2.'>
              <input
                value={storage.accountId}
                onChange={(event) =>
                  setStorageField('accountId', event.target.value.trim())
                }
                autoComplete='off'
                spellCheck={false}
                className={FIELD_CLASS}
              />
            </Field>
            <Field label='Nama bucket'>
              <input
                value={storage.bucket}
                onChange={(event) =>
                  setStorageField('bucket', event.target.value.trim())
                }
                placeholder='navisight-backup'
                autoComplete='off'
                spellCheck={false}
                className={FIELD_CLASS}
              />
            </Field>
            <Field label='Access Key ID'>
              <input
                value={storage.accessKeyId}
                onChange={(event) =>
                  setStorageField('accessKeyId', event.target.value.trim())
                }
                autoComplete='off'
                spellCheck={false}
                className={FIELD_CLASS}
              />
            </Field>
            <Field
              label='Secret Access Key'
              hint={
                data.storage.hasSecret
                  ? 'Sudah tersimpan terenkripsi. Kosongkan bila tidak diganti.'
                  : 'Disimpan terenkripsi dan tidak ditampilkan lagi.'
              }
            >
              <input
                type='password'
                value={storage.secretAccessKey}
                onChange={(event) =>
                  setStorageField('secretAccessKey', event.target.value.trim())
                }
                placeholder={data.storage.hasSecret ? '••••••••••••' : ''}
                autoComplete='new-password'
                className={FIELD_CLASS}
              />
            </Field>
            <FeedbackText feedback={storageFeedback} />
            <div className='grid grid-cols-2 gap-3'>
              <button
                type='button'
                onClick={() => testStorage.mutate()}
                disabled={testStorage.isPending}
                className={SECONDARY_BUTTON_CLASS}
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
                className={PRIMARY_BUTTON_CLASS}
              >
                {saveStorage.isPending && (
                  <Loader2 className='h-4 w-4 animate-spin' />
                )}
                Simpan
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

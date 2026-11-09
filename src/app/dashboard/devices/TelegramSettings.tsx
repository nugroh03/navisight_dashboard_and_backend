'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, ChevronDown, Loader2, Search, Send, XCircle } from 'lucide-react';

type TelegramData = {
  enabled: boolean;
  hasToken: boolean;
  chatId: string;
  alertDelayMin: number;
  notifyRecovery: boolean;
  lastError: string | null;
  lastSentAt: string | null;
  encryptionReady: boolean;
};

type Form = {
  enabled: boolean;
  token: string;
  chatId: string;
  alertDelayMin: number;
  notifyRecovery: boolean;
};

type Chat = { id: string; name: string; type: string };
type Feedback = { ok: boolean; text: string } | null;

const FIELD =
  'block h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-base text-[var(--color-text)] placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:text-sm';
const BUTTON =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-strong)] px-4 text-sm font-semibold !text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

async function call(method: string, body: unknown) {
  const response = await fetch('/api/monitoring/telegram', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? 'Permintaan gagal');
  return data;
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

export function TelegramSettings() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<Form | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [chats, setChats] = useState<Chat[] | null>(null);

  const { data } = useQuery({
    queryKey: ['monitoring-telegram'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/telegram');
      if (!response.ok) throw new Error('Gagal memuat pengaturan Telegram');
      return response.json() as Promise<TelegramData>;
    },
  });

  const form: Form = edits ?? {
    enabled: data?.enabled ?? false,
    token: '',
    chatId: data?.chatId ?? '',
    alertDelayMin: data?.alertDelayMin ?? 5,
    notifyRecovery: data?.notifyRecovery ?? true,
  };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setEdits({ ...form, [key]: value });
    setFeedback(null);
  };

  const save = useMutation({
    mutationFn: () => call('PUT', form),
    onSuccess: () => {
      setFeedback({ ok: true, text: 'Pengaturan tersimpan.' });
      setEdits(null);
      void queryClient.invalidateQueries({ queryKey: ['monitoring-telegram'] });
    },
    onError: (e: Error) => setFeedback({ ok: false, text: e.message }),
  });
  const test = useMutation({
    mutationFn: () => call('POST', { action: 'test', token: form.token, chatId: form.chatId }),
    onSuccess: () => setFeedback({ ok: true, text: 'Pesan uji terkirim. Cek Telegram.' }),
    onError: (e: Error) => setFeedback({ ok: false, text: e.message }),
  });
  const detect = useMutation({
    mutationFn: () => call('POST', { action: 'detect', token: form.token }),
    onSuccess: (result: { chats: Chat[] }) => {
      setChats(result.chats);
      if (result.chats.length === 1) set('chatId', result.chats[0].id);
      setFeedback(
        result.chats.length
          ? null
          : {
              ok: false,
              text: 'Belum ada chat. Kirim pesan apa saja ke bot (atau ke grup yang berisi bot), lalu coba lagi.',
            }
      );
    },
    onError: (e: Error) => setFeedback({ ok: false, text: e.message }),
  });

  const busy = save.isPending || test.isPending || detect.isPending;
  const hasToken = !!form.token || !!data?.hasToken;

  return (
    <section className='card p-4 sm:p-5'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center gap-3 text-left'
        aria-expanded={open}
      >
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]'>
          <Bell className='h-5 w-5' />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='font-semibold text-[var(--color-text)]'>Notifikasi Telegram</p>
          <p className='text-xs text-[var(--color-muted)]'>
            {data?.enabled
              ? `Aktif · dikirim bila gangguan ≥ ${data.alertDelayMin} menit`
              : 'Nonaktif'}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-[var(--color-muted)] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && data && (
        <div className='mt-5 space-y-4'>
          {!data.encryptionReady && (
            <p className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
              <strong>BACKUP_ENCRYPTION_KEY</strong> belum diatur di server, jadi token bot belum
              bisa disimpan.
            </p>
          )}
          {data.lastError && (
            <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
              Pengiriman terakhir gagal: {data.lastError}
            </p>
          )}

          <ol className='list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]'>
            <li>
              Di Telegram, buka <strong>@BotFather</strong>, kirim <code>/newbot</code>, lalu salin
              token yang diberikan.
            </li>
            <li>
              Kirim pesan apa saja ke bot baru itu (atau masukkan bot ke grup lalu kirim pesan di
              grup).
            </li>
            <li>Tempel token di bawah, tekan &quot;Cari chat&quot;, lalu &quot;Kirim uji&quot; dan &quot;Simpan&quot;.</li>
          </ol>

          <div className='grid gap-4 md:grid-cols-2'>
            <label className='block space-y-1.5'>
              <span className='block text-sm font-medium'>Token bot</span>
              <input
                type='password'
                autoComplete='off'
                value={form.token}
                onChange={(e) => set('token', e.target.value)}
                placeholder={data.hasToken ? '•••••• tersimpan (isi untuk mengganti)' : '123456789:AAH…'}
                className={FIELD}
              />
            </label>
            <label className='block space-y-1.5'>
              <span className='block text-sm font-medium'>Chat ID</span>
              <div className='flex gap-2'>
                <input
                  value={form.chatId}
                  onChange={(e) => set('chatId', e.target.value)}
                  placeholder='mis. 123456789 atau -100…'
                  inputMode='numeric'
                  className={FIELD}
                />
                <button
                  type='button'
                  onClick={() => detect.mutate()}
                  disabled={busy || !hasToken}
                  className={BUTTON}
                >
                  {detect.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Search className='h-4 w-4' />
                  )}
                  <span className='hidden whitespace-nowrap sm:inline'>Cari chat</span>
                </button>
              </div>
            </label>
          </div>

          {chats && chats.length > 1 && (
            <div className='flex flex-wrap gap-2'>
              {chats.map((c) => (
                <button
                  key={c.id}
                  type='button'
                  onClick={() => set('chatId', c.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    form.chatId === c.id
                      ? 'border-[var(--color-primary-strong)] bg-[var(--color-primary-strong)]/10'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {c.name} <span className='text-xs text-[var(--color-muted)]'>({c.type})</span>
                </button>
              ))}
            </div>
          )}

          <div className='grid gap-4 md:grid-cols-2'>
            <label className='block space-y-1.5'>
              <span className='block text-sm font-medium'>Kirim bila gangguan berlangsung minimal</span>
              <select
                value={form.alertDelayMin}
                onChange={(e) => set('alertDelayMin', Number(e.target.value))}
                className={FIELD}
              >
                {[1, 3, 5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} menit
                  </option>
                ))}
              </select>
              <span className='block text-xs text-[var(--color-muted)]'>
                Gangguan lebih singkat tetap tercatat di riwayat, tapi tidak dikirim.
              </span>
            </label>
            <div className='space-y-3 pt-1'>
              <label className='flex items-center gap-3 text-sm'>
                <input
                  type='checkbox'
                  checked={form.notifyRecovery}
                  onChange={(e) => set('notifyRecovery', e.target.checked)}
                  className='h-5 w-5'
                />
                Kirim juga saat perangkat pulih
              </label>
              <label className='flex items-center gap-3 text-sm font-semibold'>
                <input
                  type='checkbox'
                  checked={form.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                  className='h-5 w-5'
                />
                Aktifkan notifikasi
              </label>
            </div>
          </div>

          <FeedbackText feedback={feedback} />

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => test.mutate()}
              disabled={busy || !hasToken || !form.chatId}
              className={BUTTON}
            >
              {test.isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
              Kirim uji
            </button>
            <button
              type='button'
              onClick={() => save.mutate()}
              disabled={busy || !data.encryptionReady}
              className={PRIMARY}
            >
              {save.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              Simpan
            </button>
          </div>
          {data.lastSentAt && (
            <p className='text-xs text-[var(--color-muted)]'>
              Notifikasi terakhir:{' '}
              {new Date(data.lastSentAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

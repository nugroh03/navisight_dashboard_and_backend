'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, RefreshCw } from 'lucide-react';

const PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

const generatePassword = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(14)))
    .map((value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length])
    .join('');

interface ResetPasswordModalProps {
  user: { id: string; email: string; name: string | null };
  onClose: () => void;
}

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const [password, setPassword] = useState(generatePassword);
  const [copied, setCopied] = useState(false);

  const reset = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? 'Reset password gagal');
      }
    },
  });

  const copyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='reset-password-title'
        className='w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl'
      >
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600'>
            <KeyRound className='h-5 w-5' />
          </div>
          <div className='min-w-0'>
            <h3
              id='reset-password-title'
              className='font-semibold text-[var(--color-text)]'
            >
              {reset.isSuccess ? 'Password berhasil direset' : 'Reset password'}
            </h3>
            <p className='break-words text-sm text-[var(--color-muted)]'>
              {user.name ? `${user.name} · ` : ''}
              {user.email}
            </p>
          </div>
        </div>

        <div className='space-y-1.5'>
          <label
            htmlFor='new-password'
            className='block text-sm font-medium text-[var(--color-text)]'
          >
            Password baru
          </label>
          <div className='flex gap-2'>
            <input
              id='new-password'
              value={password}
              readOnly={reset.isSuccess}
              onChange={(event) => {
                setPassword(event.target.value);
                setCopied(false);
              }}
              autoComplete='off'
              spellCheck={false}
              className='block h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3.5 font-mono text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20'
            />
            {!reset.isSuccess && (
              <button
                type='button'
                aria-label='Buat password acak'
                title='Buat password acak'
                onClick={() => {
                  setPassword(generatePassword());
                  setCopied(false);
                }}
                className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-slate-50'
              >
                <RefreshCw className='h-4 w-4' />
              </button>
            )}
            <button
              type='button'
              aria-label='Salin password'
              title='Salin password'
              onClick={copyPassword}
              className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-slate-50'
            >
              {copied ? (
                <Check className='h-4 w-4 text-emerald-600' />
              ) : (
                <Copy className='h-4 w-4' />
              )}
            </button>
          </div>
          <p className='text-xs text-[var(--color-muted)]'>
            {reset.isSuccess
              ? 'Salin dan kirimkan sekarang. Password ini tidak ditampilkan lagi.'
              : 'Minimal 8 karakter. Password lama langsung tidak berlaku untuk login baru.'}
          </p>
        </div>

        {reset.isError && (
          <p role='alert' className='text-sm text-red-600'>
            {reset.error.message}
          </p>
        )}

        <div className='flex justify-end gap-3'>
          {reset.isSuccess ? (
            <button type='button' onClick={onClose} className='btn-primary'>
              Selesai
            </button>
          ) : (
            <>
              <button
                type='button'
                onClick={onClose}
                disabled={reset.isPending}
                className='h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-slate-50 disabled:opacity-50'
              >
                Batal
              </button>
              <button
                type='button'
                onClick={() => reset.mutate()}
                disabled={reset.isPending || password.length < 8}
                className='inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary-strong)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'
              >
                {reset.isPending && (
                  <Loader2 className='h-4 w-4 animate-spin' />
                )}
                Reset password
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

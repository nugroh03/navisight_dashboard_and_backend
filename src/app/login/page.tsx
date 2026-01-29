'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { APP_CONFIG } from '@/config/app';
import { Eye, EyeOff } from 'lucide-react';

const EMAIL_DOMAIN = 'translautjatim.com';

const normalizeEmailInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const localPart = trimmed.split('@')[0].trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return localPart ? `${localPart}@${EMAIL_DOMAIN}` : '';
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail) {
      setError('Email wajib diisi.');
      setLoading(false);
      return;
    }

    const response = await signIn('credentials', {
      redirect: false,
      email: normalizedEmail,
      password,
      callbackUrl: '/dashboard',
    });

    if (response?.error) {
      setError('Email atau password tidak valid.');
      setLoading(false);
      return;
    }

    if (response?.url) {
      window.location.href = response.url;
      return;
    }

    setLoading(false);
  }

  return (
    <main className='relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(15,106,216,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(25,161,248,0.18),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(15,106,216,0.14),transparent_34%)]'>
      <div className='absolute inset-0 bg-transparent' />
      <div className='absolute -left-24 top-[-15%] h-80 w-80 rounded-full bg-[var(--color-primary-strong)]/18 blur-3xl' />
      <div className='absolute right-[-10%] bottom-[-10%] h-[28rem] w-[28rem] rounded-full bg-[var(--color-accent)]/18 blur-3xl' />

      <div className='relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 lg:px-12'>
        <div className='w-full max-w-md'>
          <section className='card border-white/60 bg-white/90 p-10 shadow-2xl backdrop-blur'>
            <header className='mb-7 space-y-2'>
              <p className='text-sm font-semibold text-[var(--color-primary-strong)]'>
                Masuk • Portal
              </p>
              <h2 className='text-3xl font-semibold text-[var(--color-text)]'>
                {APP_CONFIG.name}
              </h2>
            </header>

            <form className='space-y-5' onSubmit={handleSubmit}>
              <div className='space-y-2'>
                <label
                  className='text-sm font-medium text-[var(--color-text)]'
                  htmlFor='email'
                >
                  Email
                </label>
                <div className='flex items-center rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3 transition focus-within:border-[var(--color-primary-strong)] focus-within:shadow-[0_12px_34px_rgba(15,106,216,0.12)]'>
                  <input
                    id='email'
                    type='text'
                    required
                    className='input-field'
                    placeholder='andre'
                    value={email}
                    onChange={(event) => setEmail(event.target.value.toLowerCase())}
                  />
                  {!email.includes('@') && (
                    <span className='ml-3 text-[var(--color-muted)]'>
                      @{EMAIL_DOMAIN}
                    </span>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <label
                  className='text-sm font-medium text-[var(--color-text)]'
                  htmlFor='password'
                >
                  Password
                </label>
                <div className='flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3 transition focus-within:border-[var(--color-primary-strong)] focus-within:shadow-[0_12px_34px_rgba(15,106,216,0.12)] relative'>
                  <span className='text-[var(--color-muted)]'>***</span>
                  <input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    required
                    className='input-field flex-1'
                    placeholder='Masukkan password'
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-muted)]'>
                <div className='flex items-center gap-2'>
                  <span className='h-4 w-4 rounded border border-[var(--color-border)] bg-white shadow-sm' />
                  Ingatkan saya di perangkat ini
                </div>
                <span className='font-semibold text-[var(--color-primary-strong)]'>
                  Butuh bantuan?
                </span>
              </div>

              {error ? (
                <div className='rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700'>
                  {error}
                </div>
              ) : null}

              <button
                type='submit'
                disabled={loading}
                className='btn-primary flex w-full items-center justify-center gap-2 rounded-xl text-base shadow-lg transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-75'
              >
                {loading ? 'Memverifikasi...' : 'Masuk dengan kredensial'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

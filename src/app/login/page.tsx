'use client';

import { FormEvent, useRef, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { APP_CONFIG } from '@/config/app';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

const EMAIL_DOMAIN = 'translautjatim.com';

const normalizeEmailInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@${EMAIL_DOMAIN}`;
};

// Kotak input: seluruh area bisa disentuh untuk fokus (penting di layar sentuh).
const fieldBoxClass =
  'flex min-h-12 cursor-text items-center rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 transition focus-within:border-[var(--color-primary-strong)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(15,106,216,0.15)]';

// text-base (16px) mencegah iOS Safari zoom otomatis saat input difokus.
const inputClass =
  'input-field min-w-0 flex-1 py-3 text-base placeholder:text-slate-400';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const normalizedEmail = normalizeEmailInput(email);
  const showDomainHint = email.trim() !== '' && !email.includes('@');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError('');

    if (!normalizedEmail) {
      setError('Email wajib diisi.');
      return;
    }
    if (!password) {
      setError('Password wajib diisi.');
      return;
    }

    setLoading(true);
    const connectionError =
      'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
    try {
      // signIn() next-auth v4 langsung pindah ke halaman /api/auth/error bila
      // server tak terjangkau (sinyal HP putus), sehingga isian form hilang.
      // Cek dulu agar pengguna cukup melihat pesan dan bisa mencoba lagi.
      const providers = await getProviders();
      if (!providers) {
        setError(connectionError);
        setLoading(false);
        return;
      }

      const response = await signIn('credentials', {
        redirect: false,
        email: normalizedEmail,
        password,
        callbackUrl: '/dashboard',
      });

      if (!response || response.error) {
        setError('Email atau password tidak valid.');
        setLoading(false);
        return;
      }

      window.location.href = response.url ?? '/dashboard';
    } catch {
      // Jangan biarkan tombol macet di "Memverifikasi..." bila request gagal.
      setError(connectionError);
      setLoading(false);
    }
  }

  return (
    <main className='relative min-h-screen min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(15,106,216,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(25,161,248,0.18),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(15,106,216,0.14),transparent_34%)]'>
      <div className='pointer-events-none absolute -left-24 top-[-15%] h-80 w-80 rounded-full bg-[var(--color-primary-strong)]/18 blur-3xl' />
      <div className='pointer-events-none absolute right-[-10%] bottom-[-10%] h-[28rem] w-[28rem] rounded-full bg-[var(--color-accent)]/18 blur-3xl' />

      <div className='relative mx-auto flex min-h-screen min-h-dvh max-w-6xl items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-12'>
        <div className='w-full max-w-md'>
          <section className='card border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-10'>
            <header className='mb-6 space-y-1 sm:mb-7 sm:space-y-2'>
              <p className='text-sm font-semibold text-[var(--color-primary-strong)]'>
                Masuk • Portal
              </p>
              <h1 className='text-2xl font-semibold text-[var(--color-text)] sm:text-3xl'>
                {APP_CONFIG.name}
              </h1>
            </header>

            <form className='space-y-5' onSubmit={handleSubmit} noValidate>
              <div className='space-y-2'>
                <label
                  className='text-sm font-medium text-[var(--color-text)]'
                  htmlFor='email'
                >
                  Email
                </label>
                <div
                  className={fieldBoxClass}
                  onClick={() => emailRef.current?.focus()}
                >
                  <input
                    ref={emailRef}
                    id='email'
                    name='username'
                    type='text'
                    inputMode='email'
                    autoComplete='username'
                    autoCapitalize='none'
                    autoCorrect='off'
                    spellCheck={false}
                    enterKeyHint='next'
                    className={inputClass}
                    placeholder='nama pengguna'
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value.toLowerCase())
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !password) {
                        event.preventDefault();
                        passwordRef.current?.focus();
                      }
                    }}
                  />
                  {!email.includes('@') && (
                    <span className='ml-2 hidden shrink-0 text-[var(--color-muted)] sm:inline'>
                      @{EMAIL_DOMAIN}
                    </span>
                  )}
                </div>
                <p className='text-xs text-[var(--color-muted)] sm:hidden'>
                  {showDomainHint ? (
                    <>
                      Masuk sebagai{' '}
                      <span className='font-semibold break-all text-[var(--color-text)]'>
                        {normalizedEmail}
                      </span>
                    </>
                  ) : (
                    <>Cukup ketik nama pengguna, @{EMAIL_DOMAIN} ditambahkan otomatis.</>
                  )}
                </p>
              </div>

              <div className='space-y-2'>
                <label
                  className='text-sm font-medium text-[var(--color-text)]'
                  htmlFor='password'
                >
                  Password
                </label>
                <div
                  className={`${fieldBoxClass} pr-1`}
                  onClick={() => passwordRef.current?.focus()}
                >
                  <input
                    ref={passwordRef}
                    id='password'
                    name='password'
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='current-password'
                    autoCapitalize='none'
                    autoCorrect='off'
                    spellCheck={false}
                    enterKeyHint='go'
                    className={inputClass}
                    placeholder='Masukkan password'
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type='button'
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowPassword((value) => !value);
                    }}
                    className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:text-slate-700 active:bg-slate-200/70'
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role='alert'
                  className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
                >
                  {error}
                </div>
              ) : null}

              <button
                type='submit'
                disabled={loading}
                className='btn-primary flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-[0_10px_24px_rgba(15,106,216,0.35)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary-strong)]/30 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-80'
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className='animate-spin' />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Masuk
                  </>
                )}
              </button>

              <p className='text-center text-sm text-[var(--color-muted)]'>
                Lupa password? Hubungi admin.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

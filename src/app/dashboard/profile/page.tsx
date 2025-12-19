'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { User, Lock, Mail, Shield, Save, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      await update();
      toast.success('Profile berhasil diperbarui');
    } catch {
      toast.error('Gagal memperbarui profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Password baru tidak cocok');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('Password berhasil diubah');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal mengubah password';
      toast.error(message);
    }
  };

  return (
    <div className='space-y-6 pb-20 md:pb-6'>
      {/* Header */}
      <div className='card border-[var(--color-border)] bg-white p-6 md:p-8 shadow-lg'>
        <div className='flex items-center gap-4'>
          <div className='flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary)] text-2xl font-semibold text-white'>
            {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className='text-xl md:text-2xl font-semibold text-[var(--color-text)]'>
              {session?.user?.name || 'User'}
            </h1>
            <p className='text-sm text-[var(--color-muted)] flex items-center gap-2 mt-1'>
              <Mail className='h-4 w-4' />
              {session?.user?.email}
            </p>
            {session?.user?.role && (
              <p className='text-xs text-[var(--color-primary)] flex items-center gap-1 mt-1'>
                <Shield className='h-3 w-3' />
                {session.user.role}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='card border-[var(--color-border)] bg-white shadow-lg overflow-hidden'>
        <div className='flex border-b border-[var(--color-border)]'>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition ${
              activeTab === 'profile'
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-blue-50/50'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <User className='h-4 w-4' />
            Update Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition ${
              activeTab === 'password'
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-blue-50/50'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Lock className='h-4 w-4' />
            Ganti Password
          </button>
        </div>

        <div className='p-6'>
          {activeTab === 'profile' ? (
            <form onSubmit={handleUpdateProfile} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Nama Lengkap
                </label>
                <input
                  type='text'
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  className='input-field w-full'
                  placeholder='Masukkan nama lengkap'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Email
                </label>
                <input
                  type='email'
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  className='input-field w-full'
                  placeholder='Masukkan email'
                />
              </div>

              <button
                type='submit'
                className='btn-primary w-full flex items-center justify-center gap-2'
              >
                <Save className='h-4 w-4' />
                Simpan Perubahan
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Password Saat Ini
                </label>
                <input
                  type='password'
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  className='input-field w-full'
                  placeholder='Masukkan password saat ini'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Password Baru
                </label>
                <input
                  type='password'
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  className='input-field w-full'
                  placeholder='Masukkan password baru'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Konfirmasi Password Baru
                </label>
                <input
                  type='password'
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className='input-field w-full'
                  placeholder='Konfirmasi password baru'
                  required
                />
              </div>

              <button
                type='submit'
                className='btn-primary w-full flex items-center justify-center gap-2'
              >
                <Lock className='h-4 w-4' />
                Ganti Password
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <div className='card border-[var(--color-border)] bg-white p-4 md:p-6 shadow-lg'>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition'
        >
          <LogOut className='h-5 w-5' />
          Logout
        </button>
      </div>
    </div>
  );
}

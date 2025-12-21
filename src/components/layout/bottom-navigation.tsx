'use client';

import { Home, Grid3x3, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MenuModal } from '@/components/layout/menu-modal';

export function BottomNavigation() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <nav className='fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:hidden rounded-t-3xl'>
        <div className='flex items-center justify-around h-16 px-4'>
          {/* Dashboard */}
          <Link
            href='/dashboard'
            className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-200 ${
              isActive('/dashboard') && pathname === '/dashboard'
                ? 'text-[var(--color-primary-strong)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-gray-50'
            }`}
          >
            {isActive('/dashboard') && pathname === '/dashboard' && (
              <span className='absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--color-primary-strong)] rounded-full' />
            )}
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                isActive('/dashboard') && pathname === '/dashboard'
                  ? 'bg-[var(--color-primary-strong)]/10'
                  : ''
              }`}
            >
              <Home className='h-6 w-6' />
            </div>
            <span className='text-xs font-medium'>Dashboard</span>
          </Link>

          {/* Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className='relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-gray-50 transition-all duration-200'
          >
            <div className='p-1.5 rounded-xl'>
              <Grid3x3 className='h-6 w-6' />
            </div>
            <span className='text-xs font-medium'>Menu</span>
          </button>

          {/* Profile */}
          <Link
            href='/dashboard/profile'
            className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-200 ${
              isActive('/dashboard/profile')
                ? 'text-[var(--color-primary-strong)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-gray-50'
            }`}
          >
            {isActive('/dashboard/profile') && (
              <span className='absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--color-primary-strong)] rounded-full' />
            )}
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                isActive('/dashboard/profile')
                  ? 'bg-[var(--color-primary-strong)]/10'
                  : ''
              }`}
            >
              <User className='h-6 w-6' />
            </div>
            <span className='text-xs font-medium'>Profile</span>
          </Link>
        </div>
      </nav>

      {/* Menu Modal */}
      <MenuModal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}

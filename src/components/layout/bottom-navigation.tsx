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
      <nav className='fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] shadow-lg md:hidden'>
        <div className='flex items-center justify-around h-16 px-4'>
          {/* Dashboard */}
          <Link
            href='/dashboard'
            className={`flex flex-col items-center justify-center gap-1 flex-1 ${
              isActive('/dashboard') && pathname === '/dashboard'
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-muted)]'
            }`}
          >
            <Home className='h-6 w-6' />
            <span className='text-xs font-medium'>Dashboard</span>
          </Link>

          {/* Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className='flex flex-col items-center justify-center gap-1 flex-1 text-[var(--color-muted)]'
          >
            <Grid3x3 className='h-6 w-6' />
            <span className='text-xs font-medium'>Menu</span>
          </button>

          {/* Profile */}
          <Link
            href='/dashboard/profile'
            className={`flex flex-col items-center justify-center gap-1 flex-1 ${
              isActive('/dashboard/profile')
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-muted)]'
            }`}
          >
            <User className='h-6 w-6' />
            <span className='text-xs font-medium'>Profile</span>
          </Link>
        </div>
      </nav>

      {/* Menu Modal */}
      <MenuModal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}

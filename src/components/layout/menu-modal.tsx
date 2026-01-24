'use client';

import {
  X,
  Camera,
  Map,
  MessageSquare,
  Users,
  FolderKanban,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MenuModal({ isOpen, onClose }: MenuModalProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [comingSoonDialog, setComingSoonDialog] = useState<{
    isOpen: boolean;
    featureName: string;
  }>({ isOpen: false, featureName: '' });

  if (!isOpen) return null;

  const allMenuItems = [
    {
      icon: Camera,
      label: 'CCTV',
      href: '/dashboard/cctv',
      color: 'bg-blue-50 text-blue-600',
      comingSoon: false,
    },
    {
      icon: Map,
      label: 'Maps',
      href: '/dashboard/maps',
      color: 'bg-green-50 text-green-600',
      comingSoon: false,
    },
    // {
    //   icon: MessageSquare,
    //   label: 'Message',
    //   href: '/dashboard/message',
    //   color: 'bg-purple-50 text-purple-600',
    //   comingSoon: true,
    // },
    {
      icon: Users,
      label: 'Users',
      href: '/dashboard/users',
      color: 'bg-orange-50 text-orange-600',
      comingSoon: false,
      allowedRoles: ['ADMINISTRATOR', 'CLIENT'],
    },
    {
      icon: FolderKanban,
      label: 'Projects',
      href: '/dashboard/projects',
      color: 'bg-pink-50 text-pink-600',
      comingSoon: false,
      allowedRoles: ['ADMINISTRATOR'],
    },
  ];

  // Filter menu items berdasarkan role
  const userRole = session?.user?.role;
  const menuItems = allMenuItems.filter((item) => {
    if (!item.allowedRoles) return true;
    if (!userRole) return false;
    return item.allowedRoles.includes(userRole);
  });

  return (
    <div className='fixed inset-0 z-50 md:hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* Modal */}
      <div className='absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-slide-up'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-[var(--color-border)]'>
          <h2 className='text-lg font-semibold text-[var(--color-text)]'>
            Menu
          </h2>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-100 transition'
          >
            <X className='h-5 w-5 text-[var(--color-muted)]' />
          </button>
        </div>

        {/* Menu Grid */}
        <div className='grid grid-cols-3 gap-4 p-6'>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            const handleClick = (e: React.MouseEvent) => {
              if (item.comingSoon) {
                e.preventDefault();
                setComingSoonDialog({ isOpen: true, featureName: item.label });
                return;
              }
              onClose();
            };

            return (
              <Link
                key={item.href}
                href={item.comingSoon ? '#' : item.href}
                onClick={handleClick}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition relative ${
                  item.comingSoon ? 'cursor-not-allowed' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex items-center justify-center h-14 w-14 rounded-2xl ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : item.color
                  } ${item.comingSoon ? 'opacity-60' : ''}`}
                >
                  <Icon className='h-7 w-7' />
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text)]'
                  }`}
                >
                  {item.label}
                </span>
                {item.comingSoon && (
                  <span className='absolute -top-1 -right-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow'>
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom spacing for safe area */}
        <div className='h-6' />
      </div>

      {/* Coming Soon Dialog */}
      {comingSoonDialog.isOpen && (
        <div className='absolute inset-0 z-10 flex items-center justify-center p-6'>
          <div
            className='absolute inset-0 bg-black/60 backdrop-blur-sm'
            onClick={() =>
              setComingSoonDialog({ isOpen: false, featureName: '' })
            }
          />
          <div className='relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-scale-up'>
            <div className='flex flex-col items-center text-center space-y-4'>
              {/* Icon */}
              <div className='flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg'>
                <Rocket className='h-10 w-10 text-white' />
              </div>

              {/* Title */}
              <h3 className='text-xl font-bold text-[var(--color-text)]'>
                Coming Soon!
              </h3>

              {/* Message */}
              <p className='text-[var(--color-muted)] leading-relaxed'>
                Fitur{' '}
                <strong className='text-[var(--color-text)]'>
                  {comingSoonDialog.featureName}
                </strong>{' '}
                sedang dalam pengembangan dan akan segera hadir!
              </p>

              {/* Button */}
              <button
                onClick={() =>
                  setComingSoonDialog({ isOpen: false, featureName: '' })
                }
                className='w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95'
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

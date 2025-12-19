'use client';

import {
  X,
  Camera,
  Map,
  MessageSquare,
  Users,
  FolderKanban,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MenuModal({ isOpen, onClose }: MenuModalProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  const menuItems = [
    {
      icon: Camera,
      label: 'CCTV',
      href: '/dashboard/cctv',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: Map,
      label: 'Maps',
      href: '/dashboard/maps',
      color: 'bg-green-50 text-green-600',
    },
    {
      icon: MessageSquare,
      label: 'Message',
      href: '/dashboard/message',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: Users,
      label: 'Users',
      href: '/dashboard/users',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      icon: FolderKanban,
      label: 'Projects',
      href: '/dashboard/projects',
      color: 'bg-pink-50 text-pink-600',
    },
  ];

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

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className='flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 transition'
              >
                <div
                  className={`flex items-center justify-center h-14 w-14 rounded-2xl ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : item.color
                  }`}
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
              </Link>
            );
          })}
        </div>

        {/* Bottom spacing for safe area */}
        <div className='h-6' />
      </div>
    </div>
  );
}

/**
 * Application Configuration
 * Centralized config untuk memudahkan perubahan nama aplikasi
 */

export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'NAVISIGHT',
} as const;

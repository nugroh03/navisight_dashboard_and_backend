import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from './providers';
import { APP_CONFIG } from '@/config/app';
import 'leaflet/dist/leaflet.css';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: 'Integrated surveillance system dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${manrope.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

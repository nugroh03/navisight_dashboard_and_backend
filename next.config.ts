import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        // next-auth memakai NEXTAUTH_URL (tanpa www); login lewat www membuat
        // cookie sesi di host yang berbeda sehingga gagal. Arahkan ke domain utama.
        source: '/:path*',
        has: [{ type: 'host', value: 'www.translautjatim.com' }],
        destination: 'https://translautjatim.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

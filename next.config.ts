import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'pdfjs-dist', 'mammoth'],
  async redirects() {
    return [
      { source: '/', destination: '/home', permanent: false },
      { source: '/admin/:path*', destination: '/events/admin/:path*', permanent: false },
      { source: '/attendee/:path*', destination: '/events/attendee/:path*', permanent: false },
    ]
  },
};

export default nextConfig;
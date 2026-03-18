import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'pdfjs-dist', 'mammoth'],
  async redirects() {
    return [
      // Remove or comment out the root redirect
      // { source: '/', destination: '/admin/login', permanent: false },
    ]
  },
};

export default nextConfig;
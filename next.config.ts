import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true }, // Proje ESLint yapılandırması içermiyor
  // İngilizce kısa adresler Türkçe rotalara yönlenir
  async redirects() {
    return [
      { source: "/book", destination: "/randevu-al", permanent: true },
      { source: "/lookup", destination: "/randevu-sorgula", permanent: true },
    ];
  },
};

export default nextConfig;

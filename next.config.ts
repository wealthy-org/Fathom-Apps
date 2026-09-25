import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres-js hanya jalan di Node — jangan bundle ke server chunk,
  // pakai native require. (Browser tidak pernah menyentuhnya: komponen
  // klien hanya import ABI murni dari lib/chain/vouch-abi.)
  serverExternalPackages: ["postgres"],
  async redirects() {
    return [
      { source: "/activity", destination: "/", permanent: true },
      { source: "/activity/me", destination: "/me", permanent: true },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/veteunpoquitoalamierda/:path*",
        destination: "/quenoseteolvide/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

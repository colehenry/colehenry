import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // page.tsx renders the lapwise screenshots at quality={100}.
    qualities: [75, 100],
  },
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

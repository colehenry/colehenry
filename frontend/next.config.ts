import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // page.tsx renders the lapwise screenshots at quality={85}; a quality the
    // list doesn't allow is rejected at request time, not at build.
    qualities: [85],
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

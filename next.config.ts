import type { NextConfig } from "next";

if (process.env.NODE_NO_WARNINGS !== "1") {
  process.env.NODE_NO_WARNINGS = "1";
}

if (process.env.NEXT_DISABLE_SOURCEMAPS !== "1") {
  // Prevent dev server from loading massive .map files (fixes Windows 1450 errors)
  process.env.NEXT_DISABLE_SOURCEMAPS = "1";
}

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        hostname: "i.ytimg.com",
        protocol: "https",
      },
      {
        hostname: "yt3.ggpht.com",
        protocol: "https",
      },
      {
        hostname: "prestigious-cheetah-520.convex.cloud",
        protocol: "https",
      },
      {
        hostname: "silent-armadillo-275.convex.cloud",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Champion photos are resized in the browser first; this leaves headroom.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;

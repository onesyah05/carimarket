import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  logging: {
    incomingRequests: {
      ignore: [/\/api\/integrations\/threads\/callback(?:\?|$)/],
    },
  },
};

export default nextConfig;

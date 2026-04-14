import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode causes React to mount→unmount→remount every component in development,
  // which interrupts the SignalR WebSocket negotiation. Disabled for local dev.
  // Re-enable before production to catch side effects.
  reactStrictMode: false,
};

export default nextConfig;

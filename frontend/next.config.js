/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /**
   * /api/* proxying is handled at runtime by middleware.ts, NOT here.
   * next.config.js is evaluated at build time, so any env var read here
   * would be baked in as undefined and fall back to localhost — useless
   * in production. middleware.ts reads BACKEND_URL on every request instead.
   */
};

module.exports = nextConfig;

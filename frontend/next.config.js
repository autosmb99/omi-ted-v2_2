/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Proxy /api/* → backend on localhost:8000.
   * This eliminates CORS entirely (v1 lesson: never let the browser hit the backend directly).
   * In prod, point BACKEND_URL to the Railway URL via env.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

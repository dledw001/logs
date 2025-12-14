const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_BASE_URL}/api/:path*` },
      { source: "/openapi.json", destination: `${API_BASE_URL}/openapi.json` },
      { source: "/docs", destination: `${API_BASE_URL}/docs` },
      { source: "/swagger.html", destination: `${API_BASE_URL}/swagger.html` },
      { source: "/health", destination: `${API_BASE_URL}/health` },
      { source: "/ready", destination: `${API_BASE_URL}/ready` },
      { source: "/metrics", destination: `${API_BASE_URL}/metrics` }
    ];
  }
};

export default config;

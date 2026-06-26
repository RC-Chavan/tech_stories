/** @type {import('next').NextConfig} */
const API_TARGET =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PRIVATE_API_TARGET ||
  "http://host.docker.internal:8000";

const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* on the Next server to the FastAPI backend. This lets:
  //   - Server components (SSR fetch inside the container) reach the backend
  //     via host.docker.internal, which only resolves from inside Docker.
  //   - Browser code use a same-origin /api/* path, which always works and
  //     avoids CORS, mixed-content, and host.docker.internal-in-the-browser
  //     problems in one shot.
  // The browser-facing NEXT_PUBLIC_API_BASE_URL stays at "" (empty), so
  // api.ts uses same-origin /api/... paths that get rewritten by Next.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
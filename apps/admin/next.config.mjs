const configuredApi = process.env.NEXT_PUBLIC_API_URL;
const api = configuredApi && !configuredApi.startsWith('/') ? configuredApi : (process.env.API_INTERNAL_URL || 'http://localhost:4000');
export default {
  output: 'standalone',
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }, { source: '/health', destination: `${api}/health` }];
  }
};

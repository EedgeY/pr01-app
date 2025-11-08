/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@workspace/ai',
    '@workspace/ui',
    '@workspace/auth',
    '@workspace/db',
    '@workspace/stripe',
  ],
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com'],
  },
  experimental: {
    optimizePackageImports: ['tldraw'],
  },
};

export default nextConfig;

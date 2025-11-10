/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@workspace/ai',
    '@workspace/ui',
    '@workspace/auth',
    '@workspace/db',
    '@workspace/stripe',
  ],
  serverComponentsExternalPackages: ['server-only'],
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com'],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@workspace/ui',
    '@workspace/auth',
    '@workspace/db',
    '@workspace/stripe',
  ],
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com'],
  },
};

export default nextConfig;

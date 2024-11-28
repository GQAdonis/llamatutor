/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Enable edge runtime for API routes
  experimental: {
    serverActions: true,
  }
}

module.exports = nextConfig 
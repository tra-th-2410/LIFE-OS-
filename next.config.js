/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['react-markdown', 'remark-math', 'rehype-katex', 'katex'],
  swcMinify: false,
};

module.exports = nextConfig;

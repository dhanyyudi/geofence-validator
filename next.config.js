/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["html2canvas", "react-leaflet", "leaflet"],
  // Disable server-side rendering for specific pages
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

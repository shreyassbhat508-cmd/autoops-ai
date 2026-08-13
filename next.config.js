/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // needed for receipt image uploads
    },
  },
};

module.exports = nextConfig;

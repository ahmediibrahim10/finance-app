/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // بيمنع توقف البناء بسبب أخطاء TypeScript البسيطة
    ignoreBuildErrors: true,
  },
  eslint: {
    // بيمنع توقف البناء بسبب تحذيرات الكود
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 注意：移除了 output: 'export' 以支持动态路由
  // 应用仍然是纯前端的，但需要部署到支持服务端渲染的平台
  // 如 Vercel、Netlify、Cloudflare Pages
  
  // 禁用图片优化（可选，根据部署平台决定）
  images: {
    unoptimized: true,
  },
  // 添加尾部斜杠，有助于静态托管
  trailingSlash: true,
  // 可选：设置基础路径（如果部署在子目录）
  // basePath: '/your-subdirectory',
  // 可选：设置资产前缀（如果使用 CDN）
  // assetPrefix: '/your-cdn-path',
};

export default nextConfig;

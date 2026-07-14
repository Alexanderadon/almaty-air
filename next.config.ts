import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/**
 * PWA через @serwist/next (webpack-режим, InjectManifest).
 *
 * Важно: классический @serwist/next работает только с webpack, поэтому
 * production-сборка запускается как `next build --webpack` (см. package.json).
 * Turbopack-путь потребовал бы пакет @serwist/turbopack, который не установлен.
 * В dev сервис-воркер отключён — Turbopack-dev работает без webpack-хука.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);

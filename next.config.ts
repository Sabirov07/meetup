import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Next.js logs every Server Function call in development *with its
  // arguments*, which puts the plaintext password from /login and /signup in
  // the terminal on every attempt. There is no per-action redaction, so the
  // whole line goes. Timings are still visible per request.
  logging: { serverFunctions: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

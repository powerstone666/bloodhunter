import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["next-auth", "better-sqlite3"],
};

export default nextConfig;

import type { NextConfig } from "next";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@phundz/shared"],
  webpack: (config, { dev }) => {
    if (dev) {
      const existing = config.watchOptions?.ignored;
      let ignored: RegExp | string[];
      if (existing instanceof RegExp) {
        ignored = new RegExp(`${existing.source}|[\\\\/]\\.pgdata(?:[\\\\/]|$)`);
      } else if (Array.isArray(existing)) {
        ignored = [...existing, "**/.pgdata/**"];
      } else if (typeof existing === "string") {
        ignored = [existing, "**/.pgdata/**"];
      } else {
        ignored = /[\\/]\.pgdata(?:[\\/]|$)/;
      }
      config.watchOptions = {
        ...config.watchOptions,
        ignored,
      };
    }
    return config;
  },
};

export default nextConfig;
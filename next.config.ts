import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root to this project. Without it, Turbopack
  // walks up looking for a lockfile, finds one in the user's home
  // directory, and warns about an ambiguous root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@provenancekit/sdk", "@provenancekit/openai"],
};

export default nextConfig;

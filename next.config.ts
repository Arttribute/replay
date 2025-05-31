/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["sharp", "onnxruntime-node"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ipfs.w3s.link",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "api.astria.ai",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "cdn1.iconfinder.com",
      },
      {
        protocol: "https",
        hostname: "oaidalleapiprodscus.blob.core.windows.net", // Dalle Imahges
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Added domain for Google user images
      },
    ],
  },
};

export default nextConfig;

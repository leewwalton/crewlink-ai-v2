const fs = require("fs");
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  transpilePackages: ["@crewlink/domain"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/node_modules", "**/.git"],
      };
    }

    const root = path.resolve(__dirname, "../..");
    const resolveOutput = (filename, exampleFilename) => {
      const primary = path.join(root, filename);
      if (fs.existsSync(primary)) return primary;
      return path.join(root, exampleFilename);
    };

    const cdkOutputsPath = resolveOutput("cdk-outputs.json", "cdk-outputs.example.json");
    const amplifyOutputsPath = resolveOutput(
      "amplify_outputs.json",
      "amplify_outputs.example.json",
    );

    config.resolve.alias = {
      ...config.resolve.alias,
      "@crewlink/domain": path.join(root, "packages/domain/src"),
      "@root": root,
      "@root/cdk-outputs.json": cdkOutputsPath,
      "@root/amplify_outputs.json": amplifyOutputsPath,
      "../../../cdk-outputs.json": cdkOutputsPath,
      "../../../amplify_outputs.json": amplifyOutputsPath,
    };
    return config;
  },
};

module.exports = nextConfig;

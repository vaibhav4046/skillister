import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Pin the trace root to this directory. Without it Next infers the parent
  // workspace, which holds unrelated lockfiles and tooling config.
  outputFileTracingRoot: here,
};

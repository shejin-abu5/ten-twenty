import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next writes AGENTS.md / CLAUDE.md into the repo root otherwise.
  agentRules: false,
  // better-sqlite3 is a native addon: it must be required at runtime rather
  // than bundled, or the .node binary never makes it into the server build.
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // The three workbooks are small, but a year of timesheet rows should not
    // bounce off the default 1 MB action limit.
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;

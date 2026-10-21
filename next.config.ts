import type { NextConfig } from 'next';

import { operatorRouteAliases, retiredDeskRoutes } from './features/platform/lib/operator-route-aliases';

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['airline.local'],
  serverExternalPackages: ['graphql'],
  // Workaround since we diverged from Keystone reltionship and document views
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  // Conventional operator module paths (/dashboard/flights, /dashboard/passengers, ...) and the retired pre-platform
  // desk URLs open the safeguarded workboards; item and create pages under those paths are untouched.
  async redirects() {
    return Object.entries({ ...operatorRouteAliases, ...retiredDeskRoutes }).map(([alias, destination]) => ({
      source: `/dashboard/${alias}`,
      destination,
      permanent: false,
    }))
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : '/',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
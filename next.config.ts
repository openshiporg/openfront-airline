import type { NextConfig } from 'next';
import { s3ForcePathStyle } from './features/keystone/lib/s3-storage';

const s3Hostname = process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : '/';

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
  // robots.txt and sitemap.xml are served from /api, which the shared proxy never redirects to first-run setup.
  async redirects() {
    return [
      ...Object.entries({ ...operatorRouteAliases, ...retiredDeskRoutes }).map(([alias, destination]) => ({
        source: `/dashboard/${alias}`,
        destination,
        permanent: false,
      })),
      { source: '/robots.txt', destination: '/api/robots.txt', permanent: false },
      { source: '/sitemap.xml', destination: '/api/sitemap.xml', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // Virtual-hosted buckets serve images from <bucket>.<endpoint host>
        hostname: s3ForcePathStyle(process.env.S3_ENDPOINT) ? s3Hostname : `${process.env.S3_BUCKET_NAME}.${s3Hostname}`,
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
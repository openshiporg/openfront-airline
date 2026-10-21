import { list } from '@keystone-6/core'
import { integer, text, timestamp } from '@keystone-6/core/fields'

import { trackingFields } from './trackingFields'

export const RateLimitBucket = list({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    scope: text({ validation: { isRequired: true } }),
    count: integer({ defaultValue: 0, validation: { min: 0 } }),
    windowStartedAt: timestamp({ validation: { isRequired: true } }),
    expiresAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields,
  },
})

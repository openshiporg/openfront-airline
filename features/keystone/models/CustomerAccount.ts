import { list } from '@keystone-6/core'
import { checkbox, integer, text } from '@keystone-6/core/fields'

import { trackingFields } from './trackingFields'

// A traveler's sign-in on the storefront (not staff: staff are Users). Only the storefront account resolvers in
// mutations/customerAccounts.ts read or write it; it is not part of the GraphQL API or the dashboard.
export const CustomerAccount = list({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    // `${carrierCode}:${lower-case email}`: one account per email per airline.
    accountKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    carrierCode: text({ validation: { isRequired: true } }),
    email: text({ validation: { isRequired: true } }),
    passwordHash: text({ validation: { isRequired: true } }),
    emailVerified: checkbox({ defaultValue: false }),
    // Bumped on password change or reset: every older session and reset link stops working.
    sessionVersion: integer({ defaultValue: 1, validation: { isRequired: true } }),
    givenName: text(),
    familyName: text(),
    dateOfBirth: text(),
    phone: text(),
    ...trackingFields,
  },
})

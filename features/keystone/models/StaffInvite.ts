import { list } from '@keystone-6/core'
import { text, timestamp } from '@keystone-6/core/fields'

import { trackingFields } from './trackingFields'

// A pending staff invitation. Only the invite resolvers in mutations/staffInvites.ts read or write it: an
// administrator invites an email with a role, the invitee opens the emailed link, chooses a name and password, and a
// User with that role is created. Only a hash of the link token is stored.
export const StaffInvite = list({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    carrierId: text({ validation: { isRequired: true } }),
    roleId: text({ validation: { isRequired: true } }),
    email: text({ validation: { isRequired: true }, isIndexed: true }),
    tokenHash: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    invitedById: text({ validation: { isRequired: true } }),
    expiresAt: timestamp({ validation: { isRequired: true } }),
    acceptedAt: timestamp(),
    revokedAt: timestamp(),
    ...trackingFields,
  },
})

import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const DocumentVerification = list({
  access: commandOnlyCarrierAccess('canManageSecurePassengerData', 'canManageSecurePassengerData'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'verificationKey', hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['passenger', 'bookingSegment', 'status', 'verifiedAt', 'expiresAt'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.documentVerifications', access: immutableFieldAccess }),
    verificationKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    passenger: relationship({ ref: 'Passenger.documentVerifications', access: immutableFieldAccess }),
    travelDocument: relationship({ ref: 'TravelDocument.verifications', access: immutableFieldAccess }),
    bookingSegment: relationship({ ref: 'BookingSegment.documentVerifications', access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'verified', options: [
      { label: 'Verified', value: 'verified' }, { label: 'Rejected', value: 'rejected' }, { label: 'Revoked', value: 'revoked' }, { label: 'Expired', value: 'expired' },
    ] }),
    evidenceVersion: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    providerReference: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    verifiedBy: relationship({ ref: 'User.documentVerifications', access: immutableFieldAccess }),
    verifiedAt: timestamp({ defaultValue: { kind: 'now' }, access: immutableFieldAccess }),
    expiresAt: timestamp({ validation: { isRequired: true }, access: immutableFieldAccess }),
    revokedAt: timestamp(),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier', 'passenger', 'travelDocument', 'bookingSegment', 'verifiedBy']),
})

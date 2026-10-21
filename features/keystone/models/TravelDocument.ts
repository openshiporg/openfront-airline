import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import {
  canReadSecurePassengerData,
  commandOnlyCarrierAccess,
  commandOnlyGraphql,
} from '../access'
import {
  combineListHooks,
  requiredRelationshipHooks,
  travelDocumentHooks,
} from '../lib/validation'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

const secureAccess = {
  read: canReadSecurePassengerData,
  create: canReadSecurePassengerData,
  update: canReadSecurePassengerData,
}

export const TravelDocument = list({
  access: commandOnlyCarrierAccess('canManageSecurePassengerData', 'canManageSecurePassengerData'),
  graphql: commandOnlyGraphql(),
  ui: {
    labelField: 'documentNumberLast4',
    listView: { initialColumns: ['passenger', 'documentType', 'issuingCountryCode', 'expiresAt', 'status'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    passenger: relationship({ ref: 'Passenger.travelDocuments' }),
    documentType: select({
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: 'Passport', value: 'passport' },
        { label: 'National identity card', value: 'national_id' },
        { label: 'Residence permit', value: 'residence_permit' },
        { label: 'Visa', value: 'visa' },
        { label: 'Known traveler credential', value: 'known_traveler' },
        { label: 'Redress credential', value: 'redress' },
        { label: 'Other', value: 'other' },
      ],
    }),
    documentNumberToken: text({
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { isNullable: true },
    }),
    documentNumberHash: text({
      isIndexed: true,
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { isNullable: true },
      validation: {
        match: {
          regex: /^[a-f0-9]{64}$/i,
          explanation: 'Store only a SHA-256 hex lookup digest.',
        },
      },
    }),
    encryptedPayload: text({
      access: secureAccess,
      ui: hiddenSensitiveUi,
      db: { nativeType: 'Text', isNullable: true },
    }),
    documentNumberLast4: text({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z0-9]{4}$/, explanation: 'Store only the final four characters.' } },
    }),
    issuingCountryCode: text({
      validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: 'Use an ISO 3166-1 alpha-2 code.' } },
    }),
    nationalityCode: text({
      db: { isNullable: true },
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: 'Use an ISO 3166-1 alpha-2 code.' } },
    }),
    issuedAt: timestamp(),
    expiresAt: timestamp(),
    status: select({
      type: 'enum',
      defaultValue: 'unverified',
      options: [
        { label: 'Unverified', value: 'unverified' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
    }),
    verificationProviderReference: text({ access: secureAccess, ui: hiddenSensitiveUi }),
    verifiedAt: timestamp(),
    verifiedBy: relationship({ ref: 'User' }),
    verifications: relationship({ ref: 'DocumentVerification.travelDocument', many: true }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier', 'passenger']),
    travelDocumentHooks(),
  ),
})

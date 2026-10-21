import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyCarrierAccess, commandOnlyGraphql } from '../access'
import { requiredRelationshipHooks } from '../lib/validation'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const OnboardingStep = list({
  access: commandOnlyCarrierAccess('canManageOnboarding', 'canManageOnboarding'),
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'step', hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['step', 'status', 'attemptCount', 'completedAt'] } },
  fields: {
    carrier: relationship({ ref: 'Carrier.onboardingSteps', access: immutableFieldAccess }),
    user: relationship({ ref: 'User.onboardingSteps', access: immutableFieldAccess }),
    progressKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    step: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'pending', options: [{ label: 'Pending', value: 'pending' }, { label: 'Completed', value: 'completed' }, { label: 'Needs attention', value: 'needs_attention' }] }),
    attemptCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    inputDigest: text({ access: immutableFieldAccess }),
    requirements: json({ defaultValue: [] }),
    completedAt: timestamp(),
    lastAttemptedAt: timestamp(),
    ...trackingFields,
  },
  hooks: requiredRelationshipHooks(['carrier', 'user']),
})

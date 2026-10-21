import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, select, text } from '@keystone-6/core/fields'

import { carrierScopedAccess, hasFreshPermission } from '../access'
import { isEvidenceOnlyManualProvider } from '../lib/bounded-payment-policy'
import { combineListHooks, requiredRelationshipHooks } from '../lib/validation'
import { hiddenSensitiveUi } from './fields'
import { trackingFields } from './trackingFields'

const managePaymentSecrets = (args: any) => hasFreshPermission(args, 'canManagePayments')
const legacySelectorUi = { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const }, listView: { fieldMode: 'hidden' as const } }
// Only the evidence-only manual adapter is installed; other adapter types are kept readable on retained records.
const INSTALLED_ADAPTER_TYPES = ['manual']

export const PaymentProvider = list({
  access: carrierScopedAccess('canReadPayments', 'canManagePayments'),
  ui: {
    labelField: 'name',
    listView: { initialColumns: ['name', 'code', 'adapterType', 'status', 'carrier'] },
    hideDelete: true,
  },
  fields: {
    carrier: relationship({ ref: 'Carrier' }),
    providerKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true } }),
    adapterType: select({
      type: 'enum',
      defaultValue: 'manual',
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'PayPal', value: 'paypal' },
        { label: 'Manual', value: 'manual' },
        { label: 'Custom', value: 'custom' },
      ],
    }),
    status: select({
      type: 'enum',
      defaultValue: 'inactive',
      options: [
        { label: 'Inactive', value: 'inactive' },
        { label: 'Active', value: 'active' },
        { label: 'Degraded', value: 'degraded' },
        { label: 'Disabled', value: 'disabled' },
      ],
    }),
    credentials: json({
      defaultValue: {},
      access: { read: denyAll, create: managePaymentSecrets, update: managePaymentSecrets },
      ui: hiddenSensitiveUi,
    }),
    configuration: json({ defaultValue: {} }),
    // Legacy selector columns: the dispatcher (integrations/payment/index.ts) selects only by adapterType, so these are
    // kept for retained records but are neither required nor offered when configuring a provider.
    createPaymentFunction: text({ ui: legacySelectorUi }),
    capturePaymentFunction: text({ ui: legacySelectorUi }),
    refundPaymentFunction: text({ ui: legacySelectorUi }),
    getPaymentStatusFunction: text({ ui: legacySelectorUi }),
    handleWebhookFunction: text({ ui: legacySelectorUi }),
    sessions: relationship({ ref: 'PaymentSession.provider', many: true, access: { create: () => false, update: () => false } }),
    payments: relationship({ ref: 'Payment.provider', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
  hooks: combineListHooks(
    requiredRelationshipHooks(['carrier']),
    { validate({ resolvedData, item, addValidationError }: any) {
      if (resolvedData.adapterType !== undefined && resolvedData.adapterType !== item?.adapterType && !INSTALLED_ADAPTER_TYPES.includes(resolvedData.adapterType)) {
        addValidationError('Only the manual (evidence-only) payment adapter is installed.')
      }
      const status = resolvedData.status ?? item?.status
      const provider = {
        adapterType: resolvedData.adapterType ?? item?.adapterType ?? null,
        configuration: resolvedData.configuration ?? item?.configuration ?? null,
      }
      if (status === 'active' && !isEvidenceOnlyManualProvider(provider)) addValidationError('Active payment providers must be configured for evidence-only manual settlement with independent approval.')
    } },
  ),
})

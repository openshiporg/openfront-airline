import { list } from '@keystone-6/core'
import { json, select, text, timestamp } from '@keystone-6/core/fields'

import { commandOnlyGraphql, hasFreshPermission } from '../access'
import { immutableFieldAccess } from './fields'
import { trackingFields } from './trackingFields'

export const WorkerHeartbeat = list({
  access: {
    operation: { query: args => hasFreshPermission(args, 'canReadAudit'), create: () => false, update: () => false, delete: () => false },
  },
  graphql: commandOnlyGraphql(),
  ui: { labelField: 'workerKey', hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['workerKey', 'component', 'status', 'lastSeenAt'] } },
  fields: {
    workerKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: immutableFieldAccess }),
    component: text({ validation: { isRequired: true }, access: immutableFieldAccess }),
    status: select({ type: 'enum', defaultValue: 'running', options: [{ label: 'Running', value: 'running' }, { label: 'Draining', value: 'draining' }, { label: 'Stopped', value: 'stopped' }] }),
    lastSeenAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
})

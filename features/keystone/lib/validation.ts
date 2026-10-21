export function assertMinorAmount(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative safe minor-unit integer.`)
  }
  return Number(value)
}

export function assertChronologicalRange(
  startValue: string | Date,
  endValue: string | Date,
  label: string,
) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`${label} start and end must be valid timestamps.`)
  }
  if (end <= start) throw new Error(`${label} end must be after start.`)
}

export function assertInventoryCounts(input: {
  capacity: number
  authorized: number
  sold: number
  held: number
  blocked: number
}) {
  const values = [input.capacity, input.authorized, input.sold, input.held, input.blocked]
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('Inventory counts must be non-negative integers.')
  }
  if (input.authorized > input.capacity) {
    throw new Error('Authorized inventory cannot exceed physical capacity.')
  }
  if (input.blocked > input.capacity || input.sold + input.held + input.blocked > input.authorized) {
    throw new Error('Sold, held, and blocked quantities exceed authorized inventory.')
  }
}

export function assertTravelDocumentProtection(input: {
  documentNumberToken?: unknown
  documentNumberHash?: unknown
  encryptedPayload?: unknown
  documentNumberLast4?: unknown
}) {
  const hasToken = typeof input.documentNumberToken === 'string' && input.documentNumberToken.trim().length >= 8
  const hasEncryptedPayload = typeof input.encryptedPayload === 'string' && input.encryptedPayload.trim().length >= 16
  if (!hasToken && !hasEncryptedPayload) {
    throw new Error('Travel document material must be tokenized or encrypted before storage.')
  }
  if (
    input.documentNumberHash !== undefined &&
    input.documentNumberHash !== null &&
    !/^[a-f0-9]{64}$/i.test(String(input.documentNumberHash))
  ) {
    throw new Error('Travel document hash must be a SHA-256 hex digest.')
  }
  if (
    input.documentNumberLast4 !== undefined &&
    input.documentNumberLast4 !== null &&
    !/^[A-Z0-9]{4}$/i.test(String(input.documentNumberLast4))
  ) {
    throw new Error('Travel document last four must contain exactly four letters or digits.')
  }
}

function currentValue(resolvedData: Record<string, any>, item: Record<string, any> | undefined, key: string) {
  return resolvedData[key] === undefined ? item?.[key] : resolvedData[key]
}

function relationshipIsConnected(value: any) {
  if (!value) return false
  if (typeof value === 'string') return true
  if (typeof value.id === 'string' || typeof value.connect?.id === 'string') return true
  return Array.isArray(value.connect) && value.connect.length > 0
}

function connectedRelationshipIds(value: any) {
  if (!value || value.disconnect === true) return []
  const candidates = [value.id, value.connect, value.set].flatMap(candidate => Array.isArray(candidate) ? candidate : candidate ? [candidate] : [])
  return [...new Set(candidates.map(candidate => typeof candidate === 'string' ? candidate : candidate?.id).filter((id): id is string => typeof id === 'string'))]
}

/** Validate direct relationship connects against the owning record's carrier. */
export function carrierRelationshipHooks(specs: Record<string, { model: string; carrierField?: string }>) {
  return {
    async validate({ resolvedData, item, context, addValidationError }: any) {
      const carrierId = resolvedData.carrier?.connect?.id ?? resolvedData.carrier?.id ?? item?.carrierId
      if (!carrierId) return
      for (const [field, spec] of Object.entries(specs)) {
        const value = resolvedData[field]
        if (value === undefined || value?.disconnect === true) continue
        if (value?.create) {
          addValidationError(`${field} must reference a separately validated record in the same carrier.`)
          continue
        }
        const ids = connectedRelationshipIds(value)
        if (!ids.length) continue
        const carrierField = spec.carrierField ?? 'carrierId'
        const rows = await context.prisma[spec.model].findMany({ where: { id: { in: ids } }, select: { id: true, [carrierField]: true } })
        if (rows.length !== ids.length || rows.some((row: any) => row[carrierField] !== carrierId)) addValidationError(`${field} must belong to the same carrier.`)
      }
    },
  }
}

function reportValidation(addValidationError: (message: string) => void, operation: () => void) {
  try {
    operation()
  } catch (error) {
    addValidationError(error instanceof Error ? error.message : 'Invalid data.')
  }
}

export function combineListHooks(...hooks: Array<{ validate?: (args: any) => unknown }>) {
  const validators = hooks.flatMap(hook => hook?.validate ? [hook.validate] : [])
  return {
    async validate(args: any) {
      for (const validate of validators) await validate(args)
    },
  }
}

export function commandOwnedRelationshipHooks(fields: readonly string[]) {
  return {
    validate({ resolvedData, addValidationError }: any) {
      for (const field of fields) {
        if (resolvedData[field] !== undefined) addValidationError(`${field} is maintained by the authoritative related-record command and cannot be reassigned here.`)
      }
    },
  }
}

export function requiredRelationshipHooks(fields: readonly string[]) {
  return {
    validate({ operation, resolvedData, addValidationError }: any) {
      for (const field of fields) {
        const value = resolvedData?.[field]
        if (operation === 'create' && !relationshipIsConnected(value)) {
          addValidationError(`${field} relationship is required.`)
        }
        if (operation === 'update' && (value?.disconnect === true || value === null)) {
          addValidationError(`${field} relationship cannot be disconnected.`)
        }
      }
    },
  }
}

export function chronologicalRangeHooks(startField: string, endField: string, label: string) {
  return {
    validate({ resolvedData, item, addValidationError }: any) {
      const start = currentValue(resolvedData, item, startField)
      const end = currentValue(resolvedData, item, endField)
      if (start === undefined || start === null || end === undefined || end === null) return
      reportValidation(addValidationError, () => assertChronologicalRange(start, end, label))
    },
  }
}

export function inventoryCountHooks() {
  return {
    validate({ resolvedData, item, addValidationError }: any) {
      reportValidation(addValidationError, () => assertInventoryCounts({
        capacity: Number(currentValue(resolvedData, item, 'capacity') ?? 0),
        authorized: Number(currentValue(resolvedData, item, 'authorized') ?? 0),
        sold: Number(currentValue(resolvedData, item, 'sold') ?? 0),
        held: Number(currentValue(resolvedData, item, 'held') ?? 0),
        blocked: Number(currentValue(resolvedData, item, 'blocked') ?? 0),
      }))
    },
  }
}

export function minorAmountHooks(fields: readonly string[]) {
  return {
    validate({ resolvedData, item, addValidationError }: any) {
      for (const field of fields) {
        const amount = currentValue(resolvedData, item, field)
        if (amount === undefined || amount === null) continue
        reportValidation(addValidationError, () => assertMinorAmount(amount, field))
      }
    },
  }
}

export function travelDocumentHooks() {
  return {
    validate({ resolvedData, item, addValidationError }: any) {
      reportValidation(addValidationError, () => assertTravelDocumentProtection({
        documentNumberToken: currentValue(resolvedData, item, 'documentNumberToken'),
        documentNumberHash: currentValue(resolvedData, item, 'documentNumberHash'),
        encryptedPayload: currentValue(resolvedData, item, 'encryptedPayload'),
        documentNumberLast4: currentValue(resolvedData, item, 'documentNumberLast4'),
      }))

      const issuedAt = currentValue(resolvedData, item, 'issuedAt')
      const expiresAt = currentValue(resolvedData, item, 'expiresAt')
      if (issuedAt && expiresAt) {
        reportValidation(addValidationError, () => assertChronologicalRange(issuedAt, expiresAt, 'Travel document validity'))
      }
    },
  }
}

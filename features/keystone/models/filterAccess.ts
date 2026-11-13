import { hasFreshPermission } from '../access'
/* eslint-disable @typescript-eslint/no-explicit-any */
// Where-filters and orderBy must not reach data the session cannot read.
//  - A relationship is filterable/orderable only when the session may read the related list.
//  - A field with its own read gate is filterable/orderable only when that read gate passes.
// Keystone does not apply either check on its own: counts and nested filters would otherwise leak hidden values.

type Rule = boolean | ((args: any) => any)

const verdicts = new WeakMap<object, Map<string, Promise<boolean>>>()

// User and Role let every signed-in account read its own row, so their operation access alone proves nothing.
const peopleReaders: Record<string, string[]> = {
  User: ['canManageCarriers', 'canReadUsers', 'canManageUsers'],
  Role: ['canManageCarriers', 'canReadRoles', 'canManageRoles'],
}

async function canReadList(target: any, args: any, listKey?: string): Promise<boolean> {
  const readers = listKey ? peopleReaders[listKey] : undefined
  if (readers) {
    return hasFreshPermission(args, ...(readers as any[]))
  }
  const access = target?.access
  const operationQuery = access?.operation?.query
  if (operationQuery === false) return false
  if (typeof operationQuery === 'function' && !(await operationQuery(args))) return false
  const filterQuery = access?.filter?.query
  if (typeof filterQuery === 'function') {
    if ((await filterQuery(args)) === false) return false
  }
  return filterQuery !== false
}

function memoised(args: any, key: string, compute: () => Promise<boolean>): Promise<boolean> {
  const scope = args?.context
  if (!scope || typeof scope !== 'object') return compute()
  let perContext = verdicts.get(scope)
  if (!perContext) verdicts.set(scope, (perContext = new Map()))
  let verdict = perContext.get(key)
  if (!verdict) perContext.set(key, (verdict = compute()))
  return verdict
}

function combine(existing: Rule | undefined, key: string, check: (args: any) => Promise<boolean>) {
  if (existing === false) return false
  return async (args: any) => {
    if (typeof existing === 'function' && !(await existing(args))) return false
    return memoised(args, key, () => check(args))
  }
}

export function guardFilterAccess(rawModels: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(rawModels).map(([listKey, config]: [string, any]) => {
    const fields = Object.fromEntries(Object.entries(config.fields ?? {}).map(([fieldKey, fieldFunc]: [string, any]) => {
      if (typeof fieldFunc !== 'function') return [fieldKey, fieldFunc]
      const guarded = (fieldArgs: any) => {
        const field = fieldFunc(fieldArgs)
        const checks: Array<(args: any) => Promise<boolean>> = []
        const relatedList = field.dbField?.kind === 'relation' ? rawModels[field.dbField.list] : null
        if (relatedList) checks.push(args => canReadList(relatedList, args, field.dbField.list))
        const read = field.access && typeof field.access === 'object' ? field.access.read : undefined
        if (typeof read === 'function') checks.push(async args => Boolean(await read(args)))
        else if (read === false) checks.push(async () => false)
        if (!checks.length) return field
        const check = async (args: any) => {
          for (const one of checks) if (!(await one(args))) return false
          return true
        }
        const key = `${listKey}.${fieldKey}`
        return {
          ...field,
          isFilterable: combine(field.isFilterable, `f:${key}`, check),
          isOrderable: combine(field.isOrderable, `o:${key}`, check),
        }
      }
      return [fieldKey, guarded]
    }))
    return [listKey, { ...config, fields }]
  }))
}

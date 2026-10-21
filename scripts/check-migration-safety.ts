import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { unsafeMigrationStatements } from '../features/keystone/lib/migration-safety'

// Runs between `prisma migrate dev --create-only` and applying it (see package.json migrate:gen): the newest
// generated migration must not drop retained rules or data. Edit or split it for review instead of applying.
const migrationsDir = join(process.cwd(), 'migrations')
const latest = readdirSync(migrationsDir)
  .filter(name => statSync(join(migrationsDir, name)).isDirectory())
  .sort()
  .at(-1)
if (!latest) throw new Error('No migration directory was found.')
const unsafe = unsafeMigrationStatements(readFileSync(join(migrationsDir, latest, 'migration.sql'), 'utf8'))
if (unsafe.length) {
  console.error(`Migration ${latest} would drop retained rules or data and was not applied:\n${unsafe.map(statement => `  ${statement}`).join('\n')}`)
  process.exit(1)
}
console.log(`Migration ${latest} passed the retained-rule safety check.`)

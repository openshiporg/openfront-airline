import type { Context } from '.keystone/types'

import { initialOperatorSetupEnabled } from '../lib/initial-operator-setup'

export async function shouldRedirectToInitialOperatorSetup(
  context: Pick<Context, 'sudo'>,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!initialOperatorSetupEnabled(env)) return false
  const userCount = await context.sudo().query.User.count({})
  return userCount === 0
}

async function redirectToInit(_root: unknown, _args: unknown, context: Context) {
  return shouldRedirectToInitialOperatorSetup(context)
}

export default redirectToInit
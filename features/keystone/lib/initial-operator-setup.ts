export function initialOperatorSetupEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== 'production' || env.ALLOW_INITIAL_OPERATOR_SETUP === 'true'
}

export function validateInitialOperatorInput(input: { name: string; email: string; password: string }) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 120) throw new Error('Operator name is required and must be at most 120 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid operator email address.')
  if (input.password.length < 16 || input.password.length > 1000) throw new Error('The initial operator password must contain at least 16 characters.')
  return { name, email, password: input.password }
}

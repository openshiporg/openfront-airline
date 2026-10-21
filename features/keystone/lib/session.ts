const LOCAL_TEST_SECRET = "local-test-session-secret-not-for-production";

export function resolveSessionSecret(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.SESSION_SECRET;
  if (configured) {
    if (configured.length < 32) {
      throw new Error("SESSION_SECRET must contain at least 32 characters.");
    }
    return configured;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return LOCAL_TEST_SECRET;
}

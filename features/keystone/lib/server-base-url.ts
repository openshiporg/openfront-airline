const DEFAULT_LOCAL_PORT = 3000;

function normalizedHttpOrigin(value: string, variableName: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute http(s) URL.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variableName} must contain only a trusted http(s) origin.`);
  }
  return url.origin;
}

/**
 * Origin for authenticated server-to-self calls (the AI completion and MCP
 * routes forward the caller's cookie to /api/graphql). Production uses the
 * configured APP_BASE_URL or Vercel origin; development uses the local Next
 * listener. Request Host/X-Forwarded-* headers are deliberately ignored so a
 * caller cannot redirect forwarded credentials (docs/schema-architecture.md).
 */
export function resolveServerBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env.APP_BASE_URL) {
    return normalizedHttpOrigin(env.APP_BASE_URL, "APP_BASE_URL");
  }
  if (env.VERCEL_URL) {
    return normalizedHttpOrigin(`https://${env.VERCEL_URL}`, "VERCEL_URL");
  }
  if (env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL is required for non-Vercel production runtimes.");
  }

  const rawPort = env.PORT ?? String(DEFAULT_LOCAL_PORT);
  if (!/^\d{1,5}$/.test(rawPort)) throw new Error("PORT must be a valid TCP port.");
  const port = Number(rawPort);
  if (port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");
  return `http://127.0.0.1:${port}`;
}

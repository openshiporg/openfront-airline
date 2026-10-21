const INTERNAL_ORIGIN = "https://openfront.invalid";

/**
 * Accept only an origin-relative path. Scheme-relative URLs, backslashes,
 * credentials, and absolute URLs all fall back to the dashboard.
 */
export function safeInternalRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/dashboard",
) {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

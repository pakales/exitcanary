/**
 * Reject cross-origin browser calls when Origin is present. Requests without an
 * Origin remain available to non-browser test clients and judge tooling.
 *
 * Never derive the expected origin from caller-controlled forwarded headers.
 * Deployments with a canonical public URL may pin it through
 * EXITCANARY_PUBLIC_ORIGIN; otherwise the framework-normalized request URL is
 * the comparison source.
 */
export function isSameOriginRequest(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  try {
    const requestUrl = new URL(request.url);
    const origin = new URL(originHeader);
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      return false;
    }

    const configuredOrigin = process.env.EXITCANARY_PUBLIC_ORIGIN?.trim();
    const expectedOrigin = configuredOrigin
      ? new URL(configuredOrigin)
      : new URL(requestUrl.origin);
    if (
      expectedOrigin.username ||
      expectedOrigin.password ||
      expectedOrigin.pathname !== "/" ||
      expectedOrigin.search ||
      expectedOrigin.hash
    ) {
      return false;
    }

    return origin.origin.toLowerCase() === expectedOrigin.origin.toLowerCase();
  } catch {
    return false;
  }
}

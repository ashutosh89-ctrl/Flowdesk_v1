/**
 * FlowDesk Safe HTTP URL Validator
 * 
 * Verifies that a user-supplied URL is strictly an http: or https: URL
 * with a valid hostname. Neutralizes XSS vectors including:
 * - javascript: URIs
 * - data: URIs
 * - vbscript: URIs
 * - Protocol-relative // URLs
 * - Control characters / CRLF / null-byte bypasses
 * - Browser backslash normalization bypasses
 */
export function isSafeHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject ASCII control characters, newlines, and null bytes
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;

  // Reject backslashes which some browsers normalize into slashes
  if (trimmed.includes('\\')) return false;

  // Reject protocol-relative URLs (e.g. //evil.com)
  if (trimmed.startsWith('//')) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the sanitized URL if safe, or a fallback value (default empty string).
 */
export function getSafeHttpUrl(url: unknown, fallback: string = ''): string {
  return isSafeHttpUrl(url) ? (url as string).trim() : fallback;
}

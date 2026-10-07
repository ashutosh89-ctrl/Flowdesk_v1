/**
 * Safe Redirect Utility
 *
 * Validates and sanitizes user-controlled redirect destinations to guarantee they
 * are strictly same-site relative paths. Prevents open redirect attacks, protocol-relative
 * bypasses (//evil.com), backslash tricks (/\evil.com), scheme injections (javascript:),
 * and double-encoding exploits (/%2F%2Fevil.com).
 */

export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback: string = '/auth/post-login'
): string {
  if (!next || typeof next !== 'string') {
    return fallback;
  }

  const trimmed = next.trim();
  if (!trimmed) {
    return fallback;
  }

  // 1. Disallow ASCII control characters, carriage returns, newlines, and tabs
  if (/[\x00-\x1F\x7F\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  // 2. Must start with a single '/' and NOT with '//' or '/\' or '\'
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('\\')
  ) {
    return fallback;
  }

  // 3. Must not contain backslashes anywhere in the path
  if (trimmed.includes('\\')) {
    return fallback;
  }

  // 4. Must not contain a scheme/protocol anywhere before a query/hash (e.g. 'https:', 'javascript:', 'data:')
  const pathWithoutQuery = trimmed.split(/[?#]/)[0];
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathWithoutQuery.replace(/^\/+/, ''))) {
    return fallback;
  }

  // 5. Must remain strictly safe after one round of URI decoding
  try {
    const decoded = decodeURIComponent(trimmed);

    if (/[\x00-\x1F\x7F\r\n\t]/.test(decoded)) {
      return fallback;
    }

    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.startsWith('/\\') ||
      decoded.startsWith('\\')
    ) {
      return fallback;
    }

    if (decoded.includes('\\')) {
      return fallback;
    }

    const decodedPath = decoded.split(/[?#]/)[0];
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decodedPath.replace(/^\/+/, ''))) {
      return fallback;
    }

    // Explicitly reject dangerous schemes anywhere
    if (/^(javascript|vbscript|data|file):/i.test(decoded.replace(/^[\s/]+/, ''))) {
      return fallback;
    }
  } catch {
    // Malformed URI percent-encoding
    return fallback;
  }

  return trimmed;
}

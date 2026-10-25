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

/**
 * Validates whether an image source is safe to render in <img> tags.
 * Allows:
 * - Relative internal paths starting with '/' (e.g. '/branding/flowdesk-symbol.png') without path traversal
 * - Inline image data URIs (e.g. 'data:image/png;base64,...', 'data:image/jpeg;base64,...', 'data:image/svg+xml;base64,...')
 * - Valid http: and https: URLs via isSafeHttpUrl
 */
export function isSafeImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;

  // Allow safe relative paths in the public directory (no .. traversal)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..')) {
    return true;
  }

  // Allow safe image data URIs
  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  return isSafeHttpUrl(trimmed);
}

/**
 * Razorpay Payment Link Validator
 * Verifies that the URL is strictly HTTPS and points to an approved Razorpay payment domain:
 * - rzp.io (standard short links, e.g. https://rzp.io/l/xyz or https://rzp.io/i/xyz)
 * - pages.razorpay.com (Razorpay Payment Pages)
 * - razorpay.me (Razorpay custom payment link)
 * - *.razorpay.com (e.g. payment link subdomains)
 */
export function isApprovedRazorpayUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!isSafeHttpUrl(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    const allowedExactHosts = ['rzp.io', 'razorpay.me', 'pages.razorpay.com', 'razorpay.com'];
    if (allowedExactHosts.includes(hostname)) return true;
    if (hostname.endsWith('.razorpay.com')) return true;
    if (hostname.endsWith('.rzp.io')) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the sanitized Razorpay Payment URL if approved, or a fallback value (default empty string).
 */
export function getApprovedRazorpayUrl(url: unknown, fallback: string = ''): string {
  return isApprovedRazorpayUrl(url) ? (url as string).trim() : fallback;
}

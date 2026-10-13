import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger } from '@/backend/utilities/logger';

const CSP_RATE_LIMIT = {
  maxRequests: 30,
  windowSeconds: 60,
};

/**
 * Strips query parameters, auth tokens, and sensitive fragments from reported URIs
 */
function sanitizeReportUri(uri?: string): string {
  if (!uri || typeof uri !== 'string') return 'unknown';
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // If not a full URL (e.g. 'inline', 'eval', or relative), strip query chars
    return uri.split('?')[0].split('#')[0].slice(0, 150);
  }
}

/**
 * CSP Telemetry Endpoint
 * Receives browser Content-Security-Policy violation reports.
 * Rate-limited and sanitized to protect against PII ingestion.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // 1. Rate limiting: max 30 reports per minute per IP
  const rateLimit = await checkRateLimit(`csp:${clientIp}`, CSP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  // 2. Tiny body limit pre-check (10 KB max)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024) {
    return new NextResponse(null, { status: 400 });
  }

  const rawBody = await request.text().catch(() => '');
  if (new TextEncoder().encode(rawBody).length > 10 * 1024) {
    return new NextResponse(null, { status: 400 });
  }

  // 3. Parse and extract telemetry without logging PII
  try {
    const data = JSON.parse(rawBody);
    const report = data['csp-report'] || data;

    const violatedDirective = report['violated-directive'] || report['effective-directive'] || 'unknown';
    const blockedUri = sanitizeReportUri(report['blocked-uri'] || report['blockedURI']);
    const documentUri = sanitizeReportUri(report['document-uri'] || report['documentURI']);

    logger.warn('CSP Violation Reported', {
      violatedDirective: String(violatedDirective).slice(0, 100),
      blockedUri,
      documentUri,
      disposition: report.disposition || 'report',
    });
  } catch {
    // Malformed JSON telemetry safely ignored
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

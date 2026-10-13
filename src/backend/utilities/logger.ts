import { NextResponse } from 'next/server';

/**
 * FlowDesk Structured Logger & Security Audit Logger
 * 
 * Enforces production-grade logging standards:
 * - Structured JSON output for centralized log ingestion
 * - Automated sensitive field masking (passwords, tokens, API keys, card numbers, emails, phones)
 * - Circular reference neutralization via WeakSet tracking
 * - Bounded depth and payload truncation
 * - Security event tagging for audit trails
 * - Safe API error generation with correlation IDs (X-Request-Id)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

export interface LogContext {
  traceId?: string | null;
  requestId?: string | null;
  userId?: string | null;
  clientId?: string | null;
  workspaceId?: string | null;
  ip?: string | null;
  action?: string | null;
  [key: string]: any;
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /cookies/i,
  /signature/i,
  /apikey/i,
  /api_key/i,
  /key_secret/i,
  /card/i,
  /cvv/i,
  /pan/i,
  /account_?number/i,
];

/**
 * Masks an email to safe presentation (e.g., alex@example.com -> a***@example.com)
 */
export function maskEmail(email: unknown): string {
  if (typeof email !== 'string') return '[REDACTED]';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '[REDACTED]';
  const user = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const maskedUser = user.length <= 1 ? `${user}***` : `${user[0]}***`;
  return `${maskedUser}${domain}`;
}

/**
 * Masks a phone number to safe presentation
 */
export function maskPhone(phone: unknown): string {
  if (typeof phone !== 'string') return '[REDACTED]';
  const trimmed = phone.trim();
  if (trimmed.length < 4) return '[REDACTED]';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

/**
 * Recursively redacts sensitive keys and values from objects before logging.
 * Neutralizes circular references, caps recursion depth, and truncates oversize payloads.
 */
export function sanitizeLogData(
  data: any,
  depth = 0,
  seen: WeakSet<object> = new WeakSet()
): any {
  if (depth > 6) return '[Truncated: Max Depth]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Mask email-like strings
    if (data.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return maskEmail(data);
    }
    // Mask potential bearer tokens or long hex/base64/jwt secrets
    if (data.length > 50 && (data.startsWith('eyJ') || data.startsWith('Bearer ') || data.startsWith('whsec_') || data.startsWith('rzp_'))) {
      return `${data.substring(0, 10)}...[REDACTED]`;
    }
    // Truncate overly long strings
    if (data.length > 2000) {
      return `${data.slice(0, 500)}...[Truncated: ${data.length} chars]`;
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Circular reference detection
  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  if (Array.isArray(data)) {
    if (data.length > 50) {
      const truncatedSlice = data.slice(0, 50).map((item) => sanitizeLogData(item, depth + 1, seen));
      return [...truncatedSlice, `[Truncated: ${data.length - 50} more items]`];
    }
    return data.map((item) => sanitizeLogData(item, depth + 1, seen));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check email fields
    if (lowerKey === 'email' || lowerKey.endsWith('_email')) {
      sanitized[key] = maskEmail(value);
      continue;
    }

    // Check phone fields
    if (lowerKey === 'phone' || lowerKey.endsWith('_phone')) {
      sanitized[key] = maskPhone(value);
      continue;
    }

    // Check known sensitive key patterns
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(lowerKey));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1, seen);
    }
  }

  return sanitized;
}

class FlowdeskLogger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: any): string {
    const payload = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      context: context ? sanitizeLogData(context) : undefined,
      error: error ? sanitizeLogData(error) : undefined,
      env: process.env.NODE_ENV || 'development',
    };

    return JSON.stringify(payload);
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    console.info(this.formatLog('info', message, context));
  }

  public warn(message: string, context?: LogContext, error?: any): void {
    console.warn(this.formatLog('warn', message, context, error));
  }

  public error(message: string, error?: any, context?: LogContext): void {
    console.error(this.formatLog('error', message, context, error));
  }

  /**
   * Dedicated security audit trail event
   */
  public security(
    event: string,
    context: LogContext & { status: 'SUCCESS' | 'FAILURE' | 'BLOCKED'; reason?: string }
  ): void {
    console.warn(this.formatLog('security', `[SECURITY AUDIT] ${event}`, context));
  }
}

export const logger = new FlowdeskLogger();

/**
 * Resolves or creates an authoritative correlation request ID (UUID)
 */
export function getOrCreateRequestId(request?: Request | { headers: Headers }): string {
  if (request) {
    const existing = request.headers.get('x-request-id');
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
  }
  return crypto.randomUUID();
}

/**
 * Creates a production-safe API error response that prevents information leakage
 * (raw error messages, database/table names, SQL queries, or stack traces) while
 * logging details server-side with a correlation requestId.
 */
export function createApiErrorResponse({
  message = 'Internal server error',
  code = 'INTERNAL_ERROR',
  status = 500,
  internalError,
  requestId,
}: {
  message?: string;
  code?: string;
  status?: number;
  internalError?: unknown;
  requestId?: string;
}): NextResponse {
  const reqId = requestId || crypto.randomUUID();

  // Log internal error server-side with full diagnostic info
  if (internalError) {
    logger.error(`[API Error ${reqId}] ${message}`, internalError, {
      requestId: reqId,
      code,
      status,
    });
  }

  // In production, never return raw internal message if status is 500
  const isProd = process.env.NODE_ENV === 'production';
  const clientMessage = isProd && status >= 500 ? 'An unexpected error occurred. Please try again later.' : message;

  const response = NextResponse.json(
    {
      success: false,
      error: clientMessage,
      code,
      requestId: reqId,
    },
    { status }
  );

  response.headers.set('X-Request-Id', reqId);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

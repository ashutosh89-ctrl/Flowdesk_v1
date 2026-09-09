/**
 * FlowDesk Structured Logger & Security Audit Logger
 * 
 * Enforces production-grade logging standards:
 * - Structured JSON output for centralized log ingestion
 * - Automated sensitive field masking (passwords, tokens, API keys, card numbers)
 * - Security event tagging for audit trails
 * - Contextual correlation tracking (traceId, userId, workspaceId, ip)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

export interface LogContext {
  traceId?: string | null;
  userId?: string | null;
  clientId?: string | null;
  workspaceId?: string | null;
  ip?: string | null;
  action?: string | null;
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'bearer',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'key_secret',
  'razorpay_key_secret',
  'resend_api_key',
  'brevo_api_key',
  'cardnumber',
  'cvv',
  'pan',
  'cookie',
  'cookies',
]);

/**
 * Recursively redacts sensitive keys and values from objects before logging
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6) return '[Truncated: Max Depth]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Mask potential bearer tokens or long hex/base64 secrets
    if (data.length > 60 && (data.startsWith('eyJ') || data.startsWith('Bearer '))) {
      return `${data.substring(0, 10)}...[REDACTED]`;
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
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
  public security(event: string, context: LogContext & { status: 'SUCCESS' | 'FAILURE' | 'BLOCKED'; reason?: string }): void {
    console.warn(this.formatLog('security', `[SECURITY AUDIT] ${event}`, context));
  }
}

export const logger = new FlowdeskLogger();

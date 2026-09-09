/**
 * FlowDesk Distributed Rate Limiter
 * 
 * Provides sliding-window rate limiting for security-critical endpoints:
 * - Auth (login, signup, password reset)
 * - Invitation claims
 * - Payment orders & verification
 * - Transactional email dispatch
 * - File uploads
 */

export interface RateLimitConfig {
  /** Maximum allowed requests within the time window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Optional custom identifier prefix */
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

interface RequestRecord {
  timestamps: number[];
}

// In-memory sliding window bucket store with automatic cleanup
const buckets = new Map<string, RequestRecord>();

// Periodic garbage collection for stale buckets (every 5 minutes)
let lastCleanup = Date.now();
function cleanupStaleBuckets() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;

  for (const [key, record] of buckets.entries()) {
    // Retain only timestamps from the last 15 minutes
    record.timestamps = record.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
    if (record.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

/**
 * Checks and updates rate limit for a given key in a sliding window.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  cleanupStaleBuckets();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const fullKey = config.prefix ? `${config.prefix}:${key}` : key;

  let record = buckets.get(fullKey);
  if (!record) {
    record = { timestamps: [] };
    buckets.set(fullKey, record);
  }

  // Filter timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= config.maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterMs = Math.max(1000, oldest + windowMs - now);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetSeconds: retryAfterSec,
      retryAfterSeconds: retryAfterSec,
    };
  }

  // Record this request timestamp
  record.timestamps.push(now);

  const remaining = Math.max(0, config.maxRequests - record.timestamps.length);
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining,
    resetSeconds: config.windowSeconds,
    retryAfterSeconds: 0,
  };
}

/**
 * Extracts client IP from NextRequest with header fallback
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();
  return '127.0.0.1';
}

/**
 * Standard Presets for FlowDesk Endpoints
 */
export const RATE_LIMIT_PRESETS = {
  /** Authentication: 10 attempts per minute per IP/account */
  AUTH: { maxRequests: 10, windowSeconds: 60, prefix: 'auth' },
  /** Invitation Claim: 15 attempts per minute per IP */
  INVITATION_CLAIM: { maxRequests: 15, windowSeconds: 60, prefix: 'inv_claim' },
  /** Payment Order Creation: 20 per minute per user */
  PAYMENT_ORDER: { maxRequests: 20, windowSeconds: 60, prefix: 'pay_order' },
  /** Payment Verification: 30 per minute per IP/order */
  PAYMENT_VERIFY: { maxRequests: 30, windowSeconds: 60, prefix: 'pay_verify' },
  /** Email Dispatch: 30 per minute per workspace */
  EMAIL_DISPATCH: { maxRequests: 30, windowSeconds: 60, prefix: 'email' },
  /** File Uploads: 25 per minute per workspace */
  UPLOADS: { maxRequests: 25, windowSeconds: 60, prefix: 'upload' },
};

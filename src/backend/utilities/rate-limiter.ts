/**
 * FlowDesk Distributed Rate Limiter (SEC-MED-02)
 * 
 * Provides distributed rate limiting across serverless instances using Upstash Redis,
 * with fail-closed protection for sensitive operations and automatic fallback to an
 * in-memory sliding window limiter when Redis is unconfigured or degraded.
 * 
 * Endpoints Protected:
 * - Auth (login, signup, password reset)
 * - Invitation claims & public token lookup
 * - Payment order creation & verification
 * - Transactional email dispatch
 * - File uploads
 */

import { Redis } from '@upstash/redis';

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

/**
 * Interface for Redis-compatible clients (facilitates test injection).
 */
export interface RedisLikeClient {
  pipeline(): RedisPipelineLike;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export interface RedisPipelineLike {
  incr(key: string): RedisPipelineLike;
  ttl(key: string): RedisPipelineLike;
  expire(key: string, seconds: number): RedisPipelineLike;
  exec<T extends unknown[]>(): Promise<T>;
}

/**
 * Configurable failure policy for Redis communication errors at runtime:
 * - true  = FAIL CLOSED (block request with HTTP 429) to protect high-risk financial/authorization boundaries
 * - false = FAIL OPEN (fall back to local in-memory rate limiter) to maintain user availability
 * 
 * Trade-off:
 * - Invitation Claim & Payments: default FAIL CLOSED to eliminate brute-force and financial abuse during outages.
 * - Auth, Email, Uploads: default FAIL OPEN to local in-memory so legitimate users can log in and work.
 */
export const FAIL_CLOSED_ON_REDIS_ERROR: Readonly<Record<string, boolean>> = {
  auth: false,          // Fail open to local in-memory to prevent complete login outage
  inv_claim: true,      // FAIL CLOSED: anti-bruteforce / IDOR takeover protection
  pay_order: true,      // FAIL CLOSED: financial order manipulation protection
  pay_verify: true,     // FAIL CLOSED: financial replay protection
  email: false,         // Fail open to local in-memory for critical notifications
  upload: false,        // Fail open to local in-memory
};

interface RequestRecord {
  timestamps: number[];
}

// In-memory fallback sliding window bucket store
const memoryBuckets = new Map<string, RequestRecord>();

// Periodic in-memory garbage collection
let lastCleanup = Date.now();
function cleanupStaleBuckets() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;

  for (const [key, record] of memoryBuckets.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
    if (record.timestamps.length === 0) {
      memoryBuckets.delete(key);
    }
  }
}

// Global Redis client singleton
let redisClient: RedisLikeClient | null = null;
let redisInitialized = false;
let loggedMissingRedisWarning = false;
let lastErrorLogTimestamp = 0;

function getRedisClient(): RedisLikeClient | null {
  if (redisInitialized) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token && !url.includes('your-upstash') && !token.includes('your-upstash')) {
    try {
      redisClient = new Redis({ url, token });
    } catch (err) {
      console.error('[RateLimiter] Failed to initialize Upstash Redis client:', err);
      redisClient = null;
    }
  } else {
    const isProduction =
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_AUTH_MODE !== 'demo';

    if (isProduction && !loggedMissingRedisWarning) {
      loggedMissingRedisWarning = true;
      console.error(
        '╔═══════════════════════════════════════════════════════════════════════════════╗\n' +
        '║ [RateLimiter] CRITICAL PRODUCTION CONFIGURATION WARNING:                      ║\n' +
        '║ UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are missing in production.║\n' +
        '║ Falling back to local per-process in-memory rate limiting. Limits will NOT    ║\n' +
        '║ be shared across serverless instances.                                        ║\n' +
        '╚═══════════════════════════════════════════════════════════════════════════════╝'
      );
    }
  }

  redisInitialized = true;
  return redisClient;
}

/**
 * In-memory sliding window fallback execution.
 */
function checkInMemoryLimit(fullKey: string, config: RateLimitConfig): RateLimitResult {
  cleanupStaleBuckets();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let record = memoryBuckets.get(fullKey);
  if (!record) {
    record = { timestamps: [] };
    memoryBuckets.set(fullKey, record);
  }

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
 * Distributed rate limiter using Upstash Redis atomic pipeline with automatic fallback.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  injectedClient?: RedisLikeClient | null
): Promise<RateLimitResult> {
  const prefix = config.prefix || 'default';
  const fullKey = config.prefix ? `${config.prefix}:${key}` : key;
  const client = injectedClient !== undefined ? injectedClient : getRedisClient();

  if (client) {
    try {
      const windowIndex = Math.floor(Date.now() / (config.windowSeconds * 1000));
      const redisKey = `flowdesk:rl:${prefix}:${key}:${windowIndex}`;

      const pipeline = client.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);

      const results = await pipeline.exec<[number, number]>();
      const count = Number(results[0]);
      let ttl = Number(results[1]);

      // If key is new or missing TTL, set expiration
      if (count === 1 || ttl < 0) {
        await client.expire(redisKey, config.windowSeconds * 2);
        ttl = config.windowSeconds;
      }

      if (count > config.maxRequests) {
        const retryAfter = Math.max(1, ttl > 0 ? ttl : config.windowSeconds);
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetSeconds: retryAfter,
          retryAfterSeconds: retryAfter,
        };
      }

      const remaining = Math.max(0, config.maxRequests - count);
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining,
        resetSeconds: Math.max(1, ttl > 0 ? ttl : config.windowSeconds),
        retryAfterSeconds: 0,
      };
    } catch (err: any) {
      // Rate-limited warning log (log once per 60s to prevent spam)
      const now = Date.now();
      if (now - lastErrorLogTimestamp > 60_000) {
        lastErrorLogTimestamp = now;
        console.warn(`[RateLimiter] Upstash Redis runtime error: ${err?.message || err}. Evaluating fallback policy.`);
      }

      // Check configurable fail-closed policy
      const shouldFailClosed = Boolean(FAIL_CLOSED_ON_REDIS_ERROR[prefix]);
      if (shouldFailClosed) {
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetSeconds: config.windowSeconds,
          retryAfterSeconds: config.windowSeconds,
        };
      }

      // Fall back to in-memory rate limiting
      return checkInMemoryLimit(fullKey, config);
    }
  }

  // Redis not configured — execute in-memory limiter
  return checkInMemoryLimit(fullKey, config);
}

/**
 * Resolves the client IP address from request headers.
 * 
 * SECURITY MODEL & HOSTING ASSUMPTIONS:
 * 1. Platform-injected headers (Vercel, Cloudflare, trusted fronting proxies):
 *    - 'x-vercel-forwarded-for': Verified by Vercel Edge; immune to client tampering.
 *    - 'cf-connecting-ip': Verified by Cloudflare; immune to client tampering.
 *    - 'x-real-ip': Injected by trusted fronting Nginx/Cloud Run proxy.
 * 
 * 2. Untrusted-Proxy Safe 'x-forwarded-for':
 *    - RFC 7239 / standard reverse-proxy chain: Client headers are passed along and the
 *      nearest trusted reverse proxy appends the client TCP socket IP at the END of the list.
 *    - Blindly taking the first IP allows an attacker to send `X-Forwarded-For: 1.2.3.4`
 *      and spoof their identity.
 *    - We therefore select the LAST (rightmost) entry in the forwarded chain.
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const headers = request.headers;

  // 1. Platform-specific trusted edge headers
  const vercelIp = headers.get('x-vercel-forwarded-for');
  if (vercelIp?.trim()) {
    const parts = vercelIp.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp?.trim()) return cfIp.trim();

  const realIp = headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  // 2. Standard X-Forwarded-For: select rightmost IP to resist leftmost client spoofing
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  return '127.0.0.1';
}

/**
 * Constructs a composite rate limit key for authenticated routes.
 * Combining IP and user/client ID prevents:
 * (a) legitimate users being locked out by a shared IP (NAT/office network)
 * (b) attackers evading per-user limits by rotating IP addresses
 */
export function buildRateLimitKey(prefix: string, ip: string, identifier?: string | null): string {
  if (identifier?.trim()) {
    return `${prefix}:${ip}:${identifier.trim()}`;
  }
  return `${prefix}:${ip}`;
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

// ---------------------------------------------------------------------------
// Testing Hooks & Factory Functions
// ---------------------------------------------------------------------------

/**
 * Overrides or resets the shared Redis client for testing.
 */
export function setRedisClientForTesting(client: RedisLikeClient | null): void {
  redisClient = client;
  redisInitialized = true;
}

/**
 * Clears in-memory buckets for test isolation.
 */
export function resetLimiterStateForTesting(): void {
  memoryBuckets.clear();
  redisClient = null;
  redisInitialized = false;
  loggedMissingRedisWarning = false;
  lastErrorLogTimestamp = 0;
}

/**
 * Factory creating an isolated RateLimiter instance sharing a specific client.
 */
export function createRateLimiterInstance(client?: RedisLikeClient | null) {
  return {
    async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
      return checkRateLimit(key, config, client);
    },
  };
}

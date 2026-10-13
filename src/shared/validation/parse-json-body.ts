import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export interface ParseJsonBodyOptions {
  maxBytes?: number;
}

export type ParseJsonBodyResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

const DEFAULT_MAX_BYTES = 100 * 1024; // 100 KB

/**
 * Parses and strictly validates a JSON request body against a Zod schema.
 * Enforces size limits, rejects malformed JSON, and prevents data reflection
 * or internal schema leaks in error responses.
 */
export async function parseJsonBody<T>(
  request: NextRequest | Request,
  schema: z.ZodType<T>,
  options?: ParseJsonBodyOptions
): Promise<ParseJsonBodyResult<T>> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  // 1. Content-Length header pre-check
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > maxBytes) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Payload exceeds maximum size limit.', code: 'PAYLOAD_TOO_LARGE' },
          { status: 400 }
        ),
      };
    }
  }

  // 2. Read raw body as text with size verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Failed to read request payload.', code: 'PAYLOAD_READ_ERROR' },
        { status: 400 }
      ),
    };
  }

  const byteLength = new TextEncoder().encode(rawBody).length;
  if (byteLength > maxBytes) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Payload exceeds maximum size limit.', code: 'PAYLOAD_TOO_LARGE' },
        { status: 400 }
      ),
    };
  }

  if (!rawBody || rawBody.trim().length === 0) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Missing required request body.', code: 'MISSING_PAYLOAD' },
        { status: 400 }
      ),
    };
  }

  // 3. JSON parse
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON payload.', code: 'INVALID_JSON' },
        { status: 400 }
      ),
    };
  }

  // 4. Schema validation
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid request payload format.', code: 'INVALID_PAYLOAD' },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validates a route parameter against a Zod schema.
 * Rejects invalid formats without echoing inputs.
 */
export function validateRouteParam<T>(
  paramValue: unknown,
  schema: z.ZodType<T>,
  paramName = 'parameter'
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(paramValue);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: `Invalid ${paramName} format.`, code: 'INVALID_PARAM' },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

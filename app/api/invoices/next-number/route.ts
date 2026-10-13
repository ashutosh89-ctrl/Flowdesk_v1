import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { formatInvoiceNumber } from '@/shared/rules';

/**
 * Sequential Invoice Number Suggestion Route Handler (Batch 1: Money & Invoices)
 *
 * Computes the next collision-free sequential invoice number scoped to the caller's workspace.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'invoice_next_number',
    maxRequests: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to retrieve invoice numbering.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Demo Mode Handler
  if (isDemoModeActive()) {
    const year = new Date().getFullYear();
    return NextResponse.json(
      {
        success: true,
        nextInvoiceNumber: `INV-${year}-0004`,
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    // 4. Resolve caller's workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found for caller.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 5. Query user settings and existing numbers
    const [settingsRes, invoicesRes] = await Promise.all([
      supabaseAdmin.from('user_settings').select('*').eq('id', caller.userId).maybeSingle(),
      supabaseAdmin.from('invoices').select('invoice_number').eq('workspace_id', workspace.id),
    ]);

    const settings = settingsRes.data || {};
    const existingNumbers = (invoicesRes.data || []).map((i) => i.invoice_number);

    const prefix = settings.invoice_prefix || 'INV';
    const sep = settings.invoice_separator || '-';
    const includeYear = settings.invoice_include_year !== false;
    const padding = settings.invoice_padding ? Number(settings.invoice_padding) : 4;
    const year = new Date().getFullYear();

    // Match prefix pattern
    const parts: string[] = [];
    if (prefix) parts.push(prefix);
    if (includeYear) parts.push(String(year));
    const matchPrefix = parts.length > 0 ? `${parts.join(sep)}${sep}` : '';

    let maxSeq = 0;
    for (const num of existingNumbers) {
      if (!num) continue;
      if (matchPrefix && num.startsWith(matchPrefix)) {
        const remainder = num.slice(matchPrefix.length);
        const parsed = parseInt(remainder, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      } else if (!matchPrefix) {
        const parsed = parseInt(num, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }

    const startingSeq = Math.max(1, settings.invoice_next_sequence || 1);
    const nextSeq = Math.max(startingSeq, maxSeq + 1);

    const nextInvoiceNumber = formatInvoiceNumber(
      { prefix, separator: sep, includeYear, padding },
      nextSeq,
      year
    );

    return NextResponse.json(
      {
        success: true,
        nextInvoiceNumber,
        sequence: nextSeq,
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Failed to generate next invoice number', err, { requestId });
    return createApiErrorResponse({
      message: 'Failed to generate invoice number.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

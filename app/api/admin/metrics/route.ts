import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'admin_metrics',
    maxRequests: 30,
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

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required for operational metrics.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // Demo mode returns simulated production monitoring data
  if (isDemoModeActive() || caller.isDemo) {
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      systemStatus: 'healthy',
      metrics: {
        totalWorkspaces: 124,
        activeClients: 382,
        activeProjects: 418,
        invoicesThisMonth: 189,
        grossVolumeInvoicedInr: 1_842_000,
        subscriptionBreakdown: {
          free: 82,
          standard: 34,
          studio: 8,
        },
        storageArchitecture: 'hybrid_local_direct',
        storageQuotaEnforced: false,
      },
      services: {
        database: 'operational',
        authentication: 'operational',
        razorpayBilling: 'operational',
        emailDelivery: 'operational',
      },
      requestId,
    });
  }

  try {
    // Verify admin privileges strictly (VULN-08 prevention)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', caller.userId)
      .maybeSingle();

    const adminEmails = (process.env.ADMIN_EMAILS || 'flowdesk11@gmail.com').split(',').map((e) => e.trim().toLowerCase());
    const isAuthorizedAdmin = (profile?.role === 'admin') || (caller.userEmail && adminEmails.includes(caller.userEmail.toLowerCase()));

    if (!isAuthorizedAdmin) {
      return createApiErrorResponse({
        message: 'Admin authorization required.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const [workspacesCount, clientsCount, projectsCount, invoicesCount, subs] = await Promise.all([
      supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('clients').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('plan_key, status'),
    ]);

    const subCounts: Record<string, number> = { free: 0, standard: 0, studio: 0 };
    (subs.data || []).forEach((s: any) => {
      const key = s.plan_key === 'pro' ? 'standard' : s.plan_key || 'free';
      subCounts[key] = (subCounts[key] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      systemStatus: 'healthy',
      metrics: {
        totalWorkspaces: workspacesCount.count || 0,
        activeClients: clientsCount.count || 0,
        activeProjects: projectsCount.count || 0,
        totalInvoices: invoicesCount.count || 0,
        subscriptionBreakdown: subCounts,
        storageArchitecture: 'hybrid_local_direct',
        storageQuotaEnforced: false,
      },
      services: {
        database: 'operational',
        authentication: 'operational',
        razorpayBilling: 'operational',
        emailDelivery: 'operational',
      },
      requestId,
    });
  } catch (err: any) {
    logger.error('Failed to compute admin metrics', err, { requestId });
    return createApiErrorResponse({
      message: 'Failed to retrieve administrative metrics.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}


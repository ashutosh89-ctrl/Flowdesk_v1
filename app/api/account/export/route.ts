import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting (Strict: 2 exports per 60 seconds)
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_export',
    maxRequests: 2,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many data export requests. Please wait a moment before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller || (!caller.userId && !caller.isDemo)) {
    return createApiErrorResponse({
      message: 'Authentication required to export account data.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Demo Mode Fallback
  if (isDemoModeActive() || caller.isDemo) {
    const demoExport = {
      exportVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      accountType: 'freelancer',
      notice: 'Demo mode export containing sample workspace data.',
      profile: {
        name: 'Demo Freelancer',
        email: 'demo@flowdesk.app',
      },
      workspaces: [
        {
          id: 'demo-ws-001',
          name: 'Demo Creative Studio',
        },
      ],
      clients: [
        { id: 'cli-demo-1', name: 'Acme Corp', company: 'Acme Inc', email: 'billing@acme.com' },
      ],
      projects: [
        { id: 'proj-demo-1', title: 'Brand Identity', status: 'in_progress' },
      ],
      invoices: [],
    };

    return new NextResponse(JSON.stringify(demoExport, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="flowdesk-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    });
  }

  // 4. Production Scoped Query
  try {
    const userId = caller.userId!;

    // Fetch Profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, company_name, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    // Fetch Workspace owned by user
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, slug, status, created_at')
      .eq('owner_id', userId)
      .maybeSingle();

    const wsId = workspace?.id;

    let clients: any[] = [];
    let projects: any[] = [];
    let deliverables: any[] = [];
    let documents: any[] = [];
    let invoices: any[] = [];

    if (wsId) {
      const [cliRes, projRes, delRes, docRes, invRes] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('id, name, company, email, currency, status, created_at')
          .eq('workspace_id', wsId),
        supabaseAdmin
          .from('projects')
          .select('id, client_id, title, description, status, budget, currency, start_date, due_date, created_at')
          .eq('workspace_id', wsId),
        supabaseAdmin
          .from('deliverables')
          .select('id, project_id, title, niche, status, created_at')
          .eq('workspace_id', wsId),
        supabaseAdmin
          .from('documents')
          .select('id, client_id, name, size_bytes, mime_type, created_at')
          .eq('workspace_id', wsId),
        supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, client_id, status, payment_status, total, currency, issue_date, due_date, created_at')
          .eq('workspace_id', wsId),
      ]);

      clients = cliRes.data || [];
      projects = projRes.data || [];
      deliverables = delRes.data || [];
      documents = docRes.data || [];
      invoices = invRes.data || [];
    }

    const exportPayload = {
      exportVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      accountType: 'freelancer',
      dataSubject: {
        userId,
        email: profile?.email || null,
        name: profile?.full_name || null,
        company: profile?.company_name || null,
      },
      workspace: workspace || null,
      records: {
        clientsCount: clients.length,
        clients,
        projectsCount: projects.length,
        projects,
        deliverablesCount: deliverables.length,
        deliverables,
        documentsCount: documents.length,
        documents,
        invoicesCount: invoices.length,
        invoices,
      },
    };

    logger.security('ACCOUNT_DATA_EXPORT_GENERATED', {
      status: 'SUCCESS',
      userId,
      workspaceId: wsId,
      requestId,
    });

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="flowdesk-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    logger.error('ACCOUNT_DATA_EXPORT_FAILED', {
      error: err?.message,
      requestId,
      userId: caller.userId,
    });

    return createApiErrorResponse({
      message: 'Failed to generate account data export.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}


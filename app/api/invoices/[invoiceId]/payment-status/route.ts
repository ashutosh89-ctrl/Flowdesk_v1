import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { supabase } from '@/backend/utilities/supabase';
import { logger, createApiErrorResponse } from '@/backend/utilities/logger';
import { validateRouteParam, uuidSchema } from '@/shared/validation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  try {
    // 1. Authentication required — this endpoint returns financial data.
    const caller = await requireApiCaller();
    if (!caller) {
      return NextResponse.json(
        { error: 'Authentication required.', code: 'UNAUTHORIZED' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { invoiceId } = await context.params;
    const paramValidation = validateRouteParam(invoiceId, uuidSchema, 'invoiceId');
    if (!paramValidation.success) {
      return paramValidation.response;
    }
    const cleanInvoiceId = paramValidation.data;

    // 2. Authorization:
    //    - A client may only query invoices that belong to them.
    //    - A freelancer may only query invoices inside their own workspace.
    if (!caller.isDemo) {
      if (caller.clientId) {
        // Client identity: verify the invoice belongs to this client.
        const { data: invoice } = await supabase
          .from('invoices')
          .select('client_id')
          .eq('id', cleanInvoiceId)
          .maybeSingle();
        if (!invoice || invoice.client_id !== caller.clientId) {
          return NextResponse.json(
            { error: 'Invoice not found or access unauthorized', code: 'NOT_FOUND' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } else if (caller.workspaceId) {
        // Freelancer identity: verify the invoice belongs to this workspace.
        const { data: invoice } = await supabase
          .from('invoices')
          .select('workspace_id')
          .eq('id', cleanInvoiceId)
          .maybeSingle();
        if (!invoice || invoice.workspace_id !== caller.workspaceId) {
          return NextResponse.json(
            { error: 'Invoice not found or access unauthorized', code: 'NOT_FOUND' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } else {
        // Neither a client nor a workspace owner: no access.
        return NextResponse.json(
          { error: 'Invoice not found or access unauthorized', code: 'NOT_FOUND' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // 3. Return authorized payment information.
    const status = await PaymentService.getInvoicePaymentStatus(cleanInvoiceId, caller.clientId || undefined);
    if (!status) {
      return NextResponse.json(
        { error: 'Invoice not found or access unauthorized', code: 'NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const response = NextResponse.json(status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: any) {
    logger.error('[API /api/invoices/[invoiceId]/payment-status] Error', error);
    return createApiErrorResponse({
      message: 'Failed to retrieve invoice payment status.',
      code: 'PAYMENT_STATUS_ERROR',
      status: 500,
      internalError: error,
    });
  }
}
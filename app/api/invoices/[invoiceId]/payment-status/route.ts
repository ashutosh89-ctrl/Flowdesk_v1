import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/backend/payments';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { supabase } from '@/backend/utilities/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  try {
    // 1. Authentication required — this endpoint returns financial data.
    const caller = await requireApiCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    // 2. Authorization:
    //    - A client may only query invoices that belong to them.
    //    - A freelancer may only query invoices inside their own workspace.
    if (!caller.isDemo) {
      if (caller.clientId) {
        // Client identity: verify the invoice belongs to this client.
        const { data: invoice } = await supabase
          .from('invoices')
          .select('client_id')
          .eq('id', invoiceId)
          .maybeSingle();
        if (!invoice || invoice.client_id !== caller.clientId) {
          return NextResponse.json({ error: 'Invoice not found or access unauthorized' }, { status: 404 });
        }
      } else if (caller.workspaceId) {
        // Freelancer identity: verify the invoice belongs to this workspace.
        const { data: invoice } = await supabase
          .from('invoices')
          .select('workspace_id')
          .eq('id', invoiceId)
          .maybeSingle();
        if (!invoice || invoice.workspace_id !== caller.workspaceId) {
          return NextResponse.json({ error: 'Invoice not found or access unauthorized' }, { status: 404 });
        }
      } else {
        // Neither a client nor a workspace owner: no access.
        return NextResponse.json({ error: 'Invoice not found or access unauthorized' }, { status: 404 });
      }
    }

    // 3. Return authorized payment information.
    const status = await PaymentService.getInvoicePaymentStatus(invoiceId, caller.clientId || undefined);
    if (!status) {
      return NextResponse.json({ error: 'Invoice not found or access unauthorized' }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[API /api/invoices/[invoiceId]/payment-status] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
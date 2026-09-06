import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { Invoice } from '@/shared/types';
import { derivePaymentStatus, calculateRemainingBalance } from '@/shared/utils/invoice-calculations';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { FlowDeskStore } from '@/backend/store/storage-store';

export const ClientInvoiceService = {
  /**
   * Retrieves invoices strictly scoped to the authenticated client
   */
  getInvoices: async (clientId: string): Promise<Invoice[]> => {
    if (!clientId) return [];
    
    // Explicit demo mode: return mock data
    if (isDemoModeActive() || DemoDataProvider.isDemo()) {
      return FlowDeskStore.getInvoices(clientId);
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*), invoice_payments(*), receipts(*)')
        .eq('client_id', clientId)
        .order('issue_date', { ascending: false });

      if (error) {
        console.error('[ClientInvoiceService] Database error fetching invoices:', error);
        return [];
      }

      if (data && data.length > 0) {
        return data.map((i) => {
          const paidAmt = Number(i.paid_amount) || 0;
          const totalAmt = Number(i.total_amount) || 0;
          const paymentStatus = derivePaymentStatus(totalAmt, paidAmt);

          const persistedReceipts = (i.receipts || []).map((r: any) => ({
            id: r.id,
            receiptNumber: r.receipt_number,
            invoiceId: r.invoice_id,
            invoiceNumber: i.invoice_number,
            amount: Number(r.amount) || 0,
            currency: r.currency || i.currency || 'USD',
            paymentDate: r.payment_date || r.created_at || new Date().toISOString(),
            paymentMethod: r.payment_method || 'razorpay',
            clientName: i.client_name,
            notes: r.notes,
            razorpayPaymentId: r.razorpay_payment_id,
            razorpayOrderId: r.razorpay_order_id,
            gateway: 'razorpay',
            gatewayStatus: 'completed',
          }));

          const receipts = persistedReceipts.length > 0
            ? persistedReceipts
            : (i.invoice_payments || []).map((p: any) => ({
                id: p.id,
                receiptNumber: `RCP-${i.invoice_number || 'INV'}-${(p.id || '').slice(0, 4)}`,
                invoiceId: p.invoice_id,
                invoiceNumber: i.invoice_number,
                amount: Number(p.amount) || 0,
                currency: p.currency || i.currency || 'USD',
                paymentDate: p.payment_date || p.created_at || new Date().toISOString(),
                paymentMethod: p.payment_method || 'bank_transfer',
                clientName: i.client_name,
                notes: p.notes,
                razorpayPaymentId: p.razorpay_payment_id,
                razorpayOrderId: p.razorpay_order_id,
                gateway: p.gateway || 'manual',
                gatewayStatus: p.gateway_status || 'completed',
              }));

          return {
            id: i.id,
            invoiceNumber: i.invoice_number,
            clientId: i.client_id,
            clientName: i.client_name || '',
            clientEmail: i.client_email || '',
            projectId: i.project_id || undefined,
            projectName: i.project_name || undefined,
            issueDate: i.issue_date,
            dueDate: i.due_date,
            workflowStatus: (i.status as any) || 'sent',
            paymentStatus,
            status: i.status || 'sent',
            items: (i.invoice_items || []).map((item: any) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity) || 1,
              rate: Number(item.unit_price) || 0,
              amount: Number(item.amount) || 0,
            })),
            subtotal: Number(i.subtotal) || 0,
            discount: Number(i.discount) || 0,
            taxName: i.tax_name || 'Tax',
            taxPercentage: Number(i.tax_percentage) || 0,
            tax: Number(i.tax_amount) || 0,
            total: totalAmt,
            paidAmount: paidAmt,
            remainingBalance: calculateRemainingBalance(totalAmt, paidAmt),
            currency: i.currency || 'USD',
            notes: i.notes || '',
            paymentInstructions: i.payment_instructions || '',
            receipts,
          } as Invoice;
        });
      }

      return [];
    } catch (err) {
      console.error('[ClientInvoiceService] Error fetching client invoices from Supabase:', err);
      return [];
    }
  },

  /**
   * Retrieves payment instructions or details for client settlement
   */
  initiatePayment: async (
    clientId: string,
    invoiceId: string
  ): Promise<{ success: boolean; invoice?: Invoice; message?: string; error?: string }> => {
    if (!clientId || !invoiceId) {
      return { success: false, error: 'Unauthorized payment request.' };
    }

    try {
      const invoices = await ClientInvoiceService.getInvoices(clientId);
      const target = invoices.find(inv => inv.id === invoiceId);

      if (target) {
        return {
          success: true,
          invoice: target,
          message: target.paymentInstructions || 'Please transfer payment using the bank instructions on your invoice statement.',
        };
      }
    } catch (err) {
      console.warn('Supabase invoice lookup error:', err);
    }

    return { success: false, error: 'Invoice not found or does not belong to your account.' };
  },
};

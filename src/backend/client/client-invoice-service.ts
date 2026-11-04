import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { Invoice } from '@/shared/types';
import { derivePaymentStatus, calculateRemainingBalance, isInvoiceOverdue } from '@/shared/utils/invoice-calculations';
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
        console.warn('[ClientInvoiceService] Database error fetching invoices, using store fallback:', error);
        return FlowDeskStore.getInvoices(clientId);
      }

      if (data && data.length > 0) {
        // Resolve default fallback branding/settings via server API route (bypasses RLS)
        let defaultQrUrl: string | undefined;
        let defaultUpiId: string | undefined;
        let defaultBankDetails: any = undefined;

        if (typeof window !== 'undefined') {
          try {
            const brandRes = await fetch(`/api/portal/branding?clientId=${encodeURIComponent(clientId)}`, {
              cache: 'no-store',
            });
            if (brandRes.ok) {
              const brandJson = await brandRes.json();
              if (brandJson?.success && brandJson.branding) {
                defaultQrUrl = brandJson.branding.upiQrCodeUrl || undefined;
                defaultUpiId = brandJson.branding.upiId || undefined;
                defaultBankDetails = brandJson.branding.bankDetails || undefined;
              }
            }
          } catch (fbErr) {
            console.warn('[ClientInvoiceService] Branding route query notice:', fbErr);
          }
        }

        if (!defaultQrUrl || !defaultBankDetails) {
          try {
            const localProf = FlowDeskStore.getUserProfile() || {};
            if (!defaultQrUrl && localProf.upiQrCodeUrl) defaultQrUrl = localProf.upiQrCodeUrl;
            if (!defaultUpiId && localProf.upiId) defaultUpiId = localProf.upiId;
            if (!defaultBankDetails && ((localProf as any).bankName || (localProf as any).bankDetails)) {
              defaultBankDetails = (localProf as any).bankDetails || {
                bankName: (localProf as any).bankName || '',
                accountHolderName: (localProf as any).accountHolderName || '',
                accountNumber: (localProf as any).accountNumber || '',
                ifscCode: (localProf as any).ifscCode || '',
                branchName: (localProf as any).branchName || '',
                upiId: defaultUpiId || '',
              };
            }
          } catch {
            // non-critical
          }
        }

        return data.map((i) => {
          const paidAmt = Number(i.paid_amount) || 0;
          const totalAmt = Number(i.total_amount) || 0;
          const paymentStatus = derivePaymentStatus(totalAmt, paidAmt);
          const isOverdue = isInvoiceOverdue(i.due_date, paymentStatus, i.status || 'sent');

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

          const resolvedQrUrl = i.upi_qr_code_url || i.payment_methods?.upiQrCodeUrl || defaultQrUrl || undefined;
          const resolvedUpiId = i.upi_id || defaultUpiId || undefined;
          const resolvedBankDetails = i.bank_details || defaultBankDetails || undefined;

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
            status: isOverdue ? 'overdue' : (i.status || 'sent'),
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
            paymentMethods: {
              ...(i.payment_methods || {}),
              bankTransferEnabled: i.payment_methods?.bankTransferEnabled ?? Boolean(resolvedBankDetails),
              upiEnabled: i.payment_methods?.upiEnabled ?? Boolean(resolvedUpiId || resolvedQrUrl),
              upiQrCodeUrl: resolvedQrUrl,
              upiId: resolvedUpiId,
              bankDetails: resolvedBankDetails,
            },
            upiId: resolvedUpiId,
            upiQrCodeUrl: resolvedQrUrl,
            bankDetails: resolvedBankDetails,
            razorpayPaymentLink: i.razorpay_payment_link || undefined,
            paymentNotification: i.payment_notification || undefined,
            receipts,
          } as Invoice;
        });
      }

      const localInvoices = FlowDeskStore.getInvoices(clientId);
      if (localInvoices.length > 0) {
        return localInvoices;
      }

      return [];
    } catch (err) {
      console.warn('[ClientInvoiceService] Error fetching client invoices from Supabase, using store fallback:', err);
      return FlowDeskStore.getInvoices(clientId);
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

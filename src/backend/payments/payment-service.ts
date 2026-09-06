import { supabase, supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { RazorpayService } from './razorpay-service';
import { toSubunits, fromSubunits, isCurrencySupported } from './currency-utils';
import { getRazorpayKeyId } from './razorpay-client';
import { InvoiceReceipt } from '@/shared/types';
import { calculateRemainingBalance, derivePaymentStatus } from '@/shared/utils/invoice-calculations';
import { FlowDeskStore } from '@/backend/store/storage-store';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreatePaymentOrderInput {
  invoiceId: string;
  clientId?: string;
  workspaceId?: string;
  requestedAmount?: number;
  partialPayment?: boolean;
}

export interface PaymentOrderResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  amountSubunits?: number | string;
  currency?: string;
  keyId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  clientName?: string;
  clientEmail?: string;
  remainingBalance?: number;
  error?: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
  clientId?: string;
}

export interface PaymentProcessResult {
  success: boolean;
  paymentId?: string;
  dbPaymentId?: string;
  orderId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  workspaceId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  status?: 'paid' | 'partially_paid' | 'failed' | 'pending';
  amountSettled?: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingBalance?: number;
  receipt?: InvoiceReceipt;
  duplicateSuppressed?: boolean;
  alreadyProcessed?: boolean;
  error?: string;
  errorCode?: string;
}

const globalForPayment = globalThis as unknown as {
  __flowdesk_orderMappingCache?: Map<string, { invoiceId: string; workspaceId?: string; clientId?: string; amount: number; currency: string }>;
  __flowdesk_demoProcessedPayments?: Map<string, PaymentProcessResult>;
};

const orderMappingCache =
  globalForPayment.__flowdesk_orderMappingCache ??
  (globalForPayment.__flowdesk_orderMappingCache = new Map());

const demoProcessedPayments =
  globalForPayment.__flowdesk_demoProcessedPayments ??
  (globalForPayment.__flowdesk_demoProcessedPayments = new Map());

export const PaymentService = {
  /**
   * Validates invoice state and generates a server-authoritative Razorpay Order
   * Prevents concurrent checkout overpayment and enforces tenant isolation.
   */
  createPaymentOrder: async (input: CreatePaymentOrderInput): Promise<PaymentOrderResult> => {
    const { invoiceId, clientId, workspaceId, requestedAmount, partialPayment } = input;

    if (!invoiceId) {
      return { success: false, error: 'Invoice ID is required.' };
    }

    const isUuid = UUID_REGEX.test(invoiceId);

    // 1. Resolve demo/mock invoices ONLY when demo mode is explicitly configured
    if (isDemoModeActive()) {
      const demoInvs = FlowDeskStore.getInvoices();
      const demoInv = demoInvs.find((i) => i.id === invoiceId || i.invoiceNumber === invoiceId);
      
      if (demoInv) {
        if (clientId && demoInv.clientId && demoInv.clientId !== clientId) {
          return { success: false, error: 'Unauthorized: Invoice does not belong to this client account.' };
        }
        const totalAmount = Number(demoInv.total) || 0;
        const currentPaidAmount = Number(demoInv.paidAmount) || 0;
        const rem = calculateRemainingBalance(totalAmount, currentPaidAmount);

        if (rem <= 0 || demoInv.status === 'paid' || demoInv.paymentStatus === 'paid') {
          return { success: false, error: 'This invoice is already fully paid.' };
        }
        if (demoInv.status === 'cancelled') {
          return { success: false, error: 'This invoice has been cancelled and cannot accept payments.' };
        }
        if (requestedAmount !== undefined && requestedAmount !== null && requestedAmount > rem) {
          return {
            success: false,
            error: `Payment amount (${demoInv.currency || 'USD'} ${requestedAmount}) exceeds the outstanding balance (${demoInv.currency || 'USD'} ${rem}).`,
          };
        }

        const payAmt = requestedAmount && requestedAmount > 0 ? requestedAmount : rem;
        const safeInvTag = encodeURIComponent(demoInv.id).replace(/[^a-zA-Z0-9-]/g, '');
        const genOrderId = `order_demo_${safeInvTag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        orderMappingCache.set(genOrderId, {
          invoiceId: demoInv.id,
          workspaceId: (demoInv as any).workspaceId,
          clientId: demoInv.clientId,
          amount: payAmt,
          currency: demoInv.currency || 'USD',
        });

        return {
          success: true,
          orderId: genOrderId,
          amount: payAmt,
          amountSubunits: Number(toSubunits(payAmt, demoInv.currency || 'USD')),
          currency: demoInv.currency || 'USD',
          keyId: getRazorpayKeyId() || '',
          invoiceId: demoInv.id,
          invoiceNumber: demoInv.invoiceNumber,
          clientName: demoInv.clientName,
          clientEmail: demoInv.clientEmail,
          remainingBalance: rem,
        };
      }
    }

    const db = supabaseAdmin || supabase;
    let invoice: any = null;
    let invError: any = null;

    // 2. Resolve invoice from authoritative Supabase storage
    if (isUuid) {
      const res = await db
        .from('invoices')
        .select('*, invoice_payments(*)')
        .eq('id', invoiceId)
        .maybeSingle();
      invoice = res.data;
      invError = res.error;
    } else {
      const res = await db
        .from('invoices')
        .select('*, invoice_payments(*)')
        .eq('invoice_number', invoiceId)
        .maybeSingle();
      invoice = res.data;
      invError = res.error;
    }

    if (!invoice) {
      // Production Mode: Fail closed
      return { 
        success: false, 
        error: invError ? `Database error loading invoice: ${invError.message}` : 'Invoice not found or access denied.' 
      };
    }

    // 2. Authorization check: Client isolation & Tenant isolation
    if (clientId && invoice.client_id && invoice.client_id !== clientId) {
      return { success: false, error: 'Unauthorized: Invoice does not belong to this client account.' };
    }
    if (workspaceId && invoice.workspace_id && invoice.workspace_id !== workspaceId) {
      return { success: false, error: 'Unauthorized: Workspace tenancy mismatch.' };
    }

    // 3. Status checks
    if (invoice.status === 'cancelled') {
      return { success: false, error: 'This invoice has been cancelled and cannot accept payments.' };
    }

    const totalAmount = Number(invoice.total_amount) || 0;
    const currentPaidAmount = Number(invoice.paid_amount) || 0;
    const outstandingBalance = calculateRemainingBalance(totalAmount, currentPaidAmount);

    if (outstandingBalance <= 0 || invoice.status === 'paid') {
      return { success: false, error: 'This invoice is already fully paid.' };
    }

    // 4. Currency validation
    const currency = (invoice.currency || 'INR').toUpperCase();
    if (!isCurrencySupported(currency)) {
      return {
        success: false,
        error: `Invoice currency (${currency}) is not currently supported for online payment.`,
      };
    }

    // 5. Amount validation (Server is authoritative; no silent clamping)
    let settleAmount = outstandingBalance;
    if (requestedAmount !== undefined && requestedAmount !== null) {
      if (requestedAmount <= 0) {
        return { success: false, error: 'Payment amount must be greater than zero.' };
      }
      if (requestedAmount > outstandingBalance) {
        return {
          success: false,
          error: `Payment amount (${currency} ${requestedAmount}) exceeds the outstanding balance (${currency} ${outstandingBalance}).`,
        };
      }
      settleAmount = requestedAmount;
    }

    // 6. Subunit conversion
    let amountSubunits: bigint;
    try {
      amountSubunits = toSubunits(settleAmount, currency);
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid calculation for currency subunits.' };
    }

    // 7. Create Razorpay Order via Gateway API
    const receiptRef = `rcpt_${invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`.slice(0, 40);
    const keyId = getRazorpayKeyId();

    try {
      const order = await RazorpayService.createOrder({
        amountSubunits,
        currency,
        receipt: receiptRef,
        notes: {
          flowdesk_invoice_id: invoice.id,
          flowdesk_workspace_id: invoice.workspace_id,
          flowdesk_client_id: invoice.client_id || '',
          flowdesk_invoice_number: invoice.invoice_number,
        },
        partialPayment: Boolean(partialPayment),
      });

      // 8. Persist Order Mapping in database with 30m expiration
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db.from('razorpay_orders').insert({
        order_id: order.id,
        invoice_id: invoice.id,
        workspace_id: invoice.workspace_id,
        client_id: invoice.client_id,
        amount: settleAmount,
        amount_subunits: typeof amountSubunits === 'bigint' ? Number(amountSubunits) : amountSubunits,
        currency,
        status: 'created',
        receipt: receiptRef,
        expires_at: expiresAt,
        notes: {
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
        },
      });

      orderMappingCache.set(order.id, {
        invoiceId: invoice.id,
        workspaceId: invoice.workspace_id,
        clientId: invoice.client_id,
        amount: settleAmount,
        currency,
      });

      return {
        success: true,
        orderId: order.id,
        amount: settleAmount,
        amountSubunits: Number(amountSubunits),
        currency,
        keyId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client_name || '',
        clientEmail: invoice.client_email || '',
        remainingBalance: outstandingBalance,
      };
    } catch (err: any) {
      console.error('[PaymentService.createPaymentOrder] Error creating Razorpay order:', err);
      return {
        success: false,
        error: err.message || 'Failed to initialize payment gateway order.',
      };
    }
  },

  /**
   * Verifies checkout payment signature, cross-checks with gateway API, and finalizes settlement
   */
  verifyAndCapturePayment: async (input: VerifyPaymentInput): Promise<PaymentProcessResult> => {
    const { orderId, paymentId, signature, clientId } = input;

    if (!orderId || !paymentId || !signature) {
      return { success: false, error: 'Missing required payment verification tokens.' };
    }

    // 0. Handle Demo Mode & mock orders directly
    // IMPORTANT: This shortcut MUST ONLY execute when BOTH conditions are true:
    // 1) isDemoModeActive() - demo mode is explicitly configured
    // 2) orderId.startsWith('order_demo_') - order is a known demo order
    //
    // Production must NEVER process order_demo_ as a valid payment.
    // Production must NEVER bypass HMAC verification.
    // Production must NEVER bypass Razorpay gateway verification.
    // Production must NEVER write payment/invoice paid state via this path.
    if (isDemoModeActive() && orderId.startsWith('order_demo_')) {
      const cached = orderMappingCache.get(orderId);
      const paymentCurrency = (cached?.currency || 'USD').toUpperCase();
      const paidAmount = cached?.amount || 0;

      return PaymentService.processDemoPaymentFallback({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amount: paidAmount,
        currency: paymentCurrency,
        method: 'razorpay',
        capturedAt: new Date().toISOString(),
        invoiceId: cached?.invoiceId,
      });
    }

    // 1. Verify HMAC Signature
    const isSignatureValid = RazorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isSignatureValid) {
      console.warn(`[PaymentService.verifyAndCapturePayment] Security Alert: Invalid signature for payment ${paymentId}`);
      return { success: false, error: 'Payment signature verification failed. The transaction could not be verified.' };
    }

    // 2. Fetch authoritative payment details from Razorpay Gateway API
    let rzpPayment;
    try {
      rzpPayment = await RazorpayService.fetchPayment(paymentId);
    } catch (err: any) {
      return { success: false, error: `Could not confirm payment details with gateway: ${err.message}` };
    }

    if (!rzpPayment || rzpPayment.order_id !== orderId) {
      return { success: false, error: 'Payment record does not match the generated order.' };
    }

    if (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized') {
      return { success: false, error: `Payment is not in captured state (status: ${rzpPayment.status}).` };
    }

    // 3. Resolve order mapping from database or cache
    const db = supabaseAdmin || supabase;
    const { data: orderRecord } = await db
      .from('razorpay_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    const cached = orderMappingCache.get(orderId);
    const resolvedClientId = orderRecord?.client_id || cached?.clientId;

    if (resolvedClientId && clientId && resolvedClientId !== clientId) {
      return { success: false, error: 'Unauthorized: Order belongs to a different client session.' };
    }

    // 4. Calculate actual amount paid from verified Razorpay payment
    const paymentCurrency = rzpPayment.currency.toUpperCase();
    const paidAmount = fromSubunits(rzpPayment.amount, paymentCurrency);

    // 5. Finalize payment idempotently via transactional PostgreSQL RPC
    return PaymentService.processCapturedPayment({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      amount: paidAmount,
      currency: paymentCurrency,
      method: rzpPayment.method,
      capturedAt: new Date(rzpPayment.created_at * 1000).toISOString(),
      clientId,
      invoiceId: orderRecord?.invoice_id || cached?.invoiceId,
      workspaceId: orderRecord?.workspace_id || cached?.workspaceId,
    });
  },

  /**
   * Idempotently processes a captured payment using PostgreSQL transactional RPC (settle_razorpay_payment)
   * Ensures atomic row locking, zero overpayment, durable receipts, and outbox email dispatch.
   */
  processCapturedPayment: async (params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    amount: number;
    currency: string;
    method?: string;
    capturedAt?: string;
    invoiceId?: string;
    clientId?: string;
    workspaceId?: string;
  }): Promise<PaymentProcessResult> => {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
      currency,
      method = 'razorpay',
      capturedAt = new Date().toISOString(),
      invoiceId,
      clientId,
    } = params;

    if (!razorpayPaymentId) {
      return { success: false, error: 'Razorpay Payment ID is required for settlement.' };
    }

    const isUuid = invoiceId ? UUID_REGEX.test(invoiceId) : false;

    // If invoiceId is a mock demo ID (e.g. inv-104), route directly to safe demo fallback
    // ONLY when demo mode is explicitly configured — production must never settle via demo state.
    if (invoiceId && !isUuid && isDemoModeActive()) {
      return PaymentService.processDemoPaymentFallback(params);
    }

    const db = supabaseAdmin || supabase;

    // 1. Attempt PostgreSQL Transactional RPC Settlement
    try {
      const { data: rpcData, error: rpcError } = await db.rpc('settle_razorpay_payment', {
        p_razorpay_payment_id: razorpayPaymentId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_signature: razorpaySignature || null,
        p_amount: amount,
        p_currency: currency.toUpperCase(),
        p_payment_method: method,
        p_captured_at: capturedAt,
        p_expected_invoice_id: isUuid ? invoiceId : null,
        p_expected_client_id: clientId && UUID_REGEX.test(clientId) ? clientId : null,
        p_notes: `Online payment via Razorpay (${method.toUpperCase()})`,
      });

      if (rpcError) {
        // Check for 23505 Unique Violation or RPC failure
        if (rpcError.code === '23505' || rpcError.message?.includes('duplicate key') || rpcError.message?.includes('unique')) {
          const { data: existingPay } = await db
            .from('invoice_payments')
            .select('*, invoices(*), receipts(*)')
            .eq('razorpay_payment_id', razorpayPaymentId)
            .maybeSingle();

          if (existingPay) {
            const inv = existingPay.invoices || {};
            const rcp = existingPay.receipts?.[0] || {};
            return {
              success: true,
              duplicateSuppressed: true,
              alreadyProcessed: true,
              paymentId: razorpayPaymentId,
              dbPaymentId: existingPay.id,
              orderId: razorpayOrderId,
              invoiceId: existingPay.invoice_id,
              invoiceNumber: inv.invoice_number,
              status: inv.status,
              amountSettled: Number(existingPay.amount) || amount,
              totalAmount: Number(inv.total_amount) || 0,
              paidAmount: Number(inv.paid_amount) || 0,
              remainingBalance: calculateRemainingBalance(Number(inv.total_amount) || 0, Number(inv.paid_amount) || 0),
              receipt: rcp.id ? {
                id: rcp.id,
                receiptNumber: rcp.receipt_number,
                invoiceId: rcp.invoice_id,
                invoiceNumber: inv.invoice_number,
                amount: Number(rcp.amount) || amount,
                currency: rcp.currency || currency,
                paymentMethod: rcp.payment_method || method,
                paymentDate: rcp.payment_date || capturedAt,
                remainingBalance: calculateRemainingBalance(Number(inv.total_amount) || 0, Number(inv.paid_amount) || 0),
                totalAmount: Number(inv.total_amount) || 0,
              } : undefined,
            };
          }
        }

        // Demo fallback ONLY if demo mode is explicitly active
        if (isDemoModeActive()) {
          return PaymentService.processDemoPaymentFallback(params);
        }

        console.error('[PaymentService] PostgreSQL settle_razorpay_payment RPC error:', rpcError);
        return {
          success: false,
          errorCode: rpcError.code || 'DB_RPC_ERROR',
          error: rpcError.message || 'Database transaction error settling payment.',
        };
      }

      const result = rpcData as PaymentProcessResult;

      if (!result.success) {
        return result;
      }

      // 2. Dispatch Resend Email Notifications asynchronously if newly settled
      if (!result.duplicateSuppressed && result.clientEmail) {
        PaymentService.dispatchPaymentEmails({
          invoiceId: result.invoiceId!,
          invoiceNumber: result.invoiceNumber!,
          workspaceId: result.workspaceId,
          clientId: result.clientId,
          clientName: result.clientName,
          clientEmail: result.clientEmail,
          amount: result.amountSettled || amount,
          currency: currency.toUpperCase(),
          paymentId: razorpayPaymentId,
          receiptNumber: result.receipt?.receiptNumber,
          paymentDate: capturedAt,
          paymentMethod: method,
        }).catch((err) => {
          console.warn('[PaymentService] Non-blocking email dispatch notice:', err);
        });
      }

      return result;
    } catch (err: any) {
      if (isDemoModeActive()) {
        return PaymentService.processDemoPaymentFallback(params);
      }
      console.error('[PaymentService] Unexpected error in processCapturedPayment:', err);
      return {
        success: false,
        errorCode: 'UNEXPECTED_SETTLEMENT_ERROR',
        error: err.message || 'An unexpected error occurred during payment settlement.',
      };
    }
  },

  /**
   * Safe standalone demo fallback for mock/demo mode ONLY (strictly isolated)
   */
  processDemoPaymentFallback: (params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amount: number;
    currency: string;
    method?: string;
    capturedAt?: string;
    invoiceId?: string;
  }): PaymentProcessResult => {
    const { razorpayOrderId, razorpayPaymentId, amount, currency, method = 'razorpay', capturedAt = new Date().toISOString(), invoiceId } = params;

    if (demoProcessedPayments.has(razorpayPaymentId)) {
      const cached = demoProcessedPayments.get(razorpayPaymentId)!;
      return {
        ...cached,
        duplicateSuppressed: true,
        alreadyProcessed: true,
      };
    }

    let targetInvId = invoiceId;
    if (!targetInvId && orderMappingCache.has(razorpayOrderId)) {
      targetInvId = orderMappingCache.get(razorpayOrderId)?.invoiceId;
    }
    if (!targetInvId && razorpayOrderId.startsWith('order_demo_')) {
      // Decode order_demo_{safeInvTag}_{timestamp}_{rand}
      const parts = razorpayOrderId.split('_');
      if (parts.length >= 3 && parts[2]) {
        targetInvId = parts[2];
      }
    }

    const storeInvs = FlowDeskStore.getInvoices();
    const storeInv = storeInvs.find((i) => i.id === targetInvId || i.invoiceNumber === targetInvId || (targetInvId && (i.id.toLowerCase() === targetInvId.toLowerCase() || i.invoiceNumber.toLowerCase() === targetInvId.toLowerCase())));

    if (!storeInv) {
      return {
        success: false,
        errorCode: 'UNRESOLVED_PAYMENT',
        error: 'Unable to safely associate this payment with a FlowDesk invoice in demo store.',
      };
    }

    const curTotal = Number(storeInv.total) || 0;
    const curPaid = Number(storeInv.paidAmount) || 0;

    if (curPaid + amount > curTotal) {
      return {
        success: false,
        errorCode: 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
        error: `Payment amount (${currency} ${amount}) exceeds outstanding balance (${currency} ${curTotal - curPaid}).`,
      };
    }

    const nPaid = curPaid + amount;
    const nRem = calculateRemainingBalance(curTotal, nPaid);
    const nStat: 'paid' | 'partially_paid' | 'pending' = nPaid >= curTotal ? 'paid' : (nPaid > 0 ? 'partially_paid' : 'pending');

    storeInv.paidAmount = nPaid;
    storeInv.status = nStat;
    storeInv.paymentStatus = nStat;

    const receiptNumber = `RCP-FD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const receiptData: InvoiceReceipt = {
      id: razorpayPaymentId,
      receiptNumber,
      invoiceId: storeInv.id,
      invoiceNumber: storeInv.invoiceNumber,
      clientId: storeInv.clientId,
      clientName: storeInv.clientName,
      amount,
      currency: storeInv.currency || currency,
      paymentMethod: method,
      paymentDate: new Date(capturedAt).toLocaleDateString(),
      notes: `Payment settled via Razorpay (${method.toUpperCase()})`,
      remainingBalance: nRem,
      totalAmount: curTotal,
      razorpayPaymentId,
      razorpayOrderId,
    };

    storeInv.receipts = [...(storeInv.receipts || []), receiptData];

    const finalRes: PaymentProcessResult = {
      success: true,
      duplicateSuppressed: false,
      alreadyProcessed: false,
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      invoiceId: storeInv.id,
      invoiceNumber: storeInv.invoiceNumber,
      clientId: storeInv.clientId,
      clientName: storeInv.clientName,
      clientEmail: storeInv.clientEmail,
      status: nStat,
      amountSettled: amount,
      totalAmount: curTotal,
      paidAmount: nPaid,
      remainingBalance: nRem,
      receipt: receiptData,
    };

    demoProcessedPayments.set(razorpayPaymentId, finalRes);
    return finalRes;
  },

  /**
   * Helper to dispatch transactional emails safely without blocking payment response
   */
  dispatchPaymentEmails: async (meta: {
    invoiceId: string;
    invoiceNumber: string;
    workspaceId?: string;
    clientId?: string;
    clientName?: string;
    clientEmail: string;
    amount: number;
    currency: string;
    paymentId: string;
    receiptNumber?: string;
    paymentDate: string;
    paymentMethod: string;
  }) => {
    try {
      const { EmailService, getAppBaseUrl } = await import('@/backend/email');
      const db = supabaseAdmin || supabase;

      let studioName = 'FlowDesk Studio';
      if (meta.workspaceId && UUID_REGEX.test(meta.workspaceId)) {
        const { data: ws } = await db.from('workspaces').select('name, owner_id').eq('id', meta.workspaceId).maybeSingle();
        if (ws?.name) studioName = ws.name;
        if (ws?.owner_id) {
          const { data: prof } = await db.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).maybeSingle();
          if (prof?.business_name) studioName = prof.business_name;
        }
      }

      await EmailService.sendPaymentReceived(
        meta.clientEmail,
        {
          recipientName: meta.clientName || 'Client',
          freelancerName: studioName,
          invoiceNumber: meta.invoiceNumber,
          amount: `${meta.currency} ${meta.amount.toLocaleString()}`,
          paymentDate: new Date(meta.paymentDate).toLocaleDateString(),
          paymentMethod: `Razorpay (${meta.paymentMethod.toUpperCase()})`,
          receiptUrl: `${getAppBaseUrl()}/portal/${meta.clientId || ''}`,
        },
        { workspaceId: meta.workspaceId, paymentId: meta.paymentId }
      );

      if (meta.receiptNumber) {
        await EmailService.sendReceipt(
          meta.clientEmail,
          {
            recipientName: meta.clientName || 'Client',
            freelancerName: studioName,
            invoiceNumber: meta.invoiceNumber,
            amount: `${meta.currency} ${meta.amount.toLocaleString()}`,
            paymentDate: new Date(meta.paymentDate).toLocaleDateString(),
            paymentMethod: `Razorpay (${meta.paymentMethod.toUpperCase()})`,
            receiptUrl: `${getAppBaseUrl()}/portal/${meta.clientId || ''}`,
          },
          { workspaceId: meta.workspaceId, receiptId: meta.receiptNumber }
        );
      }
    } catch (err) {
      console.warn('[PaymentService.dispatchPaymentEmails] Warning during email dispatch:', err);
    }
  },

  /**
   * Records a failed payment attempt safely without modifying invoice balances
   */
  processFailedPayment: async (params: {
    razorpayOrderId?: string;
    razorpayPaymentId: string;
    reason?: string;
  }): Promise<void> => {
    const { razorpayOrderId, razorpayPaymentId, reason } = params;
    const db = supabaseAdmin || supabase;

    if (razorpayOrderId) {
      await db
        .from('razorpay_orders')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', razorpayOrderId);
    }

    console.warn(`[PaymentService] Payment failure recorded for ${razorpayPaymentId}: ${reason || 'Gateway failure'}`);
  },

  /**
   * Returns authoritative payment, balance, and durable receipts for an invoice
   */
  getInvoicePaymentStatus: async (
    invoiceId: string,
    authClientId?: string
  ): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    currency: string;
    status: string;
    paymentStatus: string;
    receipts: any[];
  } | null> => {
    const isUuid = UUID_REGEX.test(invoiceId);

    // Resolve from FlowDeskStore ONLY when demo mode is explicitly configured
    if (isDemoModeActive()) {
      const storeInv = FlowDeskStore.getInvoiceById(invoiceId) || FlowDeskStore.getInvoices().find((i) => i.id === invoiceId || i.invoiceNumber === invoiceId);
      if (storeInv) {
        if (authClientId && storeInv.clientId && storeInv.clientId !== authClientId) return null;
        const total = Number(storeInv.total) || 0;
        const paid = Number(storeInv.paidAmount) || 0;
        return {
          invoiceId: storeInv.id,
          invoiceNumber: storeInv.invoiceNumber,
          totalAmount: total,
          paidAmount: paid,
          remainingBalance: calculateRemainingBalance(total, paid),
          currency: storeInv.currency || 'USD',
          status: storeInv.status || 'pending',
          paymentStatus: storeInv.paymentStatus || 'pending',
          receipts: storeInv.receipts || [],
        };
      }
    }

    const db = supabaseAdmin || supabase;
    let invoice: any = null;

    if (isUuid) {
      const { data } = await db
        .from('invoices')
        .select('*, invoice_payments(*), receipts(*)')
        .eq('id', invoiceId)
        .maybeSingle();
      invoice = data;
    } else {
      const { data } = await db
        .from('invoices')
        .select('*, invoice_payments(*), receipts(*)')
        .eq('invoice_number', invoiceId)
        .maybeSingle();
      invoice = data;
    }

    if (!invoice) {
      return null;
    }

    if (authClientId && invoice.client_id && invoice.client_id !== authClientId) {
      return null;
    }

    const total = Number(invoice.total_amount) || 0;
    const paid = Number(invoice.paid_amount) || 0;
    const remaining = calculateRemainingBalance(total, paid);
    const paymentStatus = derivePaymentStatus(total, paid);

    // Map persisted receipts table records (falling back to payment records only if legacy)
    const persistedReceipts = (invoice.receipts || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      invoiceId: r.invoice_id,
      invoiceNumber: invoice.invoice_number,
      amount: Number(r.amount) || 0,
      currency: r.currency || invoice.currency || 'USD',
      paymentDate: r.payment_date || r.created_at,
      paymentMethod: r.payment_method || 'razorpay',
      razorpayPaymentId: r.razorpay_payment_id,
      razorpayOrderId: r.razorpay_order_id,
      notes: r.notes,
    }));

    const receipts = persistedReceipts.length > 0
      ? persistedReceipts
      : (invoice.invoice_payments || []).map((p: any) => ({
          id: p.id,
          receiptNumber: `RCP-${invoice.invoice_number}-${(p.id || '').slice(0, 4)}`,
          invoiceId: p.invoice_id,
          invoiceNumber: invoice.invoice_number,
          amount: Number(p.amount) || 0,
          currency: p.currency || invoice.currency || 'USD',
          paymentDate: p.payment_date || p.created_at,
          paymentMethod: p.payment_method || 'razorpay',
          gateway: p.gateway || 'manual',
          razorpayPaymentId: p.razorpay_payment_id,
          razorpayOrderId: p.razorpay_order_id,
          notes: p.notes,
        }));

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      totalAmount: total,
      paidAmount: paid,
      remainingBalance: remaining,
      currency: invoice.currency || 'USD',
      status: invoice.status || 'sent',
      paymentStatus,
      receipts,
    };
  },
};

import { z } from 'zod';

// ==========================================
// Base & Param Schemas
// ==========================================

export const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
    'Invalid UUID format'
  );

export const tokenParamSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{8,128}$/, 'Invalid token format');

export const paymentIdParamSchema = z
  .string()
  .trim()
  .regex(
    /^(pay_[a-zA-Z0-9]{6,40}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/,
    'Invalid payment ID format'
  );

export const oauthProviderSchema = z.enum(['google', 'github']);

// ==========================================
// Route Payload Schemas (.strict() rejects unknown fields)
// ==========================================

export const EmailDispatchEventEnum = z.enum([
  'client_invitation',
  'deliverable_ready',
  'invoice_issued',
  'payment_received',
  'receipt_issued',
  'deliverable_approved',
  'revision_requested',
  'document_uploaded',
  'account_deleted',
  'account_restored',
  'security_alert',
]);

export const EmailDispatchOptionsSchema = z
  .object({
    to: z.string().trim().email().max(255),
    eventType: EmailDispatchEventEnum,
    referenceType: z.string().trim().max(50).optional(),
    referenceId: z.string().trim().max(100).optional(),
    workspaceId: uuidSchema.optional(),
    userId: uuidSchema.optional(),
    subject: z.string().trim().min(1).max(255),
    html: z.string().min(1).max(100 * 1024), // Max 100 KB HTML string
    text: z.string().max(50 * 1024).optional(),
  })
  .strict();


export const EmailDispatchRouteSchema = z
  .object({
    options: EmailDispatchOptionsSchema,
  })
  .strict();

export const CreatePaymentOrderSchema = z
  .object({
    invoiceId: uuidSchema,
    requestedAmount: z
      .number()
      .positive('Requested amount must be greater than zero')
      .finite()
      .max(100_000_000, 'Requested amount exceeds allowable maximum')
      .optional(),
    partialPayment: z.boolean().optional(),
  })
  .strict();

export const VerifyPaymentSchema = z
  .object({
    orderId: z.string().trim().min(6).max(64),
    paymentId: z.string().trim().min(6).max(64),
    signature: z.string().trim().min(10).max(256),
  })
  .strict();

export const CspReportPayloadSchema = z
  .object({
    'csp-report': z
      .object({
        'document-uri': z.string().max(1000).optional(),
        referrer: z.string().max(1000).optional(),
        'violated-directive': z.string().max(200).optional(),
        'effective-directive': z.string().max(200).optional(),
        'original-policy': z.string().max(2000).optional(),
        disposition: z.string().max(50).optional(),
        'blocked-uri': z.string().max(1000).optional(),
        'line-number': z.number().optional(),
        'column-number': z.number().optional(),
        'source-file': z.string().max(1000).optional(),
        'status-code': z.number().optional(),
        'script-sample': z.string().max(500).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Type exports derived from schemas
export type EmailDispatchPayload = z.infer<typeof EmailDispatchRouteSchema>;
export type CreatePaymentOrderPayload = z.infer<typeof CreatePaymentOrderSchema>;
export type VerifyPaymentPayload = z.infer<typeof VerifyPaymentSchema>;
export type CspReportPayload = z.infer<typeof CspReportPayloadSchema>;

export const ApproveDeliverableSchema = z.object({
  notes: z.string().trim().max(1000).optional().default(''),
}).strict();

export type ApproveDeliverablePayload = z.infer<typeof ApproveDeliverableSchema>;

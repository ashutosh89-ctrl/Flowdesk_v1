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

// ==========================================
// Phase 5A: Server Mutation Schemas
// ==========================================

// Batch 1: Invoices & Money
export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['sent', 'viewed', 'cancelled']),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const RecordOfflinePaymentSchema = z.object({
  paymentMethod: z.enum(['bank_transfer', 'cash', 'cheque', 'other']).default('bank_transfer'),
  amount: z.number().positive('Payment amount must be greater than zero').finite().max(100_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const InvoiceItemInputSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, 'Item description is required').max(255),
  quantity: z.number().positive('Quantity must be greater than zero').finite().max(10_000),
  rate: z.number().min(0, 'Rate cannot be negative').finite().max(100_000_000),
}).strict();

export const CreateInvoiceSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.optional().nullable(),
  invoiceNumber: z.string().trim().min(1).max(100).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  items: z.array(InvoiceItemInputSchema).min(1, 'At least one line item is required'),
  taxPercentage: z.number().min(0).max(100).optional().default(0),
  taxName: z.string().trim().max(50).optional().default('Tax'),
  discount: z.number().min(0).optional().default(0),
  currency: z.string().trim().length(3).default('USD'),
  notes: z.string().trim().max(2000).optional(),
  paymentInstructions: z.string().trim().max(2000).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
}).strict();

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().strict();

// Batch 2: Approvals & Deliverables
export const SubmitDeliverableSchema = z.object({
  submissionMessage: z.string().trim().max(1000).optional(),
  reviewDeadline: z.string().optional(),
}).strict();

export const RequestRevisionDeliverableSchema = z.object({
  revisionComment: z.string().trim().min(1, 'Revision comment is required').max(2000),
}).strict();

export const CreateDeliverableVersionSchema = z.object({
  note: z.string().trim().max(500).optional(),
  fileName: z.string().trim().max(255).optional(),
  fileUrl: z.string().trim().max(1024).optional(),
  fileSize: z.string().trim().max(50).optional(),
}).strict();

export const CreateDeliverableCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment text is required').max(2000),
  isInternal: z.boolean().optional().default(false),
}).strict();

// Batch 3: Client Management & Invitations
export const CreateClientInvitationSchema = z.object({
  recipientEmail: z.string().trim().email().max(255).optional(),
  forceNew: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
}).strict();

export const CreateClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Valid email required').max(255),
  company: z.string().trim().max(100).optional().default(''),
  phone: z.string().trim().max(50).optional(),
  hourlyRate: z.number().min(0).optional(),
  currency: z.string().trim().length(3).optional().default('USD'),
}).strict();

export const UpdateClientSchema = CreateClientSchema.partial().extend({
  status: z.enum(['active', 'archived']).optional(),
  portalAccessEnabled: z.boolean().optional(),
}).strict();

// Batch 4: Account & Settings
export const UpdateUserSettingsSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(50).optional(),
  dateFormat: z.string().trim().max(20).optional(),
  invoicePrefix: z.string().trim().max(10).optional(),
  invoiceNumberFormat: z.string().trim().max(50).optional(),
  invoiceSeparator: z.string().trim().max(5).optional(),
  invoiceIncludeYear: z.boolean().optional(),
  invoicePadding: z.number().min(1).max(10).optional(),
  invoiceNextSequence: z.number().min(1).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  taxName: z.string().trim().max(50).optional(),
  defaultPaymentTerms: z.number().min(0).max(365).optional(),
}).strict();

export const UpdateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  emailDeliverables: z.boolean().optional(),
  emailDocuments: z.boolean().optional(),
  emailInvoices: z.boolean().optional(),
  invoiceReminders: z.boolean().optional(),
  commentAlerts: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
}).strict();

export const AccountDeletionRequestSchema = z.object({
  target: z.enum(['freelancer', 'client']).optional().default('freelancer'),
  clientId: uuidSchema.optional(),
  confirmText: z.string().optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const AccountDeletionRestoreSchema = z.object({
  target: z.enum(['freelancer', 'client']).optional().default('freelancer'),
  clientId: uuidSchema.optional(),
}).strict();

// ==========================================
// Billing & Subscriptions Schemas
// ==========================================

export const BillingPlanKeyEnum = z.enum(['pro', 'studio']);
export const BillingIntervalEnum = z.enum(['monthly', 'yearly']);

export const BillingCheckoutSchema = z.object({
  workspaceId: uuidSchema.optional(),
  planKey: BillingPlanKeyEnum,
  interval: BillingIntervalEnum,
}).strict();

export const BillingCancelSchema = z.object({
  workspaceId: uuidSchema.optional(),
  atPeriodEnd: z.boolean().optional().default(true),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const BillingResumeSchema = z.object({
  workspaceId: uuidSchema.optional(),
}).strict();

export const BillingChangePlanSchema = z.object({
  workspaceId: uuidSchema.optional(),
  planKey: BillingPlanKeyEnum,
  interval: BillingIntervalEnum,
}).strict();

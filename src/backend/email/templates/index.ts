import { renderEmailLayout, escapeHtml, sanitizeHeader, sanitizeUrl, truncateText } from './layout';

export interface ClientInvitationParams {
  clientName: string;
  freelancerName: string;
  businessName?: string;
  portalUrl: string;
}

export function renderClientInvitationEmail(params: ClientInvitationParams) {
  const cleanSender = truncateText(params.businessName || params.freelancerName || 'FlowDesk Studio', 200);
  const cleanClientName = truncateText(params.clientName, 200);
  const safePortalUrl = sanitizeUrl(params.portalUrl);

  const sender = escapeHtml(cleanSender);
  const clientName = escapeHtml(cleanClientName);

  const contentHtml = `
    <p>Hello <strong>${clientName}</strong>,</p>
    <p><strong>${sender}</strong> has invited you to access your dedicated collaboration portal on FlowDesk.</p>
    <p>From your portal, you can review deliverables, approve milestones, upload brand assets, and view invoices in one secure place.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${clientName}</span></div>
      <div class="info-row"><span class="info-label">Invited By</span><span class="info-value">${sender}</span></div>
      <div class="info-row"><span class="info-label">Access Type</span><span class="info-value">Client Collaboration Portal</span></div>
    </div>
    <p>Click below to enter your workspace:</p>
  `;

  return {
    subject: sanitizeHeader(`Invitation: Access your client portal from ${cleanSender}`),
    html: renderEmailLayout({
      title: 'Welcome to your Client Portal',
      previewText: `${cleanSender} has invited you to collaborate on FlowDesk.`,
      contentHtml,
      ctaText: 'Enter Client Portal',
      ctaUrl: safePortalUrl,
    }),
    text: `Hello ${cleanClientName},\n\n${cleanSender} has invited you to your dedicated collaboration portal on FlowDesk.\n\nAccess your portal here: ${safePortalUrl}\n\nFlowDesk Team`,
  };
}

export interface DeliverableReadyParams {
  clientName: string;
  freelancerName?: string;
  projectName?: string;
  projectTitle?: string;
  deliverableTitle: string;
  version?: string;
  versionNumber?: string;
  portalUrl: string;
}

export function renderDeliverableReadyEmail(params: DeliverableReadyParams) {
  const cleanProject = truncateText(params.projectName || params.projectTitle || 'Project Workspace', 200);
  const cleanDeliverable = truncateText(params.deliverableTitle, 200);
  const cleanVer = truncateText(params.version || params.versionNumber || 'v1.0', 50);
  const cleanFreelancer = truncateText(params.freelancerName || 'Freelancer', 200);
  const cleanClientName = truncateText(params.clientName, 200);
  const safePortalUrl = sanitizeUrl(params.portalUrl);

  const project = escapeHtml(cleanProject);
  const deliverableTitle = escapeHtml(cleanDeliverable);
  const ver = escapeHtml(cleanVer);
  const freelancer = escapeHtml(cleanFreelancer);
  const clientName = escapeHtml(cleanClientName);

  const contentHtml = `
    <p>Hello <strong>${clientName}</strong>,</p>
    <p>A new deliverable is ready for your review and feedback in project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Version</span><span class="info-value">${ver}</span></div>
      <div class="info-row"><span class="info-label">Submitted By</span><span class="info-value">${freelancer}</span></div>
    </div>
    <p>Please review the asset and approve or request revisions.</p>
  `;

  return {
    subject: sanitizeHeader(`Deliverable Ready for Review: "${cleanDeliverable}" (${cleanProject})`),
    html: renderEmailLayout({
      title: 'New Deliverable Ready for Review',
      previewText: `"${cleanDeliverable}" has been submitted for review.`,
      contentHtml,
      ctaText: 'Review Deliverable',
      ctaUrl: safePortalUrl,
    }),
    text: `Hello ${cleanClientName},\n\n"${cleanDeliverable}" (${cleanProject}) is ready for review.\n\nReview it here: ${safePortalUrl}`,
  };
}

export interface DeliverableApprovedParams {
  freelancerName: string;
  clientName: string;
  projectName?: string;
  projectTitle?: string;
  deliverableTitle: string;
  notes?: string;
  dashboardUrl?: string;
  deliverableUrl?: string;
}

export function renderDeliverableApprovedEmail(params: DeliverableApprovedParams) {
  const cleanProject = truncateText(params.projectName || params.projectTitle || 'Project Workspace', 200);
  const cleanFreelancer = truncateText(params.freelancerName, 200);
  const cleanClientName = truncateText(params.clientName, 200);
  const cleanDeliverable = truncateText(params.deliverableTitle, 200);
  const cleanNotes = params.notes ? truncateText(params.notes, 2000) : null;
  const safeUrl = sanitizeUrl(params.dashboardUrl || params.deliverableUrl);

  const project = escapeHtml(cleanProject);
  const freelancer = escapeHtml(cleanFreelancer);
  const clientName = escapeHtml(cleanClientName);
  const deliverableTitle = escapeHtml(cleanDeliverable);
  const notes = cleanNotes ? escapeHtml(cleanNotes) : null;

  const contentHtml = `
    <p>Hello <strong>${freelancer}</strong>,</p>
    <p>Great news! <strong>${clientName}</strong> has approved your deliverable <strong>"${deliverableTitle}"</strong> for project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${clientName}</span></div>
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color: #34d399;">Approved</span></div>
    </div>
    ${notes ? `<p style="font-size: 13px; color: #d4d4d8;"><strong>Client Notes:</strong> "${notes}"</p>` : ''}
  `;

  return {
    subject: sanitizeHeader(`Deliverable Approved: "${cleanDeliverable}" by ${cleanClientName}`),
    html: renderEmailLayout({
      title: 'Deliverable Approved!',
      previewText: `${cleanClientName} approved "${cleanDeliverable}".`,
      contentHtml,
      ctaText: 'View in Dashboard',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanFreelancer},\n\n${cleanClientName} approved "${cleanDeliverable}" (${cleanProject}).\n\nView here: ${safeUrl}`,
  };
}

export interface RevisionRequestedParams {
  freelancerName: string;
  clientName: string;
  projectName?: string;
  projectTitle?: string;
  deliverableTitle: string;
  revisionNotes?: string;
  feedback?: string;
  hasAttachment?: boolean;
  dashboardUrl?: string;
  deliverableUrl?: string;
}

export function renderRevisionRequestedEmail(params: RevisionRequestedParams) {
  const cleanProject = truncateText(params.projectName || params.projectTitle || 'Project Workspace', 200);
  const cleanFreelancer = truncateText(params.freelancerName, 200);
  const cleanClientName = truncateText(params.clientName, 200);
  const cleanDeliverable = truncateText(params.deliverableTitle, 200);
  const cleanFeedback = truncateText(params.feedback || params.revisionNotes || 'Client requested modifications', 2000);
  const safeUrl = sanitizeUrl(params.dashboardUrl || params.deliverableUrl);

  const project = escapeHtml(cleanProject);
  const freelancer = escapeHtml(cleanFreelancer);
  const clientName = escapeHtml(cleanClientName);
  const deliverableTitle = escapeHtml(cleanDeliverable);
  const feedbackText = escapeHtml(cleanFeedback);

  const contentHtml = `
    <p>Hello <strong>${freelancer}</strong>,</p>
    <p><strong>${clientName}</strong> has requested revisions for <strong>"${deliverableTitle}"</strong> in project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${clientName}</span></div>
      ${params.hasAttachment ? `<div class="info-row"><span class="info-label">Attachment</span><span class="info-value">Feedback File Uploaded</span></div>` : ''}
    </div>
    <div style="background-color: #1c1917; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 14px; margin: 16px 0;">
      <span style="font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase;">Client Feedback:</span>
      <p style="font-size: 13px; color: #f4f4f5; margin: 6px 0 0 0;">${feedbackText}</p>
    </div>
  `;

  return {
    subject: sanitizeHeader(`Revision Requested: "${cleanDeliverable}" by ${cleanClientName}`),
    html: renderEmailLayout({
      title: 'Revision Requested',
      previewText: `Client requested changes on "${cleanDeliverable}".`,
      contentHtml,
      ctaText: 'View Revision Details',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanFreelancer},\n\n${cleanClientName} requested revisions on "${cleanDeliverable}".\nFeedback: ${cleanFeedback}\n\nView here: ${safeUrl}`,
  };
}

export interface DocumentUploadedParams {
  recipientName: string;
  uploaderName: string;
  documentTitle: string;
  category: string;
  projectTitle?: string;
  documentUrl?: string;
  actionUrl?: string;
}

export function renderDocumentUploadedEmail(params: DocumentUploadedParams) {
  const cleanRecipient = truncateText(params.recipientName, 200);
  const cleanUploader = truncateText(params.uploaderName, 200);
  const cleanDocumentTitle = truncateText(params.documentTitle, 200);
  const cleanCategory = truncateText(params.category, 100);
  const cleanProjectTitle = params.projectTitle ? truncateText(params.projectTitle, 200) : null;
  const safeUrl = sanitizeUrl(params.actionUrl || params.documentUrl);

  const recipient = escapeHtml(cleanRecipient);
  const uploader = escapeHtml(cleanUploader);
  const documentTitle = escapeHtml(cleanDocumentTitle);
  const category = escapeHtml(cleanCategory);
  const projectTitle = cleanProjectTitle ? escapeHtml(cleanProjectTitle) : null;

  const contentHtml = `
    <p>Hello <strong>${recipient}</strong>,</p>
    <p><strong>${uploader}</strong> uploaded a new document to your shared workspace.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Document</span><span class="info-value">${documentTitle}</span></div>
      <div class="info-row"><span class="info-label">Category</span><span class="info-value">${category}</span></div>
      <div class="info-row"><span class="info-label">Uploaded By</span><span class="info-value">${uploader}</span></div>
      ${projectTitle ? `<div class="info-row"><span class="info-label">Project</span><span class="info-value">${projectTitle}</span></div>` : ''}
    </div>
  `;

  return {
    subject: sanitizeHeader(`New Document Uploaded: "${cleanDocumentTitle}"`),
    html: renderEmailLayout({
      title: 'New Document Uploaded',
      previewText: `${cleanUploader} uploaded "${cleanDocumentTitle}".`,
      contentHtml,
      ctaText: 'View Document',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanRecipient},\n\n${cleanUploader} uploaded "${cleanDocumentTitle}" (${cleanCategory}).\n\nView here: ${safeUrl}`,
  };
}

export interface InvoiceIssuedParams {
  clientName: string;
  freelancerName?: string;
  businessName?: string;
  invoiceNumber: string;
  amount?: string;
  amountFormatted?: string;
  dueDate: string;
  portalUrl?: string;
  invoiceUrl?: string;
}

export function renderInvoiceIssuedEmail(params: InvoiceIssuedParams) {
  const cleanSender = truncateText(params.businessName || params.freelancerName || 'FlowDesk Studio', 200);
  const cleanAmt = truncateText(params.amountFormatted || params.amount || '$0.00', 50);
  const cleanClientName = truncateText(params.clientName, 200);
  const cleanInvoiceNumber = truncateText(params.invoiceNumber, 100);
  const cleanDueDate = truncateText(params.dueDate, 50);
  const safeUrl = sanitizeUrl(params.portalUrl || params.invoiceUrl);

  const sender = escapeHtml(cleanSender);
  const amt = escapeHtml(cleanAmt);
  const clientName = escapeHtml(cleanClientName);
  const invoiceNumber = escapeHtml(cleanInvoiceNumber);
  const dueDate = escapeHtml(cleanDueDate);

  const contentHtml = `
    <p>Hello <strong>${clientName}</strong>,</p>
    <p><strong>${sender}</strong> has issued invoice <strong>#${invoiceNumber}</strong> for your account.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice Number</span><span class="info-value">#${invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Total Amount</span><span class="info-value" style="font-size: 15px; color: #ffffff;">${amt}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${dueDate}</span></div>
      <div class="info-row"><span class="info-label">Issued By</span><span class="info-value">${sender}</span></div>
    </div>
    <p>You can view the full line items, download a vector PDF, or settle the balance via your portal.</p>
  `;

  return {
    subject: sanitizeHeader(`Invoice #${cleanInvoiceNumber} from ${cleanSender} (${cleanAmt})`),
    html: renderEmailLayout({
      title: `Invoice #${cleanInvoiceNumber}`,
      previewText: `Invoice #${cleanInvoiceNumber} for ${cleanAmt} is due ${cleanDueDate}.`,
      contentHtml,
      ctaText: 'View Invoice',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanClientName},\n\nInvoice #${cleanInvoiceNumber} from ${cleanSender} for ${cleanAmt} is due ${cleanDueDate}.\n\nView invoice: ${safeUrl}`,
  };
}

export interface PaymentReceivedParams {
  recipientName: string;
  payerName?: string;
  freelancerName?: string;
  invoiceNumber: string;
  amount?: string;
  amountPaidFormatted?: string;
  balanceRemainingFormatted?: string;
  isFullyPaid?: boolean;
  paymentMethod?: string;
  paymentDate?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  actionUrl?: string;
}

export function renderPaymentReceivedEmail(params: PaymentReceivedParams) {
  const cleanAmt = truncateText(params.amountPaidFormatted || params.amount || '$0.00', 50);
  const cleanRecipient = truncateText(params.recipientName, 200);
  const cleanInvoiceNumber = truncateText(params.invoiceNumber, 100);
  const cleanMethod = truncateText(params.paymentMethod || 'Bank Transfer', 100);
  const cleanPaymentDate = params.paymentDate ? truncateText(params.paymentDate, 50) : null;
  const cleanReceiptNumber = params.receiptNumber ? truncateText(params.receiptNumber, 100) : null;
  const cleanBalance = params.balanceRemainingFormatted ? truncateText(params.balanceRemainingFormatted, 50) : null;
  const safeUrl = sanitizeUrl(params.actionUrl || params.receiptUrl);

  const amt = escapeHtml(cleanAmt);
  const isFull = params.isFullyPaid !== undefined ? params.isFullyPaid : true;
  const method = escapeHtml(cleanMethod);
  const recipient = escapeHtml(cleanRecipient);
  const invoiceNumber = escapeHtml(cleanInvoiceNumber);
  const paymentDate = cleanPaymentDate ? escapeHtml(cleanPaymentDate) : null;
  const receiptNumber = cleanReceiptNumber ? escapeHtml(cleanReceiptNumber) : null;
  const balance = cleanBalance ? escapeHtml(cleanBalance) : null;

  const contentHtml = `
    <p>Hello <strong>${recipient}</strong>,</p>
    <p>A payment of <strong>${amt}</strong> has been recorded for invoice <strong>#${invoiceNumber}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice</span><span class="info-value">#${invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value" style="color: #34d399;">${amt}</span></div>
      <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">${method}</span></div>
      ${paymentDate ? `<div class="info-row"><span class="info-label">Date</span><span class="info-value">${paymentDate}</span></div>` : ''}
      ${receiptNumber ? `<div class="info-row"><span class="info-label">Receipt #</span><span class="info-value">${receiptNumber}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Status</span><span class="info-value">${isFull ? 'Paid in Full' : 'Partially Paid'}</span></div>
      ${balance && !isFull ? `<div class="info-row"><span class="info-label">Remaining Balance</span><span class="info-value">${balance}</span></div>` : ''}
    </div>
  `;

  return {
    subject: sanitizeHeader(`Payment Confirmation: Invoice #${cleanInvoiceNumber} (${cleanAmt})`),
    html: renderEmailLayout({
      title: isFull ? 'Invoice Paid in Full' : 'Partial Payment Received',
      previewText: `Payment of ${cleanAmt} recorded for #${cleanInvoiceNumber}.`,
      contentHtml,
      ctaText: 'View Receipt & Invoice',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanRecipient},\n\nPayment of ${cleanAmt} recorded for Invoice #${cleanInvoiceNumber}.\n\nView here: ${safeUrl}`,
  };
}

export interface AccountLifecycleParams {
  name?: string;
  userName?: string;
  role?: 'client' | 'freelancer';
  action: 'scheduled_deletion' | 'deleted' | 'restored';
  gracePeriodDays?: number;
  restoreUntil?: string;
  restoreUntilDate?: string;
  restoreUrl?: string;
  actionUrl?: string;
}

export function renderAccountLifecycleEmail(params: AccountLifecycleParams) {
  const cleanUser = truncateText(params.userName || params.name || 'User', 200);
  const safeUrl = sanitizeUrl(params.actionUrl || params.restoreUrl);
  const cleanDeadline = params.restoreUntilDate || params.restoreUntil ? truncateText(params.restoreUntilDate || params.restoreUntil, 50) : null;

  const userDisplayName = escapeHtml(cleanUser);
  const deadline = cleanDeadline ? escapeHtml(cleanDeadline) : null;

  if (params.action === 'deleted' || params.action === 'scheduled_deletion') {
    const days = params.gracePeriodDays || (params.role === 'client' ? 30 : 5);
    const contentHtml = `
      <p>Hello <strong>${userDisplayName}</strong>,</p>
      <p>Your FlowDesk account has been placed in <strong>Pending Deletion</strong> status.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Account</span><span class="info-value">${userDisplayName}</span></div>
        <div class="info-row"><span class="info-label">Grace Period</span><span class="info-value">${days} Days</span></div>
        ${deadline ? `<div class="info-row"><span class="info-label">Restore Deadline</span><span class="info-value">${deadline}</span></div>` : ''}
      </div>
      <p>If this was intentional, you do not need to take any action. After the recovery period, all associated records and files will be permanently purged.</p>
      <p>If this was a mistake, you can restore your account before the deadline:</p>
    `;

  return {
    subject: sanitizeHeader(`Security Alert: FlowDesk Account Deletion Initiated`),
    html: renderEmailLayout({
      title: 'Account Scheduled for Deletion',
      previewText: `Your FlowDesk account is in the ${days}-day recovery period.`,
      contentHtml,
      ctaText: 'Manage / Restore Account',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour FlowDesk account is scheduled for deletion (${days}-day grace period).\n\nRestore here if needed: ${safeUrl}`,
  };
  }

  // Restored
  const contentHtml = `
    <p>Hello <strong>${userDisplayName}</strong>,</p>
    <p>Your FlowDesk account has been successfully restored. All projects, deliverables, documents, and invoices are active.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Account</span><span class="info-value">${userDisplayName}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color: #34d399;">Active</span></div>
    </div>
  `;

  return {
    subject: sanitizeHeader(`Security Alert: FlowDesk Account Restored`),
    html: renderEmailLayout({
      title: 'Account Successfully Restored',
      previewText: 'Your FlowDesk account and workspace are active.',
      contentHtml,
      ctaText: 'Log In to FlowDesk',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour FlowDesk account has been restored.\n\nLog in here: ${safeUrl}`,
  };
}

export interface SecurityAlertParams {
  userName?: string;
  name?: string;
  eventType: string;
  details: string;
  actionUrl?: string;
}

export function renderSecurityAlertEmail(params: SecurityAlertParams) {
  const cleanUser = truncateText(params.userName || params.name || 'User', 200);
  const cleanEventType = truncateText(params.eventType, 100);
  const cleanDetails = truncateText(params.details, 2000);
  const safeUrl = sanitizeUrl(params.actionUrl);

  const userDisplayName = escapeHtml(cleanUser);
  const eventType = escapeHtml(cleanEventType);
  const details = escapeHtml(cleanDetails);

  const contentHtml = `
    <p>Hello <strong>${userDisplayName}</strong>,</p>
    <p>A security event occurred on your FlowDesk account:</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Event</span><span class="info-value">${eventType}</span></div>
      <div class="info-row"><span class="info-label">Time</span><span class="info-value">${new Date().toUTCString()}</span></div>
    </div>
    <p>${details}</p>
    <p>If you did not authorize this action, please reset your password immediately.</p>
  `;

  return {
    subject: sanitizeHeader(`Security Alert: ${cleanEventType}`),
    html: renderEmailLayout({
      title: 'Security Alert',
      previewText: `Security event on your FlowDesk account: ${cleanEventType}`,
      contentHtml,
      ctaText: 'Review Security Settings',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nSecurity event: ${cleanEventType}\nDetails: ${cleanDetails}\n\nReview: ${safeUrl}`,
  };
}

// ==========================================
// Billing & Subscription Templates
// ==========================================

export interface BillingTrialEndingParams {
  userName?: string;
  workspaceName?: string;
  daysRemaining: number;
  upgradeUrl: string;
}

export function renderBillingTrialEndingEmail(params: BillingTrialEndingParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const safeUrl = sanitizeUrl(params.upgradeUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Your free Pro trial for <strong>${workspaceName}</strong> will conclude in <strong>${params.daysRemaining} days</strong>.</p>
    <p>To continue enjoying unlimited projects, branded client portals, and automated reminders without interruption, upgrade your workspace subscription.</p>
  `;

  return {
    subject: sanitizeHeader(`Your FlowDesk Pro trial ends in ${params.daysRemaining} days`),
    html: renderEmailLayout({
      title: 'Pro Trial Ending Soon',
      previewText: `Your Pro trial ends in ${params.daysRemaining} days. Upgrade to maintain uninterrupted access.`,
      contentHtml,
      ctaText: 'Upgrade Workspace Plan',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour Pro trial for ${cleanWorkspace} ends in ${params.daysRemaining} days.\n\nUpgrade here: ${safeUrl}`,
  };
}

export interface BillingPaymentFailedParams {
  userName?: string;
  workspaceName?: string;
  planName: string;
  updateUrl: string;
  reason?: string;
}

export function renderBillingPaymentFailedEmail(params: BillingPaymentFailedParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const cleanPlan = truncateText(params.planName, 100);
  const cleanReason = truncateText(params.reason || 'Card charge declined by issuer', 200);
  const safeUrl = sanitizeUrl(params.updateUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);
  const planName = escapeHtml(cleanPlan);
  const reason = escapeHtml(cleanReason);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>We were unable to process the recurring payment for your <strong>${planName}</strong> plan on workspace <strong>${workspaceName}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value">Payment Failed</span></div>
      <div class="info-row"><span class="info-label">Reason</span><span class="info-value">${reason}</span></div>
    </div>
    <p>Razorpay will automatically re-attempt this charge over the next few days. You can also update your payment method now to prevent service interruptions.</p>
  `;

  return {
    subject: sanitizeHeader(`Action Required: Payment failed for ${cleanWorkspace}`),
    html: renderEmailLayout({
      title: 'Payment Failed',
      previewText: `Recurring subscription charge failed for ${cleanPlan}. Please update your payment method.`,
      contentHtml,
      ctaText: 'Update Payment Method',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nRecurring payment failed for ${cleanPlan} on ${cleanWorkspace}.\n\nUpdate your card: ${safeUrl}`,
  };
}

export interface BillingGraceEndingSoonParams {
  userName?: string;
  workspaceName?: string;
  daysRemaining: number;
  updateUrl: string;
}

export function renderBillingGraceEndingSoonEmail(params: BillingGraceEndingSoonParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const safeUrl = sanitizeUrl(params.updateUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>This is a final notice regarding your FlowDesk workspace <strong>${workspaceName}</strong>.</p>
    <p>Your workspace is currently in a grace period which will expire in <strong>${params.daysRemaining} days</strong>. Once the grace period concludes, creating new projects, clients, and invoices will be temporarily locked.</p>
    <p>Your client data and invoices will remain safe and accessible.</p>
  `;

  return {
    subject: sanitizeHeader(`Important: ${params.daysRemaining} days left in your workspace grace period`),
    html: renderEmailLayout({
      title: 'Grace Period Ending Soon',
      previewText: `Final notice: ${params.daysRemaining} days until workspace access is restricted.`,
      contentHtml,
      ctaText: 'Restore Full Access',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour workspace grace period expires in ${params.daysRemaining} days.\n\nRestore access: ${safeUrl}`,
  };
}

export interface BillingSubscriptionCanceledParams {
  userName?: string;
  workspaceName?: string;
  planName: string;
  effectiveDate: string;
  resubscribeUrl: string;
}

export function renderBillingSubscriptionCanceledEmail(params: BillingSubscriptionCanceledParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const cleanPlan = truncateText(params.planName, 100);
  const cleanDate = truncateText(params.effectiveDate, 100);
  const safeUrl = sanitizeUrl(params.resubscribeUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);
  const planName = escapeHtml(cleanPlan);
  const effectiveDate = escapeHtml(cleanDate);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Your subscription to <strong>${planName}</strong> for workspace <strong>${workspaceName}</strong> has been cancelled.</p>
    <p>You will retain full access until <strong>${effectiveDate}</strong>, after which your workspace will automatically revert to the Free Starter tier.</p>
    <p>All of your existing clients, projects, and deliverables will remain safely stored.</p>
  `;

  return {
    subject: sanitizeHeader(`Subscription cancelled for ${cleanWorkspace}`),
    html: renderEmailLayout({
      title: 'Subscription Cancelled',
      previewText: `Your subscription to ${cleanPlan} will end on ${cleanDate}.`,
      contentHtml,
      ctaText: 'Manage Subscription',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour subscription to ${cleanPlan} for ${cleanWorkspace} was cancelled and will end on ${cleanDate}.\n\nManage: ${safeUrl}`,
  };
}

export interface BillingSubscriptionActivatedParams {
  userName?: string;
  workspaceName?: string;
  planName: string;
  interval: string;
  dashboardUrl: string;
}

export function renderBillingSubscriptionActivatedEmail(params: BillingSubscriptionActivatedParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const cleanPlan = truncateText(params.planName, 100);
  const cleanInterval = truncateText(params.interval, 50);
  const safeUrl = sanitizeUrl(params.dashboardUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);
  const planName = escapeHtml(cleanPlan);
  const interval = escapeHtml(cleanInterval);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Thank you for subscribing! Your workspace <strong>${workspaceName}</strong> is now upgraded to <strong>${planName} (${interval})</strong>.</p>
    <p>All higher limits and premium features are immediately available in your studio dashboard.</p>
  `;

  return {
    subject: sanitizeHeader(`Welcome to ${cleanPlan} on FlowDesk!`),
    html: renderEmailLayout({
      title: 'Subscription Activated',
      previewText: `Your workspace is now live on ${cleanPlan}.`,
      contentHtml,
      ctaText: 'Go to Workspace Dashboard',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour subscription to ${cleanPlan} is now active!\n\nOpen workspace: ${safeUrl}`,
  };
}

export interface BillingPlanChangedParams {
  userName?: string;
  workspaceName?: string;
  oldPlanName: string;
  newPlanName: string;
  dashboardUrl: string;
}

export function renderBillingPlanChangedEmail(params: BillingPlanChangedParams) {
  const cleanUser = truncateText(params.userName || 'Creator', 200);
  const cleanWorkspace = truncateText(params.workspaceName || 'Your Workspace', 200);
  const cleanOld = truncateText(params.oldPlanName, 100);
  const cleanNew = truncateText(params.newPlanName, 100);
  const safeUrl = sanitizeUrl(params.dashboardUrl);

  const userName = escapeHtml(cleanUser);
  const workspaceName = escapeHtml(cleanWorkspace);
  const oldPlan = escapeHtml(cleanOld);
  const newPlan = escapeHtml(cleanNew);

  const contentHtml = `
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Your subscription for <strong>${workspaceName}</strong> has been updated from <strong>${oldPlan}</strong> to <strong>${newPlan}</strong>.</p>
    <p>Your revised entitlements are active and your next recurring invoice will reflect this change.</p>
  `;

  return {
    subject: sanitizeHeader(`Plan updated to ${cleanNew} for ${cleanWorkspace}`),
    html: renderEmailLayout({
      title: 'Plan Updated',
      previewText: `Your workspace plan has been changed to ${cleanNew}.`,
      contentHtml,
      ctaText: 'View Studio Settings',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanUser},\n\nYour plan for ${cleanWorkspace} was updated to ${cleanNew}.\n\nView settings: ${safeUrl}`,
  };
}

export interface InvoiceReminderParams {
  clientName: string;
  freelancerName?: string;
  businessName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  remainingBalanceFormatted?: string;
  dueDate: string;
  portalUrl?: string;
  stage: 'before_due' | 'due_date' | 'after_due';
}

export function renderInvoiceReminderEmail(params: InvoiceReminderParams) {
  const cleanSender = truncateText(params.businessName || params.freelancerName || 'FlowDesk Studio', 200);
  const cleanAmt = truncateText(params.remainingBalanceFormatted || params.amountFormatted || '$0.00', 50);
  const cleanClientName = truncateText(params.clientName, 200);
  const cleanInvoiceNumber = truncateText(params.invoiceNumber, 100);
  const cleanDueDate = truncateText(params.dueDate, 50);
  const safeUrl = sanitizeUrl(params.portalUrl);

  const sender = escapeHtml(cleanSender);
  const amt = escapeHtml(cleanAmt);
  const clientName = escapeHtml(cleanClientName);
  const invoiceNumber = escapeHtml(cleanInvoiceNumber);
  const dueDate = escapeHtml(cleanDueDate);

  let title = `Payment Reminder: Invoice #${cleanInvoiceNumber}`;
  let subjectPrefix = 'Reminder:';
  let messageBody = `<p>This is a friendly reminder that invoice <strong>#${invoiceNumber}</strong> for <strong>${amt}</strong> is due on <strong>${dueDate}</strong>.</p>`;

  if (params.stage === 'before_due') {
    title = `Upcoming Payment: Invoice #${cleanInvoiceNumber}`;
    subjectPrefix = 'Upcoming Payment:';
    messageBody = `<p>This is a quick courtesy note that invoice <strong>#${invoiceNumber}</strong> from <strong>${sender}</strong> will be due on <strong>${dueDate}</strong>.</p>`;
  } else if (params.stage === 'due_date') {
    title = `Due Today: Invoice #${cleanInvoiceNumber}`;
    subjectPrefix = 'Due Today:';
    messageBody = `<p>This is a reminder that invoice <strong>#${invoiceNumber}</strong> from <strong>${sender}</strong> is due for payment today, <strong>${dueDate}</strong>.</p>`;
  } else if (params.stage === 'after_due') {
    title = `Overdue Notice: Invoice #${cleanInvoiceNumber}`;
    subjectPrefix = 'Overdue Notice:';
    messageBody = `<p>Our records show that payment for invoice <strong>#${invoiceNumber}</strong> from <strong>${sender}</strong> was due on <strong>${dueDate}</strong> and is currently overdue.</p>`;
  }

  const contentHtml = `
    <p>Hello <strong>${clientName}</strong>,</p>
    ${messageBody}
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice Number</span><span class="info-value">#${invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Remaining Balance</span><span class="info-value" style="font-size: 15px; color: #ffffff;">${amt}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${dueDate}</span></div>
      <div class="info-row"><span class="info-label">Issued By</span><span class="info-value">${sender}</span></div>
    </div>
    <p>Please review and settle the outstanding balance through your secure portal link below.</p>
  `;

  return {
    subject: sanitizeHeader(`${subjectPrefix} Invoice #${cleanInvoiceNumber} from ${cleanSender} (${cleanAmt})`),
    html: renderEmailLayout({
      title,
      previewText: `Payment reminder for Invoice #${cleanInvoiceNumber} (${cleanAmt}).`,
      contentHtml,
      ctaText: 'Review & Pay Invoice',
      ctaUrl: safeUrl,
    }),
    text: `Hello ${cleanClientName},\n\nPayment reminder for Invoice #${cleanInvoiceNumber} from ${cleanSender}.\nBalance: ${cleanAmt}\nDue Date: ${cleanDueDate}\n\nReview invoice: ${safeUrl}`,
  };
}




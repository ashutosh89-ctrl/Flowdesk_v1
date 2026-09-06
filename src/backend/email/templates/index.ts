import { renderEmailLayout } from './layout';

export interface ClientInvitationParams {
  clientName: string;
  freelancerName: string;
  businessName?: string;
  portalUrl: string;
}

export function renderClientInvitationEmail(params: ClientInvitationParams) {
  const sender = params.businessName || params.freelancerName || 'FlowDesk Studio';
  const contentHtml = `
    <p>Hello <strong>${params.clientName}</strong>,</p>
    <p><strong>${sender}</strong> has invited you to access your dedicated collaboration portal on FlowDesk.</p>
    <p>From your portal, you can review deliverables, approve milestones, upload brand assets, and view invoices in one secure place.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${params.clientName}</span></div>
      <div class="info-row"><span class="info-label">Invited By</span><span class="info-value">${sender}</span></div>
      <div class="info-row"><span class="info-label">Access Type</span><span class="info-value">Client Collaboration Portal</span></div>
    </div>
    <p>Click below to enter your workspace:</p>
  `;

  return {
    subject: `Invitation: Access your client portal from ${sender}`,
    html: renderEmailLayout({
      title: 'Welcome to your Client Portal',
      previewText: `${sender} has invited you to collaborate on FlowDesk.`,
      contentHtml,
      ctaText: 'Enter Client Portal',
      ctaUrl: params.portalUrl,
    }),
    text: `Hello ${params.clientName},\n\n${sender} has invited you to your dedicated collaboration portal on FlowDesk.\n\nAccess your portal here: ${params.portalUrl}\n\nFlowDesk Team`,
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
  const project = params.projectName || params.projectTitle || 'Project Workspace';
  const ver = params.version || params.versionNumber || 'v1.0';
  const freelancer = params.freelancerName || 'Freelancer';

  const contentHtml = `
    <p>Hello <strong>${params.clientName}</strong>,</p>
    <p>A new deliverable is ready for your review and feedback in project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${params.deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Version</span><span class="info-value">${ver}</span></div>
      <div class="info-row"><span class="info-label">Submitted By</span><span class="info-value">${freelancer}</span></div>
    </div>
    <p>Please review the asset and approve or request revisions.</p>
  `;

  return {
    subject: `Deliverable Ready for Review: "${params.deliverableTitle}" (${project})`,
    html: renderEmailLayout({
      title: 'New Deliverable Ready for Review',
      previewText: `"${params.deliverableTitle}" has been submitted for review.`,
      contentHtml,
      ctaText: 'Review Deliverable',
      ctaUrl: params.portalUrl,
    }),
    text: `Hello ${params.clientName},\n\n"${params.deliverableTitle}" (${project}) is ready for review.\n\nReview it here: ${params.portalUrl}`,
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
  const project = params.projectName || params.projectTitle || 'Project Workspace';
  const url = params.dashboardUrl || params.deliverableUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${params.freelancerName}</strong>,</p>
    <p>Great news! <strong>${params.clientName}</strong> has approved your deliverable <strong>"${params.deliverableTitle}"</strong> for project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${params.clientName}</span></div>
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${params.deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color: #34d399;">Approved</span></div>
    </div>
    ${params.notes ? `<p style="font-size: 13px; color: #d4d4d8;"><strong>Client Notes:</strong> "${params.notes}"</p>` : ''}
  `;

  return {
    subject: `Deliverable Approved: "${params.deliverableTitle}" by ${params.clientName}`,
    html: renderEmailLayout({
      title: 'Deliverable Approved!',
      previewText: `${params.clientName} approved "${params.deliverableTitle}".`,
      contentHtml,
      ctaText: 'View in Dashboard',
      ctaUrl: url,
    }),
    text: `Hello ${params.freelancerName},\n\n${params.clientName} approved "${params.deliverableTitle}" (${project}).\n\nView here: ${url}`,
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
  const project = params.projectName || params.projectTitle || 'Project Workspace';
  const feedbackText = params.feedback || params.revisionNotes || 'Client requested modifications';
  const url = params.dashboardUrl || params.deliverableUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${params.freelancerName}</strong>,</p>
    <p><strong>${params.clientName}</strong> has requested revisions for <strong>"${params.deliverableTitle}"</strong> in project <strong>${project}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${project}</span></div>
      <div class="info-row"><span class="info-label">Deliverable</span><span class="info-value">${params.deliverableTitle}</span></div>
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${params.clientName}</span></div>
      ${params.hasAttachment ? `<div class="info-row"><span class="info-label">Attachment</span><span class="info-value">Feedback File Uploaded</span></div>` : ''}
    </div>
    <div style="background-color: #1c1917; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 14px; margin: 16px 0;">
      <span style="font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase;">Client Feedback:</span>
      <p style="font-size: 13px; color: #f4f4f5; margin: 6px 0 0 0;">${feedbackText}</p>
    </div>
  `;

  return {
    subject: `Revision Requested: "${params.deliverableTitle}" by ${params.clientName}`,
    html: renderEmailLayout({
      title: 'Revision Requested',
      previewText: `Client requested changes on "${params.deliverableTitle}".`,
      contentHtml,
      ctaText: 'View Revision Details',
      ctaUrl: url,
    }),
    text: `Hello ${params.freelancerName},\n\n${params.clientName} requested revisions on "${params.deliverableTitle}".\nFeedback: ${feedbackText}\n\nView here: ${url}`,
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
  const url = params.actionUrl || params.documentUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.uploaderName}</strong> uploaded a new document to your shared workspace.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Document</span><span class="info-value">${params.documentTitle}</span></div>
      <div class="info-row"><span class="info-label">Category</span><span class="info-value">${params.category}</span></div>
      <div class="info-row"><span class="info-label">Uploaded By</span><span class="info-value">${params.uploaderName}</span></div>
      ${params.projectTitle ? `<div class="info-row"><span class="info-label">Project</span><span class="info-value">${params.projectTitle}</span></div>` : ''}
    </div>
  `;

  return {
    subject: `New Document Uploaded: "${params.documentTitle}"`,
    html: renderEmailLayout({
      title: 'New Document Uploaded',
      previewText: `${params.uploaderName} uploaded "${params.documentTitle}".`,
      contentHtml,
      ctaText: 'View Document',
      ctaUrl: url,
    }),
    text: `Hello ${params.recipientName},\n\n${params.uploaderName} uploaded "${params.documentTitle}" (${params.category}).\n\nView here: ${url}`,
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
  const sender = params.businessName || params.freelancerName || 'FlowDesk Studio';
  const amt = params.amountFormatted || params.amount || '$0.00';
  const url = params.portalUrl || params.invoiceUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${params.clientName}</strong>,</p>
    <p><strong>${sender}</strong> has issued invoice <strong>#${params.invoiceNumber}</strong> for your account.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice Number</span><span class="info-value">#${params.invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Total Amount</span><span class="info-value" style="font-size: 15px; color: #ffffff;">${amt}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${params.dueDate}</span></div>
      <div class="info-row"><span class="info-label">Issued By</span><span class="info-value">${sender}</span></div>
    </div>
    <p>You can view the full line items, download a vector PDF, or settle the balance via your portal.</p>
  `;

  return {
    subject: `Invoice #${params.invoiceNumber} from ${sender} (${amt})`,
    html: renderEmailLayout({
      title: `Invoice #${params.invoiceNumber}`,
      previewText: `Invoice #${params.invoiceNumber} for ${amt} is due ${params.dueDate}.`,
      contentHtml,
      ctaText: 'View Invoice',
      ctaUrl: url,
    }),
    text: `Hello ${params.clientName},\n\nInvoice #${params.invoiceNumber} from ${sender} for ${amt} is due ${params.dueDate}.\n\nView invoice: ${url}`,
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
  const amt = params.amountPaidFormatted || params.amount || '$0.00';
  const isFull = params.isFullyPaid !== undefined ? params.isFullyPaid : true;
  const method = params.paymentMethod || 'Bank Transfer';
  const url = params.actionUrl || params.receiptUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${params.recipientName}</strong>,</p>
    <p>A payment of <strong>${amt}</strong> has been recorded for invoice <strong>#${params.invoiceNumber}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Invoice</span><span class="info-value">#${params.invoiceNumber}</span></div>
      <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value" style="color: #34d399;">${amt}</span></div>
      <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">${method}</span></div>
      ${params.paymentDate ? `<div class="info-row"><span class="info-label">Date</span><span class="info-value">${params.paymentDate}</span></div>` : ''}
      ${params.receiptNumber ? `<div class="info-row"><span class="info-label">Receipt #</span><span class="info-value">${params.receiptNumber}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Status</span><span class="info-value">${isFull ? 'Paid in Full' : 'Partially Paid'}</span></div>
      ${params.balanceRemainingFormatted && !isFull ? `<div class="info-row"><span class="info-label">Remaining Balance</span><span class="info-value">${params.balanceRemainingFormatted}</span></div>` : ''}
    </div>
  `;

  return {
    subject: `Payment Confirmation: Invoice #${params.invoiceNumber} (${amt})`,
    html: renderEmailLayout({
      title: isFull ? 'Invoice Paid in Full' : 'Partial Payment Received',
      previewText: `Payment of ${amt} recorded for #${params.invoiceNumber}.`,
      contentHtml,
      ctaText: 'View Receipt & Invoice',
      ctaUrl: url,
    }),
    text: `Hello ${params.recipientName},\n\nPayment of ${amt} recorded for Invoice #${params.invoiceNumber}.\n\nView here: ${url}`,
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
  const userDisplayName = params.userName || params.name || 'User';
  const url = params.actionUrl || params.restoreUrl || '#';
  const deadline = params.restoreUntilDate || params.restoreUntil;

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
      subject: `Security Alert: FlowDesk Account Deletion Initiated`,
      html: renderEmailLayout({
        title: 'Account Scheduled for Deletion',
        previewText: `Your FlowDesk account is in the ${days}-day recovery period.`,
        contentHtml,
        ctaText: 'Manage / Restore Account',
        ctaUrl: url,
      }),
      text: `Hello ${userDisplayName},\n\nYour FlowDesk account is scheduled for deletion (${days}-day grace period).\n\nRestore here if needed: ${url}`,
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
    subject: `Security Alert: FlowDesk Account Restored`,
    html: renderEmailLayout({
      title: 'Account Successfully Restored',
      previewText: 'Your FlowDesk account and workspace are active.',
      contentHtml,
      ctaText: 'Log In to FlowDesk',
      ctaUrl: url,
    }),
    text: `Hello ${userDisplayName},\n\nYour FlowDesk account has been restored.\n\nLog in here: ${url}`,
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
  const userDisplayName = params.userName || params.name || 'User';
  const url = params.actionUrl || '#';

  const contentHtml = `
    <p>Hello <strong>${userDisplayName}</strong>,</p>
    <p>A security event occurred on your FlowDesk account:</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Event</span><span class="info-value">${params.eventType}</span></div>
      <div class="info-row"><span class="info-label">Time</span><span class="info-value">${new Date().toUTCString()}</span></div>
    </div>
    <p>${params.details}</p>
    <p>If you did not authorize this action, please reset your password immediately.</p>
  `;

  return {
    subject: `Security Alert: ${params.eventType}`,
    html: renderEmailLayout({
      title: 'Security Alert',
      previewText: `Security event on your FlowDesk account: ${params.eventType}`,
      contentHtml,
      ctaText: 'Review Security Settings',
      ctaUrl: url,
    }),
    text: `Hello ${userDisplayName},\n\nSecurity event: ${params.eventType}\nDetails: ${params.details}\n\nReview: ${url}`,
  };
}

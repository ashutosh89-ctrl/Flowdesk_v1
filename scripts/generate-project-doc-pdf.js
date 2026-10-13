const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;

const OUTPUT_FILE = path.join(__dirname, '..', 'FlowDesk_Comprehensive_Project_Documentation.pdf');

// Create document in A4 Portrait mode (210 x 297 mm)
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
  putOnlyUsedFonts: true,
  floatPrecision: 16
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 15;
const contentWidth = pageWidth - (margin * 2);

// Theme Palette (FlowDesk modern slate / indigo theme)
const colors = {
  primary: [15, 23, 42],      // Slate 900
  primaryLight: [30, 41, 59], // Slate 800
  accent: [79, 70, 229],      // Indigo 600
  accentLight: [238, 242, 255],// Indigo 50
  accentText: [67, 56, 202],  // Indigo 700
  secondary: [100, 116, 139], // Slate 500
  text: [30, 41, 59],         // Slate 800
  textLight: [71, 85, 105],   // Slate 600
  textMuted: [148, 163, 184], // Slate 400
  bgLight: [248, 250, 252],   // Slate 50
  border: [226, 232, 240],    // Slate 200
  success: [16, 185, 129],    // Emerald 500
  warning: [245, 158, 11],    // Amber 500
  danger: [239, 68, 68],      // Rose 500
  cardBg: [255, 255, 255]
};

let currentY = margin;

function checkPageBreak(requiredHeight) {
  if (currentY + requiredHeight > pageHeight - 20) {
    doc.addPage();
    currentY = margin + 12; // Extra padding for top header on subsequent pages
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// COVER PAGE
// -------------------------------------------------------------
function renderCoverPage() {
  // Background gradient-like card
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 110, 'F');

  // Decorative accent line
  doc.setFillColor(...colors.accent);
  doc.rect(0, 110, pageWidth, 4, 'F');

  // App Category / Badge
  doc.setFillColor(...colors.accentText);
  doc.roundedRect(margin, 25, 65, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FREELANCER OPERATING SYSTEM', margin + 3, 30.5);

  // Main Title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('FlowDesk', margin, 48);

  // Subtitle
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text('Complete Technical Architecture & System Guide', margin, 58);

  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  const tagLine = 'A unified workspace connecting client CRM, projects, versioned deliverables, approvals, contracts, automated multi-currency invoicing, and Razorpay payment tracking.';
  const splitTagLine = doc.splitTextToSize(tagLine, contentWidth);
  doc.text(splitTagLine, margin, 70);

  // Meta details bar
  doc.setFillColor(255, 255, 255, 0.1);
  doc.roundedRect(margin, 88, contentWidth, 14, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Stack: Next.js 15 | React 19 | TypeScript | Tailwind CSS | Supabase RLS | Razorpay | Brevo', margin + 4, 96.5);

  currentY = 125;

  // Key Specifications Card Grid
  const cards = [
    { title: 'Full-Stack Architecture', desc: 'Next.js 15 App Router with TypeScript, server-side actions, route handlers, and modular frontend components.' },
    { title: 'Dual Auth & Security', desc: 'Production Supabase Auth with Row-Level Security (RLS) and standalone demo mode for testing.' },
    { title: 'Financial Engine', desc: 'Multi-currency invoice calculation, dynamic PDF generator, tax/discount logic, and Razorpay payment gateway.' },
    { title: 'Client Engagement Portal', desc: 'Secure client portal for interactive deliverable review, approval workflows, comments, and invoice checkout.' }
  ];

  const cardWidth = (contentWidth - 6) / 2;
  const cardHeight = 30;

  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (cardWidth + 6);
    const y = currentY + row * (cardHeight + 6);

    doc.setFillColor(...colors.bgLight);
    doc.setDrawColor(...colors.border);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    // Colored accent pill
    doc.setFillColor(...colors.accent);
    doc.circle(x + 5, y + 8, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text(card.title, x + 10, y + 9.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textLight);
    const splitDesc = doc.splitTextToSize(card.desc, cardWidth - 12);
    doc.text(splitDesc, x + 5, y + 17);
  });

  currentY += (cardHeight * 2) + 18;

  // Metadata Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.primary);
  doc.text('Document Metadata & Release Information', margin, currentY);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Attribute', 'Project Specification']],
    body: [
      ['Repository', 'https://github.com/ashutosh89-ctrl/Flowdesk_v1.git'],
      ['Framework & Runtime', 'Next.js 15.4.9 (App Router) / Node.js 20+ / React 19.2.1'],
      ['Styling & UI', 'Tailwind CSS v4, Lucide Icons, Framer Motion'],
      ['Database Engine', 'PostgreSQL (Supabase) with Multi-Tenant Row Level Security'],
      ['Payment Gateway', 'Razorpay Standard Checkout & Webhooks with Idempotency'],
      ['Transactional Email', 'Brevo (Sendinblue) API & Resend Engine with HTML Templates'],
      ['Document & PDF Engine', 'jsPDF, jspdf-autotable, html2canvas client/server renderer'],
      ['AI Model Integration', 'Google Gemini API (@google/genai SDK v2.4.0)'],
      ['Generated On', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]
    ],
    headStyles: {
      fillColor: colors.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: colors.text
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: colors.bgLight },
      1: { cellWidth: contentWidth - 50 }
    },
    margin: { left: margin, right: margin }
  });

  doc.addPage();
  currentY = margin + 12;
}

// -------------------------------------------------------------
// SECTION HEADERS & CONTENT HELPERS
// -------------------------------------------------------------
function renderSectionHeader(num, title) {
  checkPageBreak(25);
  doc.setFillColor(...colors.accentLight);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
  
  doc.setFillColor(...colors.accent);
  doc.rect(margin, currentY, 3, 10, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.accentText);
  doc.text(`Section ${num}: ${title}`, margin + 6, currentY + 6.8);
  currentY += 15;
}

function renderSubSectionHeader(title) {
  checkPageBreak(15);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.primary);
  doc.text(title, margin, currentY);
  currentY += 5;
}

function renderParagraph(text) {
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.text);
  const lines = doc.splitTextToSize(text, contentWidth);
  checkPageBreak(lines.length * 4.2 + 4);
  doc.text(lines, margin, currentY);
  currentY += lines.length * 4.2 + 3;
}

function renderCallout(title, text, type = 'info') {
  const bgColor = type === 'warning' ? [254, 243, 199] : colors.accentLight;
  const barColor = type === 'warning' ? colors.warning : colors.accent;
  const textColor = type === 'warning' ? [146, 64, 14] : colors.accentText;

  doc.setFontSize(8);
  const splitText = doc.splitTextToSize(text, contentWidth - 10);
  const height = 8 + (splitText.length * 3.8);

  checkPageBreak(height + 4);
  doc.setFillColor(...bgColor);
  doc.roundedRect(margin, currentY, contentWidth, height, 1.5, 1.5, 'F');
  doc.setFillColor(...barColor);
  doc.rect(margin, currentY, 2.5, height, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(title, margin + 5, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.text);
  doc.text(splitText, margin + 5, currentY + 9.5);

  currentY += height + 4;
}

// -------------------------------------------------------------
// SECTION 1: EXECUTIVE SUMMARY & PRODUCT OVERVIEW
// -------------------------------------------------------------
function renderSection1() {
  renderSectionHeader(1, 'Executive Summary & Product Vision');

  renderParagraph(
    'FlowDesk is a comprehensive, production-grade Freelancer Operating System designed to address the fragmentation inherent in modern solo business operations. Freelancers, digital agencies, and independent consultants traditionally rely on 5 to 7 disparate SaaS tools (CRM, cloud storage, document signing, deliverable proofing, invoice generation, payment gateways, and email alerts). FlowDesk unifies the entire client lifecycle into an interconnected, single-pane-of-glass workspace.'
  );

  renderSubSectionHeader('The End-to-End Client Value Loop');
  renderParagraph(
    'The application is architected around a strict hierarchical relational pipeline: Client -> Project -> Documents & Specifications -> Deliverable Submissions -> Interactive Approval / Revision Cycle -> Itemized Multi-Currency Invoice -> Online Payment Gateway Settlement & Audit Logging.'
  );

  const workflowSteps = [
    ['1. Client Management', 'Centralized client CRM recording contacts, active engagements, lifetime billing totals, status flags, and unique invitation tokens.'],
    ['2. Project Scoping', 'Milestone planning, deliverable schedules, budgets, burn rates, deadlines, and real-time completion tracking.'],
    ['3. Document Repository', 'Storage and requirement tracking for contracts, creative briefs, master service agreements, and client asset uploads.'],
    ['4. Deliverables & Iterations', 'Upload files with semantic versioning (v1.0, v1.1, v2.0), status badges, internal notes, and one-click client review requests.'],
    ['5. Interactive Client Portal', 'Dedicated client interface allowing stakeholders to inspect work, request revisions with timestamped annotations, or execute approvals.'],
    ['6. Invoicing Engine', 'Itemized billing with custom tax percentages, discounts, dynamic number-to-words currency formatting, and instant PDF downloads.'],
    ['7. Payment Settlement', 'Integrated Razorpay Checkout supporting Card, UPI, Netbanking, automatic status reconciliation, and immutable ledger recording.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'striped',
    head: [['Stage', 'Functional Role & Capability']],
    body: workflowSteps,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: contentWidth - 45 } },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;
}

// -------------------------------------------------------------
// SECTION 2: ARCHITECTURAL OVERVIEW & TECHNOLOGY STACK
// -------------------------------------------------------------
function renderSection2() {
  renderSectionHeader(2, 'System Architecture & Technology Stack');

  renderParagraph(
    'FlowDesk utilizes the Next.js 15 App Router with full TypeScript strictness. The application is designed around clean layered separation between the presentation tier (frontend views and modals), the server orchestration tier (Next.js API routes and middleware), and the data storage tier (Supabase PostgreSQL / Browser LocalStorage).'
  );

  const techStackData = [
    ['Frontend Framework', 'Next.js 15.4.9 (App Router)', 'Server-side rendering, React Server Components, dynamic client-side interactivity, fast routing.'],
    ['User Interface Library', 'React 19.2.1 + Tailwind CSS v4', 'Custom design system with CSS custom properties, glassmorphism, responsive grid layouts.'],
    ['Icons & Animations', 'Lucide React + Motion (Framer)', 'Rich iconography and micro-interactions for polished user feedback and state transitions.'],
    ['Database & Auth', 'Supabase (PostgreSQL 15+)', 'Row Level Security (RLS) multi-tenancy, UUID primary keys, relational foreign keys, cascade deletes.'],
    ['Payment Gateway', 'Razorpay SDK v2.9.8', 'Order creation, SHA-256 HMAC signature verification, webhook reconciliation, test/live credentials.'],
    ['Email Communications', 'Brevo API v6.26 & Resend', 'Transactional emails for client connection invitations, deliverable reviews, approvals, and invoice notices.'],
    ['Document & PDF Engine', 'jsPDF & jspdf-autotable', 'Client-side and server-side PDF generation with custom headers, tables, tax breakdowns, and branding.'],
    ['Form Validation', 'React Hook Form + Zod v4.4.3', 'Type-safe schema validation across user onboarding, client creation, deliverables, and invoices.'],
    ['AI Assistance', 'Google Gemini (@google/genai)', 'AI-assisted generation of proposals, project scopes, brief analysis, and client communication.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Layer', 'Technology / Package', 'Architectural Role']],
    body: techStackData,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', fillColor: colors.bgLight },
      1: { cellWidth: 52, fontStyle: 'bold' },
      2: { cellWidth: contentWidth - 90 }
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;

  renderCallout(
    'Fail-Closed Dual-Mode Authentication Principle',
    'FlowDesk supports two mutually exclusive modes controlled by NEXT_PUBLIC_AUTH_MODE: "production" enforces strict Supabase authentication where missing credentials fail closed without leaking demo data; "demo" activates an isolated, self-contained local storage environment for testing without external dependencies.',
    'info'
  );
}

// -------------------------------------------------------------
// SECTION 3: REPOSITORY DIRECTORY & FILE STRUCTURE
// -------------------------------------------------------------
function renderSection3() {
  renderSectionHeader(3, 'Directory Structure & Codebase Breakdown');

  renderParagraph(
    'The repository follows a clean modular architecture separating backend logic, frontend modules, database migrations, and shared utilities:'
  );

  const directoryTree = [
    ['app/', 'Next.js App Router root containing page views, layouts, route handlers, and API endpoints.'],
    ['  |-- api/auth/', 'Authentication callbacks, OAuth handling, session exchange, and post-login redirection.'],
    ['  |-- api/payments/razorpay/', 'Endpoints for order creation, payment signature verification, and webhook callbacks.'],
    ['  |-- api/invoices/', 'Invoice PDF generation, email dispatch, and settlement recording endpoints.'],
    ['  |-- api/invitations/', 'Client portal connection links, token generation, validation, and acceptance.'],
    ['  |-- dashboard/', 'Freelancer main management dashboard (KPIs, clients, projects, deliverables, invoices).'],
    ['  |-- portal/[clientId]/', 'Client-facing portal view for viewing projects, deliverables, documents, and invoices.'],
    ['  |-- connect/[token]/', 'Client onboarding & invitation acceptance view.'],
    ['src/backend/', 'Domain business services, repository patterns, database access, and external integrations.'],
    ['  |-- auth/', 'AuthService, ProfileService, SessionService, UserSettingsService, AccountDeletionService.'],
    ['  |-- freelancer/', 'FreelancerClientService, FreelancerProjectService, DeliverableService, InvoiceService.'],
    ['  |-- client/', 'ClientAuthService, ClientDeliverableService, ClientInvoiceService, ClientCommentService.'],
    ['  |-- payments/', 'PaymentService, RazorpayClient, RazorpayService, currency utilities, subunit converters.'],
    ['  |-- email/', 'BrevoClient, ResendClient, EmailService, responsive transactional HTML templates.'],
    ['  |-- storage/', 'StorageHelper managing avatars, logos, signatures, documents, and deliverables buckets.'],
    ['  |-- store/', 'FlowDeskStore (localStorage persistence engine for Demo Mode with mock seeding).'],
    ['  |-- utilities/', 'Supabase client initializer, workspace resolver, notification helper, logger, rate limiter.'],
    ['src/frontend/', 'React 19 UI views, modals, forms, and client components.'],
    ['  |-- freelancer/', 'Views for Clients, Projects, Deliverables, Invoices, Documents, Settings, Activity.'],
    ['  |-- client/', 'ClientPortalShell, DeliverablesPanel, InvoicesPanel, CommentsPanel, RazorpayCheckoutModal.'],
    ['  |-- auth/', 'AuthContext, LoginForm, SignupForm, OnboardingFlow, ResetPasswordForm, VerifyEmail.'],
    ['  |-- landing/', 'LandingPage, Hero, MonochromeFluidCanvas, Features, Pricing, Testimonials, FAQ.'],
    ['src/shared/', 'Universal types, Zod schemas, currency utilities, date formatters, and PDF generators.'],
    ['database/', 'Database schema and 20 chronological PostgreSQL migration files with RLS policies.'],
    ['tests/', '13 automated test suites verifying auth fail-closed, RLS red-teaming, payments, emails.'],
    ['scripts/', 'Verification scripts for database hardening, Razorpay integration, RLS, and SEO/AEO.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Directory / Path', 'Description & Key Responsibilities']],
    body: directoryTree,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7, textColor: colors.text },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: colors.bgLight },
      1: { cellWidth: contentWidth - 55 }
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;
}

// -------------------------------------------------------------
// SECTION 4: DATABASE SCHEMA & DATA MODEL
// -------------------------------------------------------------
function renderSection4() {
  renderSectionHeader(4, 'Database Schema & Relational Data Model');

  renderParagraph(
    'FlowDesk employs a multi-tenant PostgreSQL schema hosted on Supabase. Data isolation is strictly enforced through a hierarchy rooted in Profiles and Workspaces. Every core entity links to a workspace_id, preventing data leakage across freelancers.'
  );

  const schemaTables = [
    ['profiles', 'id (UUID PK -> auth.users.id), full_name, business_name, email, avatar_url, phone, country, timezone, currency, onboarding_completed, created_at, updated_at', 'Stores user identity and profile metadata linked directly to Supabase Auth.'],
    ['workspaces', 'id (UUID PK), owner_id (FK -> profiles.id), name, logo_url, created_at, updated_at', 'Top-level tenant boundary. All clients, projects, deliverables, and invoices belong to a workspace.'],
    ['user_settings', 'id (UUID PK -> auth.users.id), currency, timezone, date_format, invoice_prefix, default_tax_rate, tax_name, email_notifications, invoice_reminders, comment_alerts', 'User preferences for formatting, default invoice numbering, tax rates, and alert toggles.'],
    ['clients', 'id (UUID PK), workspace_id (FK -> workspaces.id), user_id (FK), name, company, email, phone, status, health_badge, active_projects_count, total_billed, country, currency, notes', 'Client CRM records. Represents external companies or individuals engaging the freelancer.'],
    ['projects', 'id (UUID PK), workspace_id (FK), client_id (FK -> clients.id), title, description, status, budget, spent, completion_percentage, start_date, due_date, tags, milestones (JSONB)', 'Projects grouped under clients with financial budgeting and milestone tracking.'],
    ['deliverables', 'id (UUID PK), workspace_id (FK), client_id (FK), project_id (FK), title, description, status, due_date, review_requested_at, approved_at, rejection_reason, current_version, priority', 'Individual work assets submitted for client review (Draft, In Review, Needs Changes, Approved).'],
    ['deliverable_versions', 'id (UUID PK), deliverable_id (FK -> deliverables.id), version_number, file_url, file_name, file_size, note, uploaded_by, archived, created_at', 'Immutable history of deliverable iterations (e.g., v1.0, v1.1, v2.0) with attached files.'],
    ['deliverable_comments', 'id (UUID PK), deliverable_id (FK), author, author_id, author_role, is_internal, content, attachments, reply_to_id, resolved, created_at', 'Threaded feedback between freelancer and client with internal-only visibility flags.'],
    ['documents', 'id (UUID PK), workspace_id (FK), client_id (FK), title, type, status, is_required, due_date, description, file_name, file_url, version', 'Contracts, creative briefs, specifications, and client document upload requests.'],
    ['invoices', 'id (UUID PK), workspace_id (FK), client_id (FK), project_id (FK), invoice_number, status, issue_date, due_date, subtotal, tax_percentage, tax_amount, total_amount, paid_amount, currency', 'Financial invoices tracking itemized billing, taxes, outstanding balances, and payment status.'],
    ['invoice_items', 'id (UUID PK), invoice_id (FK -> invoices.id), description, quantity, unit_price, amount, created_at', 'Line items associated with each invoice.'],
    ['invoice_payments', 'id (UUID PK), invoice_id (FK -> invoices.id), amount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature, gateway, gateway_status, currency, captured_at', 'Audit ledger of all recorded payments (manual bank transfers, cash, or Razorpay online payments).'],
    ['razorpay_orders', 'id (UUID PK), order_id (TEXT UNIQUE), invoice_id (FK), workspace_id (FK), client_id (FK), amount, amount_subunits, currency, status, receipt, notes (JSONB)', 'Payment intents generated for Razorpay checkout tracking order lifecycle and webhook reconciliation.'],
    ['activities', 'id (UUID PK), workspace_id (FK), user_id (FK), client_id (FK), project_id (FK), action, title, description, user_name, resource_type, resource_id, created_at', 'Chronological audit trail of all actions across the workspace.'],
    ['notifications', 'id (UUID PK), workspace_id (FK), user_id (FK), title, message, category, link, read, priority, created_at', 'In-app notification records for approvals, feedback, overdue invoices, and system updates.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Table Name', 'Columns & Keys', 'Description']],
    body: schemaTables,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 6.5, textColor: colors.text },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', fillColor: colors.bgLight },
      1: { cellWidth: 65 },
      2: { cellWidth: contentWidth - 97 }
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;
}

// -------------------------------------------------------------
// SECTION 5: AUTHENTICATION, AUTHORIZATION & SECURITY
// -------------------------------------------------------------
function renderSection5() {
  renderSectionHeader(5, 'Authentication, Authorization & Security Architecture');

  renderParagraph(
    'FlowDesk implements an enterprise-grade security model preventing unauthorized access, cross-tenant data leakage, and silent fallback vulnerabilities. The security model is split across four protective layers:'
  );

  const securityLayers = [
    ['1. Route Middleware Protection', 'The Next.js edge middleware (middleware.ts) intercepts all incoming requests. Protected routes (/dashboard, /portal/[clientId], /client/*, /api/*) verify Supabase authentication cookies. Unauthenticated requests are immediately redirected to /login with return URLs.'],
    ['2. Multi-Tenant Row Level Security', 'PostgreSQL RLS policies are enabled on 100% of tables. Freelancers can strictly read/write records where workspace.owner_id = auth.uid(). Clients are granted scoped SELECT and UPDATE permissions only for rows matching their assigned client_id.'],
    ['3. Fail-Closed Authentication Strategy', 'Phase 28A security audit eliminated silent demo fallbacks. If Supabase is unreachable or misconfigured in production mode, the application surfaces an explicit configuration error rather than loading mock data.'],
    ['4. Credential & Secret Isolation', 'Sensitive API keys (SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, BREVO_API_KEY) are restricted exclusively to Node.js server runtimes and never leaked to client bundles.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'striped',
    head: [['Security Layer', 'Implementation Details']],
    body: securityLayers,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: contentWidth - 48 } },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;

  renderSubSectionHeader('Authentication Flows');
  renderParagraph(
    '• Freelancer Auth: Supports standard Email/Password authentication, OAuth (Google and GitHub), Magic Link, and Password Reset. Upon first signup, the user is routed through a 3-step onboarding flow to initialize business profile details and default workspace settings.\n' +
    '• Client Portal Access: Clients receive cryptographically secure invitation links (/connect/[token]) generated by the freelancer. Upon acceptance, client records are mapped to auth identities, enabling single-click access to /portal/[clientId].'
  );
}

// -------------------------------------------------------------
// SECTION 6: CORE MODULES & STEP-BY-STEP WORKINGS
// -------------------------------------------------------------
function renderSection6() {
  renderSectionHeader(6, 'Core Modules & Step-by-Step Workings');

  const modules = [
    {
      title: 'Module 1: Dashboard & Workspace Management',
      content: 'The Freelancer Dashboard provides real-time financial and operational intelligence. It aggregates total monthly revenue, pending invoice receivables, active project counts, and deliverables awaiting review. An interactive activity stream records real-time updates across all clients.'
    },
    {
      title: 'Module 2: Client CRM & Invitation System',
      content: 'Freelancers manage client directories with full contact information, currency preferences, tax IDs, and lifetime billing statistics. Freelancers can generate expiring invitation links via the Client Connection Service to onboard clients to their private portal.'
    },
    {
      title: 'Module 3: Project & Milestone Scoping',
      content: 'Projects feature customizable milestones, budget allocations, start/end dates, and progress percentage bars. Milestones automatically sync with deliverables, giving both freelancer and client full visibility into milestone completion rates.'
    },
    {
      title: 'Module 4: Deliverable Versioning & Approval Pipeline',
      content: 'Deliverables follow a structured four-stage Kanban lifecycle: Draft -> In Review -> Needs Changes -> Approved. Each deliverable supports multiple version uploads (v1.0, v1.1, etc.) stored securely in Supabase Storage with threaded comments and status flags.'
    },
    {
      title: 'Module 5: Document Library & Asset Request Engine',
      content: 'Manages legal and creative assets including Master Services Agreements (MSAs), Non-Disclosure Agreements (NDAs), project briefs, and brand assets. Includes status tracking (Pending, Uploaded, Approved) and file download permissions.'
    },
    {
      title: 'Module 6: Multi-Currency Invoicing & PDF Generation',
      content: 'Dynamic invoice builder with itemized entries, quantities, unit rates, tax percentages, and discount calculations. Includes an automated number-to-words currency generator and client-ready PDF generation via jsPDF with auto-table formatting and custom branding.'
    },
    {
      title: 'Module 7: Razorpay Payment Integration & Reconciliation',
      content: 'Seamless payment flow: Client opens invoice -> Clicks "Pay Online" -> Backend creates Razorpay order -> Razorpay Checkout modal appears -> Client completes payment via UPI/Card/Netbanking -> Backend verifies HMAC signature -> Invoice is automatically marked as Paid -> Email receipt is dispatched.'
    },
    {
      title: 'Module 8: Client Engagement Portal',
      content: 'Authenticated, isolated client interface allowing clients to view ongoing project timelines, approve or request revisions on deliverables, download contracts, and settle outstanding invoices directly.'
    },
    {
      title: 'Module 9: Transactional Email Notification Engine',
      content: 'Integrated with Brevo and Resend. Automatically triggers responsive HTML emails when client invitations are created, deliverables are submitted for review, revisions are requested, and invoices are issued or paid.'
    }
  ];

  modules.forEach(mod => {
    checkPageBreak(25);
    renderSubSectionHeader(mod.title);
    renderParagraph(mod.content);
  });
}

// -------------------------------------------------------------
// SECTION 7: PAYMENT GATEWAY ARCHITECTURE (RAZORPAY)
// -------------------------------------------------------------
function renderSection7() {
  renderSectionHeader(7, 'Razorpay Payment Gateway Architecture');

  renderParagraph(
    'FlowDesk implements a robust, idempotent payment architecture integrating Razorpay Standard Checkout and Server-side Webhooks:'
  );

  const paymentSteps = [
    ['1. Order Creation', 'POST /api/payments/razorpay/create-order receives the invoice ID, validates the outstanding balance, converts the amount into minor currency units (e.g. paise/cents), and registers a Razorpay Order ID stored in the razorpay_orders table.'],
    ['2. Client Checkout', 'The frontend mounts the Razorpay SDK checkout modal displaying the freelancer business branding, accepted payment methods (UPI, Cards, Netbanking, Wallets), and currency denomination.'],
    ['3. Signature Verification', 'Upon successful payment, the client SDK returns razorpay_payment_id, razorpay_order_id, and razorpay_signature. The backend verifies the HMAC SHA-256 signature using the server secret key before recording the transaction.'],
    ['4. Idempotent Settlement', 'PaymentService checks for unique payment IDs before inserting records into invoice_payments, incrementing paid_amount, and updating invoice status to "paid" or "partially_paid".'],
    ['5. Webhook Redundancy', 'POST /api/payments/razorpay/webhook listens for payment.captured events to reconcile transactions in real-time even if the client closes the browser before redirection.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Payment Stage', 'Technical Implementation & Security']],
    body: paymentSteps,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', fillColor: colors.bgLight }, 1: { cellWidth: contentWidth - 42 } },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;
}

// -------------------------------------------------------------
// SECTION 8: TESTING, QUALITY GATES & VERIFICATION
// -------------------------------------------------------------
function renderSection8() {
  renderSectionHeader(8, 'Testing Suite & Quality Verification');

  renderParagraph(
    'FlowDesk includes 13 automated test suites and verification scripts ensuring strict data integrity, security compliance, and error resistance:'
  );

  const testSuites = [
    ['tests/auth-fail-closed.test.ts', 'Verifies that production authentication fails closed without leaking mock data when database credentials are unset.'],
    ['tests/rls-redteam.test.ts', 'Executes red-team multi-tenant attack simulations verifying that User A cannot read or write User B workspaces, clients, or invoices.'],
    ['tests/razorpay-payment.test.ts', 'Validates order creation, signature hashing, concurrency handling, and partial payment reconciliation.'],
    ['tests/brevo-email-deep-audit.test.ts', 'Tests transactional email rendering, template parameters, error retries, and API dispatch.'],
    ['tests/data-workflow-e2e.test.ts', 'Full end-to-end simulation: Client Creation -> Project -> Deliverable -> Approval -> Invoice -> Payment.'],
    ['tests/rate-limiter.test.ts', 'Verifies IP-based and user-based token bucket rate limiting on public API endpoints to prevent abuse.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'striped',
    head: [['Test Suite / Script', 'Test Scope & Assertions']],
    body: testSuites,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: contentWidth - 55 } },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;
}

// -------------------------------------------------------------
// SECTION 9: CONFIGURATION & DEPLOYMENT GUIDE
// -------------------------------------------------------------
function renderSection9() {
  renderSectionHeader(9, 'Configuration & Deployment Guide');

  renderParagraph(
    'FlowDesk is optimized for zero-downtime deployment on Vercel, Supabase, and Cloud Run. Follow these environment configurations:'
  );

  const envVars = [
    ['NEXT_PUBLIC_APP_URL', 'Production domain URL (e.g., https://flowdesk.app) used for links and OAuth callbacks.'],
    ['NEXT_PUBLIC_AUTH_MODE', 'Set to "production" for real Supabase authentication or "demo" for isolated local testing.'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase PostgreSQL project API endpoint URL.'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anonymous public API key for client-side authentication and RLS queries.'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key (Server-side only) for administrative tasks.'],
    ['RAZORPAY_KEY_ID / SECRET', 'Razorpay API Key ID and Secret for payment order generation and webhook verification.'],
    ['NEXT_PUBLIC_RAZORPAY_KEY_ID', 'Public Razorpay Key ID used by the client-side checkout SDK modal.'],
    ['BREVO_API_KEY / EMAIL_FROM', 'Brevo API key and verified sender address for sending transactional emails.']
  ];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Environment Variable', 'Purpose & Environment']],
    body: envVars,
    headStyles: { fillColor: colors.primary, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: colors.text },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: colors.bgLight }, 1: { cellWidth: contentWidth - 60 } },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  renderCallout(
    'Deployment Command Quick Reference',
    'To build and start the production instance:\n' +
    '1. npm install              (Install dependencies)\n' +
    '2. npm run typecheck        (Validate TypeScript integrity)\n' +
    '3. npm run build            (Generate optimized Next.js production bundle)\n' +
    '4. npm start                (Launch production server on port 3000)',
    'info'
  );
}

// -------------------------------------------------------------
// HEADER & FOOTER ON ALL PAGES
// -------------------------------------------------------------
function applyHeaderAndFooter() {
  const totalPages = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i === 1) {
      // Cover page footer
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('FlowDesk Operating System Documentation | Private & Confidential', margin, pageHeight - 8);
      doc.text(`Page 1 of ${totalPages}`, pageWidth - margin - 15, pageHeight - 8);
      continue;
    }

    // Top Header Bar
    doc.setFillColor(...colors.bgLight);
    doc.rect(0, 0, pageWidth, 10, 'F');
    doc.setDrawColor(...colors.border);
    doc.line(0, 10, pageWidth, 10);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text('FlowDesk — Technical Architecture & Project Guide', margin, 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textMuted);
    doc.text('Freelancer Operating System', pageWidth - margin - 35, 6.5);

    // Bottom Footer Bar
    doc.setDrawColor(...colors.border);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(7.5);
    doc.setTextColor(...colors.textMuted);
    doc.text('Generated for FlowDesk Workspace | Next.js 15 & Supabase RLS', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 7);
  }
}

// -------------------------------------------------------------
// EXECUTION
// -------------------------------------------------------------
async function generatePDF() {
  console.log('Generating FlowDesk Comprehensive Documentation PDF...');

  renderCoverPage();
  renderSection1();
  renderSection2();
  renderSection3();
  renderSection4();
  renderSection5();
  renderSection6();
  renderSection7();
  renderSection8();
  renderSection9();

  applyHeaderAndFooter();

  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync(OUTPUT_FILE, Buffer.from(pdfOutput));

  console.log(`PDF successfully generated at: ${OUTPUT_FILE}`);
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});

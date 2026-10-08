# FlowDesk

> **The Freelancer Operating System**  
> Manage clients, projects, deliverables, approvals, documents, invoices, and payment tracking in one organized workspace.

---

## 🎯 Product Overview

FlowDesk is a unified workspace designed specifically for freelancers, independent contractors, and solo creative professionals. It simplifies freelance operations by connecting every step of the client engagement lifecycle into a single, cohesive operating pipeline.

### Core Workflow

```
Client
  └── Project
        └── Documents
              └── Deliverables
                    └── Approval / Revision
                          └── Invoice
                                └── Payment & Completion
```

1. **Client**: Dedicated workspace per client with centralized contact details, project histories, documents, and financials.
2. **Project**: Milestones, timelines, progress tracking, and budget allocation.
3. **Documents**: Secure contracts, briefs, specifications, and asset request management.
4. **Deliverables**: Work submissions with structured version control and status tracking.
5. **Approval / Revision**: Formal client feedback loop with clear sign-offs and structured revision requests.
6. **Invoice**: Professional multi-currency itemized invoices with configurable tax rates, payment terms, and PDF export.
7. **Payment & Completion**: Payment recording, outstanding balance tracking, and immutable audit logs.

---

## ✨ Key Capabilities

- **Client Workspaces**: Clean separation of clients with workspace-level access control and history.
- **Deliverable Versioning**: Upload and manage iterations with version labels and status tracking.
- **Client Portal**: Dedicated, authenticated client interface for reviewing deliverables, requesting revisions, accessing documents, and viewing invoices.
- **Invoicing & PDF Generation**: Itemized invoice builder with tax calculation, discount handling, and client-ready PDF downloads.
- **Activity Feed**: Comprehensive chronological audit trail of all project events, approvals, and invoice actions.
- **Search Engine & Answer Engine Optimized**: Production-ready metadata, structured JSON-LD schemas, sitemap, robots directives, and machine-readable `llms.txt`.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS, Lucide Icons, Motion (Framer Motion)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, SSR Auth)
- **Payments**: Razorpay Standard Checkout & Webhooks
- **Email**: Resend Transactional Email API
- **Document Export**: jsPDF with AutoTable

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.x or higher
- `npm` (or `pnpm` / `yarn`)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ashutosh89-ctrl/Flowdesk_v1.git
   cd Flowdesk_v1
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local` and populate your service credentials:
   ```bash
   cp .env.example .env.local
   ```

### Environment Variables

| Variable | Description | Where Set |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Canonical public application URL (e.g. `https://app.flowdesk.io`) | Shared |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) | Shared (Public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous public key | Shared (Public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, bypasses RLS for trusted jobs) | Server |
| `NEXT_PUBLIC_AUTH_MODE` | Explicit authentication mode: `production` (default) or `demo` (offline storage only) | Shared (Public) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for distributed rate limiting | Server |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token for distributed rate limiting | Server |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID (server-side order generation) | Server |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret (server-side HMAC verification) | Server |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret (HMAC verification) | Server |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID for client checkout SDK | Shared (Public) |
| `BREVO_API_KEY` | Brevo Transactional Email API key (v3 `xkeysib-...`) | Server |
| `BREVO_WEBHOOK_SECRET` | Brevo Webhook authentication secret | Server |
| `RESEND_API_KEY` | Resend API key (`re_...`, alternative email provider) | Server |
| `RESEND_WEBHOOK_SECRET` | Resend Svix Webhook signing secret (`whsec_...`) | Server |
| `EMAIL_FROM` | Sender address for transactional emails (e.g. `FlowDesk <noreply@flowdesk.io>`) | Server |
| `CRON_SECRET` | Bearer token for automated cron routes (e.g. account purge) | Server |
| `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1..4` | Feature flags to toggle server routes for Batches 1 to 4 (default `true`) | Shared (Public) |

---

## 🧪 Testing & Quality Gates

Run the automated verification suite before creating releases:

```bash
# Run unified security and integration CI test runner
npm run test:all

# Run static secrets scanner
npm run check:secrets

# TypeScript type check
npm run typecheck

# ESLint release check
npm run lint

# Next.js production build
npm run build
```

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Enforced across all tables in PostgreSQL. Users and clients can only access data belonging to their authorized workspaces.
- **Protected Routes**: `/dashboard`, `/portal/[clientId]`, `/client/*`, and `/api/*` are protected by server-side middleware and authentication checks.
- **Search Engine Isolation**: All private routes and client portals are strictly configured with `noindex, nofollow` and excluded from `robots.txt` and `sitemap.xml`.
- **Zero Client Credential Exposure**: Service role keys, payment secrets, and email API keys are restricted to server-side runtime environments.

---

## 📄 License

Private & Proprietary. All rights reserved © 2026 FlowDesk.

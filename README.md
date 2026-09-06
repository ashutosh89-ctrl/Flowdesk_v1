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

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Canonical public application URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK` | Set to `false` in production to enforce database persistence |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID (server-side) |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret (server-side only) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret (server-side only) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID for client checkout SDK |
| `RESEND_API_KEY` | Resend API key (server-side only) |
| `EMAIL_FROM` | Sender address for transactional emails |

---

## 🧪 Testing & Quality Gates

Run the automated verification suite before creating releases:

```bash
# Run backend integrity and RLS verification tests
npx tsx scripts/verify-hardening.ts

# Run payment settlement and concurrency tests
npx tsx scripts/verify-razorpay.ts

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

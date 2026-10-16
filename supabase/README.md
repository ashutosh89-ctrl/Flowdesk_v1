# FlowDesk Database (Supabase)

This directory is the single source of truth for the FlowDesk PostgreSQL schema,
Row-Level Security, storage bucket configuration, and auth provisioning.

## Layout

```
supabase/
  config.toml        Local stack configuration (CLI-managed)
  migrations/        Ordered, version-controlled migrations (apply on fresh DB)
  seed.sql           Local-only seed (intentionally empty — no customer data)
  schema.sql         GENERATED: concatenation of migrations/*.sql for SQL-editor use
```

## Migration order

| # | File | Purpose |
|---|------|---------|
| 1 | `20261015000001_core_schema.sql` | Core tables, extensions, FKs, PKs |
| 2 | `20261015000002_indexes_and_constraints.sql` | Indexes, unique + check constraints |
| 3 | `20261015000003_rls_policies.sql` | RLS enablement + owner/client policies |
| 4 | `20261015000004_storage_buckets.sql` | Bucket provisioning (private/public) |
| 5 | `20261015000005_auth_triggers.sql` | `auth.users` → profile/workspace/settings provisioning |
| 6 | `20261015000006_reconciliation.sql` | Tables/columns re-derived from app source (`email_events`, `razorpay_orders`, gap columns) |
| 7 | `20261015000007_rls_storage_reconciliation.sql` | RLS for reconciled tables + `storage.objects` policies |

`schema.sql` is generated. Regenerate after editing any migration:

```bash
for f in supabase/migrations/*.sql; do echo "-- >>> $f"; cat "$f"; echo; done > supabase/schema.sql
```

## Local development

```bash
npx supabase start        # requires Docker running
npx supabase db reset     # drop + re-apply all migrations + seed
```

Apply migrations to a fresh database is verified with:

```bash
npm run test:schema:local   # 30 tables conform to the app column contract
npm run test:rls:local      # 17 live RLS isolation assertions
npx supabase gen types typescript --local > src/shared/types/database.types.ts
```

## Applying to a remote project (manual, reviewed step)

Migrations are **never** auto-applied to production. Two supported options:

1. **Supabase CLI (recommended):**
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
2. **SQL editor fallback:** paste the generated `supabase/schema.sql` into the
   Supabase SQL Editor and run it. All statements are idempotent
   (`IF NOT EXISTS` / `DROP ... IF EXISTS`), so re-running is safe.

> The `storage.objects` policies (migration 7) are wrapped in an exception-safe
> block. On a role that does not own `storage.objects`, they are skipped with a
> NOTICE instead of failing the migration; in that case apply the storage
> policies from **Storage → Policies** in the dashboard.

## Preserving authentication

These migrations **never** drop, reset, or recreate `auth.users`, identities, or
sessions. Migration 5 adds a trigger and a one-time backfill that only *adds*
profile/settings/workspace rows for existing users (`ON CONFLICT DO NOTHING`).

## Description
<!-- Provide a clear, concise summary of the changes introduced in this PR -->

## Security Hardening Checklist
> **MANDATORY**: Every pull request must satisfy these baseline security checks before review or merge.

- [ ] **Zero Secrets**: Verified no API keys, private credentials, or JWT tokens are present (`npm run check:secrets` passes).
- [ ] **Input Validation**: All new or modified Route Handlers validate JSON bodies with strict Zod schemas and enforced size limits (`parseJsonBody`).
- [ ] **Authentication & Authorization**: All endpoints enforce session verification (`requireApiCaller`), webhook HMAC checks, or Bearer secrets.
- [ ] **Multi-Tenant Isolation & RLS**: All Supabase database mutations respect workspace/client ownership. No cross-tenant access.
- [ ] **XSS & Injection Defense**: No raw HTML rendering. URLs validated via `isSafeHttpUrl`. PostgREST queries parameterized.
- [ ] **Upload Security**: Upload endpoints enforce magic-byte sniffing, size limits, and strictly reject executable/SVG files.
- [ ] **Safe Logging & Errors**: Sensitive data (emails, phones, tokens, credentials) masked in logs. API errors returned via `createApiErrorResponse`.
- [ ] **Full Test Suite**: Verified `npm run test:all` passes locally with zero errors.

## Type of Change
- [ ] 🔒 Security remediation / hardening
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 🗄️ Database migration (unapplied SQL in `database/migrations/`)
- [ ] ⚙️ CI / Devops / Tooling improvement

## Verification & Testing
<!-- Describe manual and automated steps used to verify these changes -->
```bash
npm run test:all
npm run build
```

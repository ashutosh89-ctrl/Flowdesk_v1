# FlowDesk Authentication Architecture

## Overview

FlowDesk supports two explicit authentication modes:

- **PRODUCTION** — Supabase authentication (real users, real data)
- **DEMO** — FlowDeskStore/demo authentication (mock users, demo data)

The mode is determined at build time by the `NEXT_PUBLIC_AUTH_MODE` environment variable:
- `NEXT_PUBLIC_AUTH_MODE=production` → Supabase auth
- `NEXT_PUBLIC_AUTH_MODE=demo` → Demo auth
- Not set → Defaults to `production` if Supabase is configured, `demo` if not

**Critical rule:** Production and Demo authentication NEVER silently switch into each other.

---

## Authentication Mode

```typescript
// src/backend/utilities/supabase.ts

export type AuthMode = 'production' | 'demo';

export const authMode: AuthMode = (() => {
  const envMode = process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase();
  if (envMode === 'demo') return 'demo';
  if (envMode === 'production') return 'production';
  return isSupabaseConfigured ? 'production' : 'demo';
})();

export const isProductionMode = authMode === 'production';
export const isDemoMode = authMode === 'demo';
```

---

## Freelancer Authentication (Production)

### Signup Flow

```
/signup
  ↓
AuthContext.signUp()
  ↓
AuthService.signUp()
  ↓
[isDemoMode?]
  ├─ YES → signUpDemo() → mock localStorage session
  └─ NO  → supabase.auth.signUp()
            ├─ SUCCESS → ProfileService.upsertProfile()
            │            → UserSettingsService.saveUserSettings()
            │            → SessionService.setLocalSession()
            └─ ERROR → return error (NEVER falls back to demo)
  ↓
AuthContext → loadProfileAndSettings(userId)
  ↓
ProfileService.getProfile(userId) → Supabase profiles table
  ↓
[Post-login gate: /auth/post-login]
  ↓
[onboarding_completed?]
  ├─ NO → /onboarding → completeOnboarding() → /dashboard
  └─ YES → /dashboard
```

### Login Flow

```
/login
  ↓
AuthContext.signIn()
  ↓
AuthService.signIn()
  ↓
[isDemoMode?]
  ├─ YES → signInDemo() → mock localStorage session
  └─ NO  → supabase.auth.signInWithPassword()
            ├─ SUCCESS → SessionService.setLocalSession()
            └─ ERROR → return error (NEVER falls back to demo)
  ↓
AuthContext → loadProfileAndSettings(userId)
  ↓
Dashboard → getCurrentWorkspace() → workspaces table
```

### OAuth Flow

```
/login → "Continue with Google/GitHub"
  ↓
[isDemoMode?]
  ├─ YES → signInWithGoogleDemo() → mock session
  └─ NO  → supabase.auth.signInWithOAuth('google'|'github')
            ↓
          Redirect to provider
            ↓
          /auth/callback → exchangeCodeForSession(code)
            ↓
          /auth/post-login → getUser() → profiles → onboarding check → /dashboard
```

### Logout Flow

```
Logout button
  ↓
AuthService.signOut()
  ↓
SessionService.clearLocalSession() → clears localStorage keys
  ↓
supabase.auth.signOut() → clears Supabase cookies
  ↓
AuthContext clears all state
  ↓
Redirect to /login
```

---

## Client Authentication (Production)

### Login Flow

```
/client/login
  ↓
[Token mode or Email mode]
  ↓
ClientAuthService.login() or loginWithPortalToken()
  ↓
[isDemoMode?]
  ├─ YES → Mock client
  └─ NO  → supabase.auth.signInWithPassword() (if password provided)
            → resolveClientByUserIdOrEmail()
            → OR supabase.from('clients').select('*').or(...)
  ↓
ClientAuthContext → setClient() + localStorage
  ↓
/client/dashboard
```

### Portal Access Flow

```
/portal/[clientId]
  ↓
Middleware: requires authenticated Supabase user
  ├─ NO user → redirect to /client/login
  └─ YES user → render portal page
  ↓
ClientAuthProvider → ClientAuthService.getAuthenticatedClient()
  ↓
resolveClientByUserIdOrEmail(userId, email)
  ↓
[client matches URL clientId?]
  ├─ YES → render ClientPortalView
  └─ NO → show "Portal Access Required"
```

---

## Session Management

### Production Sessions

- Managed by Supabase (cookies)
- `supabase.auth.getSession()` for reading
- `supabase.auth.getUser()` for verification
- `supabase.auth.onAuthStateChange()` for listeners

### Demo Sessions

- Managed by localStorage (`flowdesk_auth_session`)
- Mock tokens (never expire)
- No Supabase interaction

### Session Storage Keys

| Key | Purpose | Mode |
|-----|---------|------|
| `flowdesk_auth_session` | Freelancer session | Demo |
| `flowdesk_client_session` | Client session | Both |
| `flowdesk_user_profile` | Cached profile | Both |
| `flowdesk_user_settings_*` | Cached settings | Both |

---

## Profile Linking

```
auth.users.id
  ↓
profiles.id (= auth.users.id)
  ↓
workspaces.owner_id (= profiles.id)
  ↓
clients.workspace_id (= workspaces.id)
```

---

## Security Rules

1. **URL params are NEVER authentication** — `/portal/[clientId]` requires Supabase auth
2. **URL tokens are NEVER authentication** — `?token=anything` cannot bypass middleware
3. **Demo mode is explicit** — Never auto-switches based on network failures
4. **Production errors remain errors** — Never silently fall back to demo
5. **Client A cannot access Client B** — Verified by `client.id === URL clientId`
6. **Freelancer A cannot access Freelancer B** — Verified by `workspace.owner_id = auth.uid()`
7. **Service-role key is never exposed** — Only in `.env.local`, never in client code

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ (production) | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ (production) | — | Supabase anon key |
| `NEXT_PUBLIC_AUTH_MODE` | ❌ | auto | `production` or `demo` |
| `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK` | ❌ | false | **DEPRECATED** — use `NEXT_PUBLIC_AUTH_MODE` |

---

## Files Changed in Phase 28A

| File | Change |
|------|--------|
| `src/backend/utilities/supabase.ts` | Added explicit `authMode`, `isProductionMode`, `isDemoMode` |
| `src/backend/services/auth-service.ts` | Removed silent demo fallback on network errors |
| `src/backend/services/profile-service.ts` | Removed 2s timeout, improved error handling |
| `src/backend/services/user-settings-service.ts` | Uses `isDemoMode` for demo check |
| `src/context/client-auth-context.tsx` | Supabase auth takes priority over localStorage |
| `src/frontend/shared/auth/oauth-buttons.tsx` | Uses `isDemoMode` for demo check |
| `middleware.ts` | Removed URL token bypass, requires Supabase auth for all protected routes |
| `app/portal/[clientId]/page.tsx` | Added full auth check, client ID verification |

# Supabase Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working Supabase authentication with email/password and Google while preserving the existing food scanner.

**Architecture:** Use Supabase Auth with `@supabase/ssr` and cookie-based sessions. Next.js 16 uses `src/proxy.ts` to refresh authentication sessions. Authentication UI and server actions remain separate from the existing food-analysis system.

**Tech Stack:** Next.js 16.3.7, React 19, TypeScript, Supabase Auth, `@supabase/supabase-js`, `@supabase/ssr`, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-auth-onboarding-meals-design.md`

## Global Constraints

- Keep the existing food scanner behavior working.
- Use email/password and Google authentication.
- Use Supabase SSR cookie-based authentication.
- Use Next.js 16 `proxy.ts`, not legacy `middleware.ts`.
- Never trust client-provided user IDs for authorization.
- Never commit Supabase secrets or `.env.local`.
- Use the Supabase publishable key in browser-safe configuration.
- Read the relevant Next.js 16 documentation in `node_modules/next/dist/docs/` before implementing framework-specific APIs.
- Follow RED → GREEN TDD for behavior changes.
- Prefer small focused files rather than adding authentication logic to `src/app/page.tsx`.

## Review Focus

1. Invalid or blank login credentials must return a useful error instead of calling Supabase.
2. Failed OAuth callbacks must return the user to login with an understandable error state.
3. Supabase sessions must survive refresh/navigation through cookie refresh.
4. Missing Supabase environment variables must fail clearly rather than silently creating a broken client.
5. Existing scanner tests and the production build must remain green.

---

## File Structure

### Supabase infrastructure

- `src/lib/supabase/client.ts`
  - Creates the browser Supabase client.

- `src/lib/supabase/server.ts`
  - Creates the server Supabase client using Next.js cookies.

- `src/lib/supabase/proxy.ts`
  - Refreshes authenticated sessions.

- `src/proxy.ts`
  - Next.js 16 proxy entry point.

### Authentication

- `src/lib/auth-credentials.ts`
  - Pure credential validation.

- `src/lib/auth-credentials.test.ts`
  - Credential validation tests.

- `src/app/auth/actions.ts`
  - Email sign-up, email sign-in, Google sign-in, and sign-out server actions.

- `src/app/auth/login/page.tsx`
  - Login UI.

- `src/app/auth/sign-up/page.tsx`
  - Registration UI.

- `src/app/auth/callback/route.ts`
  - Exchanges OAuth/confirmation authorization codes for sessions.

- `src/app/auth/callback/route.test.ts`
  - Callback success/failure tests.

The food scanner stays separate from these modules.

---

### Task 1: Install and configure Supabase SSR foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`

**Interfaces:**
- Produces: `createClient()` for browser code.
- Produces: async `createClient()` for server code.
- Produces: `updateSession(request: NextRequest)` for Next.js Proxy.

- [ ] **Step 1: Inspect the installed Next.js 16 docs**

Locate the relevant proxy and cookies documentation under:

`node_modules/next/dist/docs/`

Verify the APIs used by the current installed Next.js version.

- [ ] **Step 2: Install Supabase packages**

Run:

`npm.cmd install @supabase/supabase-js @supabase/ssr`

- [ ] **Step 3: Add environment configuration**

`.env.local` must contain:

`NEXT_PUBLIC_SUPABASE_URL`
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not commit `.env.local`.

- [ ] **Step 4: Implement browser/server Supabase clients**

Use `@supabase/ssr`.

Browser client reads public environment variables.

Server client integrates with the current Next.js cookies API.

- [ ] **Step 5: Implement Next.js 16 Proxy session refresh**

Create `src/proxy.ts` and `src/lib/supabase/proxy.ts`.

Refresh the session using the current Supabase SSR guidance.

Do not use `getSession()` for authorization.

- [ ] **Step 6: Verify**

Run:

`npm.cmd run build`

Expected: successful Next.js production build.

---

### Task 2: Credential validation

**Files:**
- Create: `src/lib/auth-credentials.ts`
- Create: `src/lib/auth-credentials.test.ts`

**Interfaces:**
- Produces: `validateLoginCredentials(input)`
- Produces: `validateSignUpCredentials(input)`

- [ ] **Step 1: Write failing tests**

Tests must cover:

- valid email/password
- malformed email
- blank password
- sign-up password minimum
- mismatched confirmation password

- [ ] **Step 2: Verify RED**

Run:

`npx.cmd vitest run src/lib/auth-credentials.test.ts`

Expected: FAIL because validation implementation does not exist.

- [ ] **Step 3: Implement minimal validation**

Use Zod.

Validation functions return normalized validated data or structured validation errors.

- [ ] **Step 4: Verify GREEN**

Run:

`npx.cmd vitest run src/lib/auth-credentials.test.ts`

Expected: PASS.

---

### Task 3: Email/password authentication actions

**Files:**
- Create: `src/app/auth/actions.ts`
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/sign-up/page.tsx`

**Interfaces:**
- Consumes: server `createClient()`
- Consumes: credential validators
- Produces: sign-in, sign-up, Google sign-in, and sign-out actions.

- [ ] **Step 1: Add behavior tests around authentication input handling**

Prove invalid credentials do not reach Supabase.

- [ ] **Step 2: Verify RED**

Run the focused authentication tests.

Expected: FAIL before actions exist.

- [ ] **Step 3: Implement email/password sign-up and sign-in**

Use Supabase Auth server APIs.

Authentication failures return understandable user-facing messages.

- [ ] **Step 4: Build login and sign-up pages**

Login page includes:

- Email
- Password
- Sign in
- Continue with Google
- Link to sign up

Sign-up page includes:

- Email
- Password
- Confirm password
- Create account
- Continue with Google
- Link to login

- [ ] **Step 5: Verify focused tests**

Expected: PASS.

---

### Task 4: Google OAuth and auth callback

**Files:**
- Modify: `src/app/auth/actions.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/callback/route.test.ts`

**Interfaces:**
- Google sign-in redirects through Supabase OAuth.
- Callback accepts an authorization `code`.
- Successful exchange creates a cookie-backed session.

- [ ] **Step 1: Write callback tests**

Cover:

- successful authorization-code exchange
- missing authorization code
- failed code exchange

- [ ] **Step 2: Verify RED**

Run:

`npx.cmd vitest run src/app/auth/callback/route.test.ts`

Expected: FAIL before callback implementation.

- [ ] **Step 3: Implement OAuth callback**

Exchange the code using the server Supabase client.

Success redirects to `/`.

Failure redirects to login with an error state.

- [ ] **Step 4: Implement Google sign-in action**

Use:

`signInWithOAuth({ provider: "google" })`

Set the redirect URL to the auth callback route.

- [ ] **Step 5: Verify GREEN**

Run callback and auth tests.

Expected: PASS.

---

### Task 5: Supabase dashboard configuration and manual auth verification

**Files:**
- No application source changes unless configuration reveals an issue.

- [ ] **Step 1: Configure Supabase Auth URLs**

Configure local application URL and OAuth callback URL in Supabase.

- [ ] **Step 2: Enable Google provider**

Configure Google OAuth credentials in the Supabase dashboard.

Secrets stay in provider/Supabase configuration and are never committed.

- [ ] **Step 3: Test email/password authentication manually**

Verify:

- sign up
- sign in
- refresh
- sign out
- sign back in

- [ ] **Step 4: Test Google authentication manually**

Verify:

Google → Supabase → `/auth/callback` → application session.

---

### Task 6: Regression verification

- [ ] **Step 1: Run complete test suite**

Run:

`npx.cmd vitest run`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

`npm.cmd run build`

Expected: successful production build.

- [ ] **Step 3: Test existing scanner**

Verify existing image analysis and clarification behavior still works.

- [ ] **Step 4: Check secrets**

Run:

`git status`
`git ls-files .env.local`

Expected: `.env.local` is not tracked.

- [ ] **Step 5: Commit auth foundation**

Commit only after focused tests, full tests, production build, and manual authentication checks are successful.

---

## After This Plan

The next implementation plan will add:

1. Profile/onboarding wizard.
2. BMR/TDEE and goal calculations.
3. Skip-onboarding behavior.

After onboarding is stable, the following plan will implement:

1. `profiles`
2. `nutrition_goals`
3. `meals`
4. `meal_items`
5. RLS policies
6. Functional `Add Meal`
7. Meal history
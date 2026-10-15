# AI Fitness project context

Last reviewed: 2026-10-15 (UTC+8). This document records source inspection and owner-approved project decisions. It is the starting point for future sessions alongside [AGENTS.md](AGENTS.md) and [ROADMAP.md](ROADMAP.md).

## Purpose and development priorities

AI Fitness helps users track nutrition, meals, exercise, and personal goals. Food analysis uses AI; manual tracking and formula calculations remain available without AI credits. Keep workflows beginner-friendly and mobile-friendly, with clear labels, responsive layouts, accessible controls, and understandable loading/error states. Prefer free-tier services and avoid unexpected expenses.

The owner reports Phases 1-5 completed, and their implementations are present in this checkout. Phase 6 has begun with the Gemini-only provider foundation described below. Automated verification of this foundation is recorded in the checkpoint; live authentication, model calls, deployed migrations, and database policies have not been verified in this milestone.

## Technologies and architecture

The checked-in `package.json` declares Next.js 16.3.7, React/React DOM 19.2.8, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 4, Supabase JS with `@supabase/ssr`, and Google's `@google/genai` SDK. Dependency ranges are resolved by `package-lock.json`; do not assume these are the latest upstream versions.

| Location | Responsibility |
| --- | --- |
| `src/app/` | Next.js App Router pages, layouts, server actions, and API routes |
| `src/app/api/food/` | Authenticated photo analysis, text analysis, and refinement endpoints |
| `src/app/api/ai/usage/` | Authenticated allowance status endpoint |
| `src/components/` | Food logging, clarification, dashboard, activity, goals, and settings UI |
| `src/lib/` | Zod validation, food normalization, date handling, calculations, summaries, and AI allowance helpers |
| `src/lib/ai/` | Provider-neutral transport contracts, server-only Gemini selection, and Gemini adapter; credit accounting remains in the routes |
| `src/lib/supabase/` | Browser/server SSR clients, session refresh, and protected-page classification |
| `src/proxy.ts` | Next.js session-refresh and page-access entry point |
| `supabase/migrations/` | Checked-in database tables, constraints, RLS, and allowance RPCs |
| `docs/superpowers/` | Historical design specifications and implementation plans |

Server actions perform authenticated data writes. Server-rendered pages and browser components read Supabase data with ownership filters and RLS. The three food AI route handlers now call the shared `AiProvider.generate()` interface through `getAiProvider()`. Only the Gemini adapter is enabled; it preserves the existing Interactions API and model identifier `gemini-3.5-flash-lite`. The selector and adapter use Next.js `server-only` guards. No additional providers or automatic fallback are implemented.

The provider receives ordered text/base64-image parts and a JSON response schema and returns raw output text. Its only job is transport: the routes retain their prompts, JSON parsing, canonical Zod schemas, normalizations, clarification flows, additive/legacy refinement handling, and existing error responses. The routes still reserve usage once before generation; the provider neither reads Supabase nor deducts credits. Client construction is lazy, so blocked quota requests do not reach the SDK.

The existing Gemini model's image/text and structured-output capabilities were checked against [Google's official model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) on 2026-10-15. This verifies advertised capability, not this account's live availability or billing tier. No model API call was made, and no other model is recommended or enabled by this foundation milestone.

## Implemented features: Phases 1-5

| Phase | Implementation present in source |
| --- | --- |
| 1-3: Food Analysis, Authentication, AI Credits | Multi-image food analysis, text descriptions, calories/macros, clarifications and refinement, manual food entry, authenticated meal saving/history, editable meal timestamps, email/password and Google login, email confirmation, daily AI allowance and status display |
| 4: Exercise & Activity Tracking | Walking, running, cycling, strength training, and other activities; duration/intensity, optional weight, MET calorie estimates or reported smartwatch calories, history/deletion, account-based exercise-display preference |
| 5: Personal Goals, TDEE, Weight Progress and Reports | Lose/maintain/gain goals, daily calorie/protein targets, optional target weight, formula-based TDEE calculator, centimetres or feet/inches height entry, optional dated weight check-ins/history, dashboard target progress, and seven-day nutrition reports |

Key routes are `/` (food logging), `/dashboard`, `/meals`, `/activities`, `/goals`, `/reports`, and `/settings`. These application pages require sign-in. Authentication forms and callbacks remain public. There is no implemented onboarding wizard or daily meal calorie planner.

## Authentication and database security

Supabase Auth owns identity. Email/password login and signup use validated server actions. Google OAuth exchanges an authorization code at `/auth/callback`; email confirmation verifies an OTP token hash at `/auth/confirm`. SSR clients integrate sessions with cookies. The proxy checks `auth.getClaims()` and refreshes sessions; AI routes and data-writing actions verify the user with `auth.getUser()`.

Application clients use the Supabase publishable-key configuration. Writes derive `user_id` from the authenticated user. The checked-in migrations enable RLS and ownership policies on `meals`, `meal_items`, `activities`, `user_preferences`, `fitness_goals`, and `weight_entries`. A composite `(meal_id, user_id)` foreign key prevents a meal item from referencing a differently owned meal.

`ai_daily_usage` enables RLS and revokes direct table access from clients. Its narrowly scoped `security definer` RPCs use an empty search path, derive identity from `auth.uid()`, and restrict execution to authenticated users. Quota increments use an atomic UPSERT to enforce caps even during concurrent requests.

These are source-level observations. Whether migrations, RLS, email templates, redirect URLs, and Google provider settings are correctly applied in the live Supabase project still requires separate verification. Do not change production schemas/data without approval.

## AI allowance and free manual tracking

- Each authenticated user has 20 AI analyses per day, shared by photo and text analysis.
- AI clarifications/refinements have a separate 60-call daily allowance and do not consume the 20-analysis allowance.
- Both reset at midnight Philippine time (`Asia/Manila`, UTC+8).
- Routes reserve usage before calling Gemini. Exhausted allowance returns HTTP 429; unavailable usage tracking blocks provider calls with HTTP 503.
- Manual food logging, exercise logging, goal/weight tracking, reports, and formula-based calculations do not call an AI model or consume AI credits. Deterministic scale adjustments also avoid AI calls.
- A failed model request currently leaves its allowance reserved. No refund mechanism was found; this is an unresolved finding below.
- Free user allowances do not establish that provider requests are free. Paid API calls require explicit approval.

## Product decisions to preserve

- Exercise-calorie displays are optional and default to hidden. Hiding them changes presentation, not saved activity history or the ability to enter smartwatch calories. Reported watch calories override formula estimates when supplied.
- Exercise calories are shown separately when enabled; they are never added to or subtracted from food calorie targets.
- The TDEE calculator recommends calorie and protein targets using local formula calculations, without an AI call. It uses adult Mifflin-St Jeor BMR and activity factors with modest goal adjustments and guards on automatic recommendations. Users explicitly save/customize their targets.
- Height entry supports centimetres and feet/inches; calculations use centimetres internally.
- Nutrition summaries preserve unknown manual macros as unknown/incomplete instead of treating missing values as measured zeroes.
- The application does not permanently store uploaded food photos in its current meal-persistence flow. Nutrition results and meal metadata are stored; this is not a claim about provider retention.
- Beginner-friendly functionality takes priority over technical complexity. Future web features must continue to work well on small screens.
- The planned daily meal calorie planner will distribute recommended calories across breakfast, lunch, dinner, and snacks, with customizable distribution. Manual calculations must remain free.
- Phase 6 multi-provider fallback must avoid charging additional user credits for the same logical request. The charging/retry design is future work.
- AI Fitness Coach remains Phase 7, with an allowance separate from food analyses. The proposed limit is one free session daily with up to eight AI replies, subject to future approval. No coach or coaching quota is implemented.
- React Native/Expo is planned for the Phase 9 Android app; the current repository contains the web application.

## Known limitations and unresolved findings

These findings require verification or future fixes. Recording them does not authorize implementation or database changes.

| Finding | Evidence and consequence | Follow-up |
| --- | --- | --- |
| Missing checked-in `meals.consumed_at` migration | Meal saving/time editing, history, dashboard, and reports reference this column, but no checked-in SQL creates it. A fresh schema from these files would lack it. | Verify the live schema and migration history; prepare an explicit migration under an approved task. |
| Different day boundaries | Dashboard today/yesterday summaries use browser-local midnight; reports, weight-date validation, and AI allowance use Manila dates. Users in other timezones may see different daily totals. | Choose and document a consistent tracking-day policy before changing behavior. |
| Failed AI requests retain usage | `reserveAiUsage()` runs before provider calls, with no refund path found. | Verify failure behavior and decide refund/idempotency semantics, including Phase 6 fallback. |
| Meal saving uses multiple inserts | `saveMeal()` inserts a meal, then its items, and attempts cleanup on failure. This is not one database transaction; cleanup may fail. | Verify partial-failure behavior and consider transactional persistence in a separately approved change. |
| Historical documentation differs from current code | Earlier plans describe a public guest scanner, onboarding wizard, `profiles`, and `nutrition_goals`; current code requires scanner authentication and uses a standalone goal form with `fitness_goals`. | Treat old documents as historical rationale, not current acceptance criteria. Reconcile them when related work is approved. |

Additional current scope limits: goals persist calorie/protein targets rather than custom carbohydrate/fat targets; TDEE is an estimate rather than measured expenditure; reports show seven days of food intake and cap their query at 2,000 meals. The provider foundation supports Gemini only. Capability-aware selection, additional providers, fallback, app-level retries/timeouts, distributed budgets, and idempotency remain future Phase 6 work; the meal planner and coaching also remain unimplemented. Existing SDK behavior and failed-call credit reservations are unchanged.

## Verified local checkpoint and future session continuity

- Inspection date: 2026-10-15 (UTC+8).
- Worktree: `C:\Users\Ped\GitHub\ai-fitness\.worktrees\supabase-auth`.
- Branch: `feature/supabase-auth`.
- Verified base commit: `ad986ef338415a3ca8df8d1f46f30c3c89be570f`, `docs: establish AI Fitness project context and roadmap`. Task #5 approves the local foundation checkpoint named `refactor: introduce Gemini AI provider abstraction`; obtain its hash from Git history rather than a self-referential hash inside its own documentation.
- Application verification: `npx.cmd --no-install vitest run` passed 285 tests across 64 files, including 7 new provider tests and 9 additional route quota/configuration cases. `npx.cmd --no-install tsc --noEmit --incremental false` passed. `npm.cmd run build` passed after a network-enabled rerun; the initial sandboxed attempt failed downloading the existing Geist Google Fonts. No AI API requests were made.
- Lint: the focused ESLint run covering all changed code/configuration passed. `npm.cmd run lint` reported 15 errors and 8 warnings in files unchanged from HEAD (unescaped JSX apostrophes, existing hook/purity issues, an explicit `any`, unused variables, and image/navigation warnings). These baseline findings remain unresolved and were not silently fixed in this extraction.
- Read-only review found no blocking regressions. One inherited minor remains deferred: quota integration fixtures directly assign their synthetic environment key before tests, so `vi.unstubAllEnvs()` does not restore the original pre-suite value. The provider's new isolated tests use `vi.stubEnv()` with cleanup.
- Compatibility evidence: existing photo/prompt, prepared-drink, material-uncertainty, additive-refinement, scale, auth, manual logging, and nutrition tests pass using mocked providers. Vitest aliases `server-only` to Next's bundled empty marker for Node tests; actual Next.js builds retain the server/client boundary checks. No live model or Supabase verification is claimed.
- Current milestone: Task #4 Gemini-only provider foundation, reviewed in Task #5 for one approved local commit. Fresh Task #5 verification passed all 285 tests across 64 files with none skipped, TypeScript, the production build, and diff checks. No further application code changes were needed during final review.
- Test configuration review: `vitest.config.mts` maps `server-only` to Next.js's bundled empty server marker so plain Node-based unit tests can load the guarded modules. This is a test-only resolution alias, not an exclusion or filter; Next.js application builds retain their server-only enforcement. `types.ts` exports only erased TypeScript types; runtime selector/adapter modules are guarded.
- Development artifacts: `.superpowers/sdd/.gitignore` and the plan-scoped progress/lint records are ignored local execution artifacts, confirmed with `git check-ignore`. They are not application files, are not required to build/test the app, and are excluded from the foundation commit along with the unrelated untracked files.
- No dependencies, model changes, additional providers, privileged credentials, database changes, paid calls, pushes, or deployments are included. Only the local foundation commit is authorized by Task #5.
- Unrelated untracked files to preserve: `src/app/auth/actions.ts.bak` and `t run`.
- Remaining problems: the findings listed above; live configuration and application verification remain outstanding.
- Next development task: review this foundation, then approve a bounded Phase 6 capability-selection and failure-policy step with mocked fallback tests before enabling another provider. Privileged budget storage, production migrations, paid calls, and new providers still need explicit approval. The Phase 5 enhancement remains planned in the roadmap's stated order.

After every completed development milestone, update this checkpoint and [ROADMAP.md](ROADMAP.md) with completed features, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next task. Record untested or partially verified work honestly. Verify Git state again each session; this checkpoint is not a substitute for inspecting the current checkout.

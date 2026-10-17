# AI Fitness project context

Last reviewed: 2026-10-16 (UTC+8). This document records source inspection and owner-approved project decisions. It is the starting point for future sessions alongside [AGENTS.md](AGENTS.md) and [ROADMAP.md](ROADMAP.md).

## Purpose and development priorities

AI Fitness helps users track nutrition, meals, exercise, and personal goals. Food analysis uses AI; manual tracking and formula calculations remain available without AI credits. Keep workflows beginner-friendly and mobile-friendly, with clear labels, responsive layouts, accessible controls, and understandable loading/error states. Prefer free-tier services and avoid unexpected expenses.

The owner reports Phases 1-5 completed, and their implementations are present in this checkout. Phase 6 now includes capability-aware fallback, durable idempotent admission, distributed provider limits/cooldowns/concurrency, kill switches, and disabled real Groq/Cloudflare adapters. Gemini remains the only production registration. All AI execution defaults disabled until the new migration, server credential, verified free-tier limits, and activation are approved. The Phase 6 implementation is committed as `088adfe`; the Gemini reservation fix is uncommitted and not approved for commit. No live model, database change, or deployment was used. See [Phase 6 operations](docs/phase-6-operations.md) for exact activation requirements and limitations.

## Technologies and architecture

The checked-in `package.json` declares Next.js 16.3.7, React/React DOM 19.2.8, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 4, Supabase JS with `@supabase/ssr`, and Google's `@google/genai` SDK. Dependency ranges are resolved by `package-lock.json`; do not assume these are the latest upstream versions.

| Location | Responsibility |
| --- | --- |
| `src/app/` | Next.js App Router pages, layouts, server actions, and API routes |
| `src/app/api/food/` | Authenticated photo analysis, text analysis, and refinement endpoints |
| `src/app/api/ai/usage/` | Authenticated allowance status endpoint |
| `src/components/` | Food logging, clarification, dashboard, activity, goals, and settings UI |
| `src/lib/` | Zod validation, food normalization, date handling, calculations, summaries, and AI allowance helpers |
| `src/lib/ai/` | Server-only providers/router, durable request context, trusted accounting RPC client, limits/cooldowns/concurrency guards, and mocked/local SQL tests |
| `src/lib/supabase/` | Browser/server SSR clients, session refresh, and protected-page classification |
| `src/proxy.ts` | Next.js session-refresh and page-access entry point |
| `supabase/migrations/` | Checked-in database tables, constraints, RLS, and allowance RPCs |
| `docs/superpowers/` | Historical design specifications and implementation plans |

Server actions perform authenticated data writes. Server-rendered pages and browser components read Supabase data with ownership filters and RLS. The three food AI route handlers call `AiProvider.generate()` through `getAiProvider()`, which registers only guarded Gemini with the existing Interactions API/model. Routing accepts server-supplied providers, prefers Gemini, and filters enabled/available state, text, vision, image count, and structured JSON support. The real Groq adapter defaults disabled and is not registered. The disabled Cloudflare configuration reader uses private server variables only; credentials alone cannot register or enable it. No client-controlled provider selection exists. Runtime provider, routing, context, and accounting modules use `server-only` guards.

The transport receives ordered text/base64-image parts and a JSON response schema and returns raw output text. Routes retain prompts, JSON/Zod parsing, normalizations, clarification flows, and additive/legacy refinement handling. `withAiRequest()` surrounds each endpoint; `reserveAiUsage()` now requires that durable context and verifies the user before atomic admission. A key is bound to the endpoint/payload/user, and final responses are replayed. `guardProvider()` reserves shared capacity before every real attempt and settles health/concurrency afterward; it never reserves another user credit. Missing accounting or credentials fail closed. Ordinary Supabase clients and RLS remain unchanged.

Task #6 adds at most two distinct compatible attempts, a 20-second per-attempt deadline, and a 45-second overall generation deadline. Settings are server-only and cannot exceed these bounds. Gemini retains the application's ten-image range. Photos never go to text-only or lower-image-capacity providers; disabled/unavailable/non-JSON providers are skipped. Availability is server-declared state, not a live health probe or a shared circuit breaker.

Only HTTP 408/429/500/502/503/504, known connection errors, timeouts, and provider-local quota/cooldown/concurrency exhaustion permit compatible fallback. Auth errors, invalid requests, validation/unknown errors, cancellation, daily user-credit exhaustion, and uncertain accounting stop. The SDK can wrap unknown client errors as connection errors, so the router verifies the underlying cause. Malformed/empty model output does not cause another model request. Logs no longer include raw provider error objects.

Routes forward caller cancellation; each attempt receives its own abort signal. Gemini SDK retries are explicitly disabled, verified using the real SDK with mocked fetch. Timers/listeners are cleaned up and late completions are ignored. Client cancellation cannot guarantee upstream cancellation or a billing refund. Known router failures return sanitized, uncached responses: 503 for unavailable/incompatible providers, 504 for timeout, and 408 for cancellation. Other existing route error handling is preserved.

Gemini model capabilities/free-tier pricing and Groq `openai/gpt-oss-20b` text/JSON/free-plan availability were checked in official documentation on 2026-10-15. These are advertised capabilities, not this account's live eligibility or tested nutrition quality. Sources and the disabled backup's limitations are recorded in [Phase 6 operations](docs/phase-6-operations.md). No model API call was made.

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
- Phase 6 fallback and keyed HTTP replays now preserve one user credit through local durable admission. Deploying the migration/configuration remains unapproved. Failure-credit refunds remain a separate policy decision.
- AI Fitness Coach remains Phase 7, with an allowance separate from food analyses. The proposed limit is one free session daily with up to eight AI replies, subject to future approval. No coach or coaching quota is implemented.
- React Native/Expo is planned for the Phase 9 Android app; the current repository contains the web application.

## Known limitations and unresolved findings

These findings require verification or future fixes. Recording them does not authorize implementation or database changes.

| Finding | Evidence and consequence | Follow-up |
| --- | --- | --- |
| Missing checked-in `meals.consumed_at` migration | Meal saving/time editing, history, dashboard, and reports reference this column, but no checked-in SQL creates it. A fresh schema from these files would lack it. | Verify the live schema and migration history; prepare an explicit migration under an approved task. |
| Different day boundaries | Dashboard today/yesterday summaries use browser-local midnight; reports, weight-date validation, and AI allowance use Manila dates. Users in other timezones may see different daily totals. | Choose and document a consistent tracking-day policy before changing behavior. |
| Failed AI requests retain usage | Locally verified: one credit is charged on admission and retained on later failure, including provider-capacity denial. Replays do not charge again. | Recommended future policy: atomic refunds only for proven pre-dispatch failures, with original-day accounting and abuse limits; not implemented or approved. |
| Meal saving uses multiple inserts | `saveMeal()` inserts a meal, then its items, and attempts cleanup on failure. This is not one database transaction; cleanup may fail. | Verify partial-failure behavior and consider transactional persistence in a separately approved change. |
| Historical documentation differs from current code | Earlier plans describe a public guest scanner, onboarding wizard, `profiles`, and `nutrition_goals`; current code requires scanner authentication and uses a standalone goal form with `fitness_goals`. | Treat old documents as historical rationale, not current acceptance criteria. Reconcile them when related work is approved. |

Additional current scope limits: goals persist calorie/protein targets rather than custom carbohydrate/fat targets; TDEE is an estimate rather than measured expenditure; reports show seven days of food intake and cap their query at 2,000 meals. Live production state is unverified; local production registration remains Gemini-only. The meal planner and coaching remain unimplemented. Shared request/token/budget limits, health cooldowns, concurrency leases, and idempotency are implemented locally; real activation is disabled. Paid execution is rejected even if its database toggle is changed.

The local migration `20261015_ai_request_control.sql` atomically binds authenticated request keys/hashes to admission and 20/60 usage, stores final-response replay for 24 hours, and retains permanent key tombstones. Concurrent in-flight/interrupted keys return 409, different payloads return 409, expired replay returns 410. No migration was executed against Supabase and no credential was added. The server-only accounting client references a service-role key but remains unusable until approved configuration. Gemini now reserves per-request serialized text/schema bytes and high-resolution image allowances, with margin and an enforced 16,384-token output/thinking cap; oversized input is rejected rather than under-reserved. This is a conservative estimate, not an exact tokenizer or guaranteed billing bound. Groq remains disabled with its old full-model reservation exceeding published free-tier TPM. Never inflate configured caps above actual limits. See the operations guide for the formula, staging quality checks, fixed-window boundaries, physical replay-body purge scheduling, lost-key UX, storage costs, and separate-connection SQL verification limitations.

## Verified local checkpoint and future session continuity

- Reviewed 2026-10-15 (UTC+8), worktree `C:\Users\Ped\GitHub\ai-fitness\.worktrees\supabase-auth`, branch `feature/supabase-auth`.
- Latest verified local commit: `088adfefcc5d51ff1ebf9e12085e11c40dfa4a2e` (`feat: add durable AI request protection and provider safeguards`). The subsequent Gemini token reservation fix is uncommitted and requires owner approval before committing. No push, deployment, live SQL execution, or AI API request was made.
- Previous committed milestone verification: Complete Vitest passed 385 tests across 73 files with none skipped. TypeScript (`--noEmit --incremental false`), relevant ESLint, and the Next.js production build passed after the final code changes. All model transport was mocked.
- Full lint was rerun: 15 errors and 8 warnings, all in files unchanged from HEAD. Existing unescaped JSX apostrophes, hook/purity issues, explicit `any`, unused variables, and image/navigation warnings remain outside this task. The focused lint run passes.
- Tests include real local SQL execution through the development-only PGlite dependency, HTTP/SQL/guard integration with mocked SDK, routing/image safety, cancellation/timeouts, primary/fallback accounting, duplicates, key conflicts, 20/60 limits, shared caps/budgets, Pacific reset/DST, concurrency leases/cooldowns, and role permissions. PGlite queues concurrent callers on one connection; separate-connection PostgreSQL and live deployment verification remain activation prerequisites.
- An independent read-only safety review found the Gemini quota-day mismatch; the SQL now uses Pacific provider days with DST regressions, separately from Manila user days and UTC budgets. A null-operation SQL case was also reproduced and corrected. Existing prompt/prepared-drink/material-uncertainty/additive/legacy/scale/auth/manual/nutrition tests remain part of the full suite.
- Deferred review minors: current UI callers cannot recover an internally generated browser key after a lost response; explicit caller-provided keys and one network retry are supported. Replay-body physical cleanup requires scheduling the provided purge RPC; logical expiry alone is not deletion. The inherited quota test fixture's direct synthetic environment assignment remains unchanged.
- Vitest maps `server-only` to Next's bundled empty marker for Node tests, without exclusions or skipped tests. Actual Next builds retain server/client boundary checks. Existing route/transport unit tests mock the new guard explicitly; new integration suites exercise the real context, guard, router, and SQL with only auth/SDK/HTTP boundaries mocked.
- `.superpowers/sdd` execution/lint artifacts are ignored and not required to build or test. Preserve unrelated untracked `src/app/auth/actions.ts.bak` and `t run`; neither is part of Phase 6.
- Decisions: retain the existing SDK/prompts/schema placement; no orchestration dependency. Preserve failure-credit charging until a separately approved refund policy. Default all execution off, reject all paid policies, retain ambiguous reservations, and use the new conservative request-size estimate plus pinned image/output caps for Gemini. Groq retains its disabled full-model ceiling. Neither approach is permission to inflate real quotas; exact tokenizer/billing bounds are not claimed.
- Next task: owner review of the complete local diff/migration and operational requirements, then approved disposable multi-connection database/configuration verification. The earlier checkpoint commit was approved; committing the current fix is not yet approved. No real backup registration/key, production schema change, credential provisioning, paid activation, push, or deployment is approved. Phase 5 meal planning stays pending; Coach stays Phase 7.

See [Phase 6 operations](docs/phase-6-operations.md) for activation, failure-credit options, exact environment names, reset rules, privacy/storage considerations, and verified provider sources. After each milestone update this context and [ROADMAP.md](ROADMAP.md), distinguishing implemented, locally tested, deployed, planned, and proposed states. Always inspect Git rather than treating this checkpoint as live state.

Commit review: no blocking code issue found for the disabled checkpoint. Fresh focused verification passed 46 tests across four files (control database/store, HTTP integration, and provider foundation); application code was unchanged and the full suite/build were not repeated. Prior full verification remains 385/73 with TypeScript/relevant lint/build passing. The operations guide records exact migration dependencies, quota feasibility, ordered cutover, and Gemini staging/production smoke checks; live continuity is not yet verified.

Gemini reservation follow-up (uncommitted): local size-based estimate replaces the 1,114,112-token constant. Shared SDK/accounting constants pin high-resolution images and 16,384 output/thinking tokens; estimated input over 131,072 returns 413 before an outbound attempt. User quotas/auth/idempotency/disabled defaults and failure-credit policy are unchanged. No schema or dependency change and no token-count/model API call. Verified locally: 395 tests across 74 files, none skipped; TypeScript, relevant ESLint, and production build passed. Full lint retains 15 existing errors and 8 warnings in unchanged files. A separate read-only review found no critical/important issues; the estimate is not a proven tokenizer/billing upper bound.

Cloudflare adapter follow-up (2026-10-16, uncommitted): prepared server-only native REST transport for fixed Llama 4 Scout with a conservative one-photo application cap and schema-preserving JSON output. Production registration, existing quota/idempotency code, and SQL are unchanged. Environment-only configuration always creates a disabled provider; the current guard rejects Cloudflare until distributed Neuron accounting is implemented. No environment file was read or written, no real model/token check was called, and no activation/commit/deployment is authorized. See [private setup](docs/cloudflare-workers-ai-setup.md). Verification: 428 tests across 75 files passed; TypeScript, targeted lint, and the production build passed. Read-only review found no blocking adapter issue; additional MIME/body-limit coverage was added. Live provider compatibility remains unverified.

## 2026-10-17 local draft: no-outbound refund, not yet verified or approved

A proposed local-only patch to `20261015_ai_request_control.sql` refunds an admitted
analysis/refinement credit only if the finalized response is an HTTP error and
there were **zero approved provider attempts**. The refund and durable response
replay finalize in one transaction under the existing global lock, on the
**original Manila usage day**. Replayed failures cannot refund twice. Any
approved provider attempt, timeout, crash, ambiguous transport, or failed
finalization continues to retain its credit. Existing 20/60 limits and disabled
provider defaults remain unchanged. See the updated operations guide.

The patch is built against the supplied 2026-10-17 ZIP; it was not written to
the user's Windows worktree, committed, migrated, or deployed. Vitest/build
have not yet been rerun for this patch because npm dependencies were unavailable
in the review sandbox. Run the focused/full tests and build locally after the
hash-checked backup/patch script. The earlier 428-test checkpoint applies to
the *pre-patch* Cloudflare adapter, not to this new refund change. The live
migration state is not verified: if the original request-control migration was
applied, do **not** rerun an edited create migration; create and review a
separate additive migration instead. Owner approval remains required for any
real database change, push, release, or production activation.

# AI Fitness project context

Last reviewed: 2026-10-15 (UTC+8). This document records source inspection and owner-approved project decisions. It is the starting point for future sessions alongside [AGENTS.md](AGENTS.md) and [ROADMAP.md](ROADMAP.md).

## Purpose and development priorities

AI Fitness helps users track nutrition, meals, exercise, and personal goals. Food analysis uses AI; manual tracking and formula calculations remain available without AI credits. Keep workflows beginner-friendly and mobile-friendly, with clear labels, responsive layouts, accessible controls, and understandable loading/error states. Prefer free-tier services and avoid unexpected expenses.

The owner reports Phases 1-5 completed, and their implementations are present in this checkout. This documentation milestone did not run application tests, a production build, live authentication, or database verification; it does not independently certify those phases or a deployment.

## Technologies and architecture

The checked-in `package.json` declares Next.js 16.3.7, React/React DOM 19.2.8, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 4, Supabase JS with `@supabase/ssr`, and Google's `@google/genai` SDK. Dependency ranges are resolved by `package-lock.json`; do not assume these are the latest upstream versions.

| Location | Responsibility |
| --- | --- |
| `src/app/` | Next.js App Router pages, layouts, server actions, and API routes |
| `src/app/api/food/` | Authenticated photo analysis, text analysis, and refinement endpoints |
| `src/app/api/ai/usage/` | Authenticated allowance status endpoint |
| `src/components/` | Food logging, clarification, dashboard, activity, goals, and settings UI |
| `src/lib/` | Zod validation, food normalization, date handling, calculations, summaries, and AI allowance helpers |
| `src/lib/supabase/` | Browser/server SSR clients, session refresh, and protected-page classification |
| `src/proxy.ts` | Next.js session-refresh and page-access entry point |
| `supabase/migrations/` | Checked-in database tables, constraints, RLS, and allowance RPCs |
| `docs/superpowers/` | Historical design specifications and implementation plans |

Server actions perform authenticated data writes. Server-rendered pages and browser components read Supabase data with ownership filters and RLS. AI provider calls stay in server route handlers. The three food AI routes currently call Gemini's Interactions API with the hard-coded model identifier `gemini-3.5-flash-lite`; no provider abstraction or automatic fallback is implemented.

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

Additional current scope limits: goals persist calorie/protein targets rather than custom carbohydrate/fat targets; TDEE is an estimate rather than measured expenditure; reports show seven days of food intake and cap their query at 2,000 meals; provider routing, the meal planner, and coaching remain unimplemented.

## Verified local checkpoint and future session continuity

- Inspection date: 2026-10-15 (UTC+8).
- Worktree: `C:\Users\Ped\GitHub\ai-fitness\.worktrees\supabase-auth`.
- Branch: `feature/supabase-auth`.
- Latest verified local commit: `9b07977b0d59f5809d9cd208a50b23d5e732ddcb`, `feat: add personal goals, TDEE calculator and nutrition reports`, dated 2026-10-14 02:02:48 +0800.
- Application tests/build: not run in the inspection or this documentation milestone; no passing result claimed. Use the commands in `AGENTS.md` for future application work.
- Documentation verification: content and roadmap consistency reviewed; local Markdown links, whitespace, and documentation-only change scope checked; `git diff --check` passed. The generated Next.js instructions and hashes of the two unrelated untracked files were preserved. No changes are staged.
- Current milestone: permanent project documentation only; no application fixes, migrations, paid calls, commits, pushes, or deployments authorized by this task.
- Unrelated untracked files to preserve: `src/app/auth/actions.ts.bak` and `t run`.
- Remaining problems: the findings listed above; live configuration and application verification remain outstanding.
- Next development task: Phase 6, Auto Best Multi-AI Provider Support, awaiting owner approval. The Phase 5 enhancement remains planned in the roadmap's stated order.

After every completed development milestone, update this checkpoint and [ROADMAP.md](ROADMAP.md) with completed features, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next task. Record untested or partially verified work honestly. Verify Git state again each session; this checkpoint is not a substitute for inspecting the current checkout.

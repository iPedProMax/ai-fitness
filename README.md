# AI Fitness

AI Fitness is a nutrition and fitness tracking web app built with Next.js, TypeScript, Tailwind CSS, Supabase, and Gemini. Signed-in users can analyze food photos or descriptions, log food manually, save meals, track activities, set calorie/protein goals, estimate TDEE, record weight, and review nutrition reports.

Manual food and exercise tracking and the TDEE calculator are free and use no AI credits. Each authenticated user has 20 AI analyses and a separate 60-call AI clarification allowance per day, resetting at midnight Philippine time. Exercise-calorie displays are optional; smartwatch calorie entry remains available when displays are hidden.

## Project documentation

- [AGENTS.md](AGENTS.md): development rules, safety requirements, and verification commands.
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md): architecture, implemented features, product decisions, known issues, and the current local checkpoint.
- [ROADMAP.md](ROADMAP.md): exact phase order, planned enhancements, and the next task.
- [Historical designs and plans](docs/superpowers/): earlier rationale; some specifications differ from current behavior.

## Local development

Use a Node.js version supported by the installed Next.js release and npm. Start in the authorized `feature/supabase-auth` worktree and inspect Git status before changes.

Install the lockfile dependencies, then start development:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [localhost:3000](http://localhost:3000). On other shells use `npm` instead of `npm.cmd`.

Local authentication/data flows require private local Supabase configuration; AI analysis also requires server-only Gemini configuration. Arrange configuration with the project owner. Do not print, share, or commit credentials or environment-file contents. Paid AI calls require explicit approval.

The SQL files under `supabase/migrations/` describe the checked-in schema. Confirm the target project and migration state before applying anything; production schema/data changes require approval. A migration for `meals.consumed_at` is currently missing from the repository, so these files alone do not recreate the full schema expected by the app. See `PROJECT_CONTEXT.md` before database setup.

## Verification

```powershell
npx.cmd --no-install vitest run
npm.cmd run lint
npm.cmd run build
```

Vitest tests live alongside the source; there is no `npm test` script. Feature work requires meaningful tests, the complete test suite, and a production build. Tests should mock AI providers rather than incur paid calls. See `PROJECT_CONTEXT.md` for the latest actual verification results and any baseline failures.

## Development status

Phases 1-5 are owner-confirmed completed milestones with implementations present in source. The daily meal calorie planner remains a pending Phase 5 enhancement. Phase 6 now has local durable idempotency, distributed limits/cooldowns/concurrency, bounded fallback, kill switches, and a disabled real Groq text adapter. Gemini is the only production registration; AI execution defaults disabled until approved migration/configuration. Paid execution is blocked. The AI Fitness Coach remains Phase 7 with a separately proposed allowance. Read [Phase 6 operations](docs/phase-6-operations.md) before configuring AI: conservative token reservations may exceed free-tier quotas, replay cleanup requires scheduling, and live activation is not approved. See `PROJECT_CONTEXT.md` for verified checks and remaining limitations.

Do not commit, push, deploy, modify production Supabase schemas/data, or make paid API calls without explicit approval. Preserve unrelated changes and untracked files.

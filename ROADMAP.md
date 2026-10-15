# AI Fitness roadmap

Last reviewed: 2026-10-15 (UTC+8). Preserve this development order. Phase 6 includes its Gemini-only foundation and selection/fallback logic tested with mocked backups; Phase 7 remains the AI Fitness Coach. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for current implementation and limitations, and [AGENTS.md](AGENTS.md) for working rules.

Completed status below reflects owner-confirmed milestones with implementations present in source. The current foundation's automated checks and verification limits are recorded below; no live deployment is verified.

1. **Phases 1-3 - Food Analysis, Authentication, AI Credits: Completed.** Photo/text food analysis, clarifications, manual logging, meal saving/history, Supabase authentication, and server-enforced daily allowances.
2. **Phase 4 - Exercise & Activity Tracking: Completed.** Manual activities, calorie estimates or smartwatch values, history, and optional calorie-burn displays. Logging remains free even when displays are hidden.
3. **Phase 5 - Personal Goals, TDEE, Weight Progress and Reports: Completed.** Calorie/protein goals, free formula-based TDEE calculator, centimetres and feet/inches, optional weight tracking, and nutrition reports.
4. **Phase 5 Enhancement - Daily Meal Calorie Planner: Planned.** Automatically distribute recommended daily calories across breakfast, lunch, dinner, and snacks. Make distribution customizable. Manual calculations must be free and consume no AI credits. This is not implemented.
5. **Phase 6 - Auto Best Multi-AI Provider Support: LOCAL IMPLEMENTATION, ACTIVATION PENDING.** Capability routing/fallback, durable keyed admission/replay, shared limits/budgets/cooldowns/concurrency, kill switches, and a disabled real Groq text adapter are implemented locally. Gemini is the only production registration. Prompts, nutrition/Zod/clarifications, separate 20/60 Manila-day limits, and free manual tracking are preserved. All execution defaults off; paid execution is rejected. Migration/configuration, practical free-tier token bounds, independent-connection PostgreSQL verification, and any real backup activation require review. See [operations](docs/phase-6-operations.md).
6. **Phase 7 - AI Fitness Coach: Planned.** Use a separate coaching allowance from food analyses. Proposed limit: one free session daily with up to eight AI replies, subject to future approval. Coaching and its quota are not implemented. The coach must remain Phase 7, not Phase 6.
7. **Phase 8 - Website Polish and Beta/Public Launch.** Future work; keep interfaces beginner-friendly and mobile-friendly. Deployments require explicit approval.
8. **Phase 9 - Android Mobile App.** Future work using planned React Native/Expo. Preserve simple mobile workflows and existing product decisions.
9. **Phase 10 - Experiment With Our Own AI Model: Optional final phase.** Exploratory work after the preceding phases; paid API calls and expenses require approval.

## Current checkpoint

Pre-checkpoint HEAD: `d1483b741d4b1a418e34b85afcff204cbe7b854e` on `feature/supabase-auth`. The owner approved one local checkpoint commit, `feat: add durable AI request protection and provider safeguards`; use `git log -1` for the resulting commit. Full Vitest passed 385 tests across 73 files with none skipped; TypeScript, relevant ESLint, and production build passed after the final code changes. Full lint retains 15 pre-existing errors and 8 warnings in untouched files. Local SQL tests use PGlite and mocked model transport; no live AI call or Supabase change was made. Next task: one owner review of the complete local implementation/migration, followed by separately approved database/configuration verification. The Phase 5 enhancement remains pending and Phase 7 remains the Coach.

Before related implementation, review the unresolved findings in `PROJECT_CONTEXT.md`: missing `meals.consumed_at` migration, timezone differences, usage retained on model failures, nontransactional meal saving, and outdated historical specifications. These require verification or future fixes and have not been silently resolved.

The earlier documentation and foundation checkpoints were committed locally without pushing. The latest task authorizes review and one local commit of the intended Phase 6 code, tests, documentation, and unexecuted migration files. Next.js instructions and unrelated untracked files remain preserved; `.superpowers/sdd` artifacts remain ignored. Push, deployment, live database changes, credential provisioning, and provider activation remain unapproved. See `PROJECT_CONTEXT.md` for decisions and limitations.

## Maintaining this roadmap

After every completed development milestone, update this roadmap and `PROJECT_CONTEXT.md` with features completed, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next development task. Keep planned and proposed work distinct from implemented and verified behavior. Do not mark untested features as newly verified completions or change phase order without owner direction.

Commit review checkpoint: no blocking code issue for saving the disabled implementation; focused verification passed 46 tests across four files without application edits. Full-suite/build results above are from the prior implementation verification, not a new run. Activation remains a separate approved release task, with existing Gemini continuity explicitly gated on migration/configuration and smoke verification.

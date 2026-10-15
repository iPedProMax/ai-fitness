# AI Fitness roadmap

Last reviewed: 2026-10-15 (UTC+8). Preserve this development order. Phase 6 has begun with its Gemini-only foundation; Phase 7 remains the AI Fitness Coach. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for current implementation and limitations, and [AGENTS.md](AGENTS.md) for working rules.

Completed status below reflects owner-confirmed milestones with implementations present in source. The current foundation's automated checks and verification limits are recorded below; no live deployment is verified.

1. **Phases 1-3 - Food Analysis, Authentication, AI Credits: Completed.** Photo/text food analysis, clarifications, manual logging, meal saving/history, Supabase authentication, and server-enforced daily allowances.
2. **Phase 4 - Exercise & Activity Tracking: Completed.** Manual activities, calorie estimates or smartwatch values, history, and optional calorie-burn displays. Logging remains free even when displays are hidden.
3. **Phase 5 - Personal Goals, TDEE, Weight Progress and Reports: Completed.** Calorie/protein goals, free formula-based TDEE calculator, centimetres and feet/inches, optional weight tracking, and nutrition reports.
4. **Phase 5 Enhancement - Daily Meal Calorie Planner: Planned.** Automatically distribute recommended daily calories across breakfast, lunch, dinner, and snacks. Make distribution customizable. Manual calculations must be free and consume no AI credits. This is not implemented.
5. **Phase 6 - Auto Best Multi-AI Provider Support: IN PROGRESS (foundation only).** A server-only provider interface and Gemini adapter now serve the existing food routes. Gemini remains the only enabled provider; prompts, JSON/Zod handling, clarification flows, and existing credit reservations are preserved. Provider selection, fallback, retries/timeouts, distributed safeguards, and idempotency remain pending approval and implementation. Avoid extra user credits during fallback; prefer free-tier services and avoid unexpected expenses.
6. **Phase 7 - AI Fitness Coach: Planned.** Use a separate coaching allowance from food analyses. Proposed limit: one free session daily with up to eight AI replies, subject to future approval. Coaching and its quota are not implemented. The coach must remain Phase 7, not Phase 6.
7. **Phase 8 - Website Polish and Beta/Public Launch.** Future work; keep interfaces beginner-friendly and mobile-friendly. Deployments require explicit approval.
8. **Phase 9 - Android Mobile App.** Future work using planned React Native/Expo. Preserve simple mobile workflows and existing product decisions.
9. **Phase 10 - Experiment With Our Own AI Model: Optional final phase.** Exploratory work after the preceding phases; paid API calls and expenses require approval.

## Current checkpoint

Verified base commit: `ad986ef338415a3ca8df8d1f46f30c3c89be570f` on `feature/supabase-auth`. Task #5 approves one local foundation checkpoint named `refactor: introduce Gemini AI provider abstraction`; resolve its hash from Git history. Task #4 implements only the initial Gemini provider foundation. Fresh Task #5 verification passed all 285 tests across 64 files with none skipped, TypeScript, the production build, and diff checks. The build used network access for existing Google Fonts. Focused lint on changed code/configuration passed; full-project lint reported 15 errors and 8 warnings in untouched files. Read-only review found no blocking regressions. No live AI calls or database changes were made. Next task: approve a bounded capability-selection/failure-policy step using mocks. No additional provider activation is authorized. The Phase 5 enhancement remains planned and Phase 7 remains the Coach.

Before related implementation, review the unresolved findings in `PROJECT_CONTEXT.md`: missing `meals.consumed_at` migration, timezone differences, usage retained on model failures, nontransactional meal saving, and outdated historical specifications. These require verification or future fixes and have not been silently resolved.

The earlier documentation checkpoint was committed locally without pushing. The foundation checkpoint preserves existing Next.js instructions and unrelated untracked files. Ignored `.superpowers/sdd` execution artifacts are excluded. Task #5 authorizes only the local foundation commit; no push, deployment, additional providers, or further implementation is authorized. See `PROJECT_CONTEXT.md` for architecture decisions and remaining problems.

## Maintaining this roadmap

After every completed development milestone, update this roadmap and `PROJECT_CONTEXT.md` with features completed, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next development task. Keep planned and proposed work distinct from implemented and verified behavior. Do not mark untested features as newly verified completions or change phase order without owner direction.

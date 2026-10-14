# AI Fitness roadmap

Last reviewed: 2026-10-15 (UTC+8). Preserve this development order. Phase 6 is the next assigned development phase; Phase 7 is the AI Fitness Coach. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for current implementation and limitations, and [AGENTS.md](AGENTS.md) for working rules.

Completed status below reflects owner-confirmed milestones with implementations present in source. This documentation milestone did not rerun application tests/builds or verify a live deployment.

1. **Phases 1-3 - Food Analysis, Authentication, AI Credits: Completed.** Photo/text food analysis, clarifications, manual logging, meal saving/history, Supabase authentication, and server-enforced daily allowances.
2. **Phase 4 - Exercise & Activity Tracking: Completed.** Manual activities, calorie estimates or smartwatch values, history, and optional calorie-burn displays. Logging remains free even when displays are hidden.
3. **Phase 5 - Personal Goals, TDEE, Weight Progress and Reports: Completed.** Calorie/protein goals, free formula-based TDEE calculator, centimetres and feet/inches, optional weight tracking, and nutrition reports.
4. **Phase 5 Enhancement - Daily Meal Calorie Planner: Planned.** Automatically distribute recommended daily calories across breakfast, lunch, dinner, and snacks. Make distribution customizable. Manual calculations must be free and consume no AI credits. This is not implemented.
5. **Phase 6 - Auto Best Multi-AI Provider Support: NEXT.** Add provider selection and fallback. Avoid charging users additional credits during fallback for the same logical request. Prefer free-tier services and avoid unexpected expenses. Implementation awaits owner approval; the current app uses Gemini only.
6. **Phase 7 - AI Fitness Coach: Planned.** Use a separate coaching allowance from food analyses. Proposed limit: one free session daily with up to eight AI replies, subject to future approval. Coaching and its quota are not implemented. The coach must remain Phase 7, not Phase 6.
7. **Phase 8 - Website Polish and Beta/Public Launch.** Future work; keep interfaces beginner-friendly and mobile-friendly. Deployments require explicit approval.
8. **Phase 9 - Android Mobile App.** Future work using planned React Native/Expo. Preserve simple mobile workflows and existing product decisions.
9. **Phase 10 - Experiment With Our Own AI Model: Optional final phase.** Exploratory work after the preceding phases; paid API calls and expenses require approval.

## Current checkpoint

Latest verified local commit: `9b07977b0d59f5809d9cd208a50b23d5e732ddcb` on `feature/supabase-auth` (2026-10-14 02:02:48 +0800). The present milestone creates permanent project documentation only. Application tests/build were not run for it; no application fixes are included. Next development task: Phase 6, awaiting approval. The Phase 5 enhancement remains planned; its placement above does not mark it completed or authorize its implementation.

Before related implementation, review the unresolved findings in `PROJECT_CONTEXT.md`: missing `meals.consumed_at` migration, timezone differences, usage retained on model failures, nontransactional meal saving, and outdated historical specifications. These require verification or future fixes and have not been silently resolved.

Documentation verification: content/phase consistency, local links, whitespace, and file scope checked; `git diff --check` passed. Existing Next.js instructions and unrelated untracked files were preserved. No changes are staged; application tests/build remain unrun for this milestone.

## Maintaining this roadmap

After every completed development milestone, update this roadmap and `PROJECT_CONTEXT.md` with features completed, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next development task. Keep planned and proposed work distinct from implemented and verified behavior. Do not mark untested features as newly verified completions or change phase order without owner direction.

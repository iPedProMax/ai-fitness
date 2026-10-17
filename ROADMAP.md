# AI Fitness roadmap

Last reviewed: 2026-10-16 (UTC+8). Preserve this development order. Phase 6 includes its Gemini-only foundation and selection/fallback logic tested with mocked backups; Phase 7 remains the AI Fitness Coach. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for current implementation and limitations, and [AGENTS.md](AGENTS.md) for working rules.

Completed status below reflects owner-confirmed milestones with implementations present in source. The current foundation's automated checks and verification limits are recorded below; no live deployment is verified.

1. **Phases 1-3 - Food Analysis, Authentication, AI Credits: Completed.** Photo/text food analysis, clarifications, manual logging, meal saving/history, Supabase authentication, and server-enforced daily allowances.
2. **Phase 4 - Exercise & Activity Tracking: Completed.** Manual activities, calorie estimates or smartwatch values, history, and optional calorie-burn displays. Logging remains free even when displays are hidden.
3. **Phase 5 - Personal Goals, TDEE, Weight Progress and Reports: Completed.** Calorie/protein goals, free formula-based TDEE calculator, centimetres and feet/inches, optional weight tracking, and nutrition reports.
4. **Phase 5 Enhancement - Daily Meal Calorie Planner: Planned.** Automatically distribute recommended daily calories across breakfast, lunch, dinner, and snacks. Make distribution customizable. Manual calculations must be free and consume no AI credits. This is not implemented.
5. **Phase 6 - Auto Best Multi-AI Provider Support: LOCAL IMPLEMENTATION, ACTIVATION PENDING.** Capability routing/fallback, durable keyed admission/replay, shared limits/budgets/cooldowns/concurrency, kill switches, and disabled real Groq text and Cloudflare vision adapters are implemented locally. Gemini is the only production registration. Prompts, nutrition/Zod/clarifications, separate 20/60 Manila-day limits, and free manual tracking are preserved. All execution defaults off; paid execution is rejected. Migration/configuration, verified account quotas, independent-connection PostgreSQL verification, and any real backup activation require review. See [operations](docs/phase-6-operations.md).
6. **Phase 7 - AI Fitness Coach: Planned.** Use a separate coaching allowance from food analyses. Proposed limit: one free session daily with up to eight AI replies, subject to future approval. Coaching and its quota are not implemented. The coach must remain Phase 7, not Phase 6.
7. **Phase 8 - Website Polish and Beta/Public Launch.** Future work; keep interfaces beginner-friendly and mobile-friendly. Deployments require explicit approval.
8. **Phase 9 - Android Mobile App.** Future work using planned React Native/Expo. Preserve simple mobile workflows and existing product decisions.
9. **Phase 10 - Experiment With Our Own AI Model: Optional final phase.** Exploratory work after the preceding phases; paid API calls and expenses require approval.

## Current checkpoint

Latest local commit: `088adfefcc5d51ff1ebf9e12085e11c40dfa4a2e` on `feature/supabase-auth`. The subsequent Gemini token reservation fix is uncommitted and not approved for commit. At the committed milestone, full Vitest passed 385 tests across 73 files with none skipped; TypeScript, relevant ESLint, and production build passed after the final code changes. Full lint retains 15 pre-existing errors and 8 warnings in untouched files. Local SQL tests use PGlite and mocked model transport; no live AI call or Supabase change was made. Next task: review the reservation fix, then separately approved database/configuration verification before activation. The Phase 5 enhancement remains pending and Phase 7 remains the Coach.

Before related implementation, review the unresolved findings in `PROJECT_CONTEXT.md`: missing `meals.consumed_at` migration, timezone differences, usage retained on model failures, nontransactional meal saving, and outdated historical specifications. These require verification or future fixes and have not been silently resolved.

The earlier documentation and foundation checkpoints were committed locally without pushing. The current task authorizes a bounded Gemini reservation fix and local verification/documentation only; it does not authorize another commit. Next.js instructions and unrelated untracked files remain preserved; `.superpowers/sdd` artifacts remain ignored. Push, deployment, live database changes, credential provisioning, and provider activation remain unapproved. See `PROJECT_CONTEXT.md` for decisions and limitations.

## Maintaining this roadmap

After every completed development milestone, update this roadmap and `PROJECT_CONTEXT.md` with features completed, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next development task. Keep planned and proposed work distinct from implemented and verified behavior. Do not mark untested features as newly verified completions or change phase order without owner direction.

Commit review checkpoint: no blocking code issue for saving the disabled implementation; focused verification passed 46 tests across four files without application edits. Full-suite/build results above are from the prior implementation verification, not a new run. Activation remains a separate approved release task, with existing Gemini continuity explicitly gated on migration/configuration and smoke verification.

Gemini reservation fix: conservative per-request text/schema/image estimate plus a shared 16,384-token output/thinking cap replaces the whole-model reservation. Oversized estimated input is rejected; accounting, 20/60 credits, authentication, idempotency, and disabled defaults stay intact. Groq remains disabled with its old reservation. Verified locally: 395 tests across 74 files, none skipped; TypeScript, relevant ESLint, and production build passed. Full lint retains 15 existing errors and 8 warnings in unchanged files. A separate read-only review found no critical/important issues; the estimate is not a proven tokenizer/billing upper bound. Phase order is unchanged; Phase 7 has not begun.

Cloudflare foundation (2026-10-16): server-only Llama 4 Scout adapter prepared with mocked HTTP, one-photo application limit, private local configuration instructions, and no production registration. Cloudflare accounting/Neuron limits and live compatibility remain activation prerequisites; credentials alone never enable it. Verification: 428 tests across 75 files passed; TypeScript, targeted lint, and the production build passed. Read-only review found no blocking adapter issue; additional MIME/body-limit coverage was added. Live provider compatibility remains unverified. No Phase 7 work or commit is authorized.

## 2026-10-17 proposed local credit-fairness patch

The next local test candidate atomically refunds HTTP-error requests where no
provider attempt was authorized, preserving durable same-key replay and the
request's original Manila allowance day. An attempted provider failure remains
charged. This is a proposed, uncommitted, untested-in-sandbox draft change,
**not an activated refund policy**. Confirm the original request-control
migration has not been applied before using the changed draft; otherwise use a
new additive migration. Focused PostgreSQL/PGlite and HTTP tests, full Vitest,
TypeScript, build, and independent-connection PostgreSQL testing remain required.
No live provider is activated; Cloudflare/Groq remain disabled; Phase 7 remains
planned and must not start before Phase 6 acceptance.

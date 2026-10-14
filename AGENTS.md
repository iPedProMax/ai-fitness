<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Fitness development instructions

## Start every session

1. Inspect `git status --short`, `git branch --show-current`, and `git log -1` before making changes. Preserve staged, modified, and untracked work.
2. Work only in the current `feature/supabase-auth` worktree at `C:\Users\Ped\GitHub\ai-fitness\.worktrees\supabase-auth`. If the branch or worktree differs, report it before editing.
3. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for architecture, implemented behavior, decisions, and unresolved findings; read [ROADMAP.md](ROADMAP.md) for phase order and the next task.
4. Use [README.md](README.md) for basic setup. `CLAUDE.md` references this file. Documents under `docs/superpowers/` are historical plans/specifications; consult them for rationale, but reconcile them with current code and the root context documents.
5. Follow the current user's scope and approval requirements. Documentation work does not authorize application changes or starting the next roadmap phase.

## Safety and product rules

- Never commit, push to GitHub, deploy to Vercel, modify production Supabase schemas/data, or make paid API calls without explicit approval for that action.
- Never expose secrets, credentials, or environment variables. Do not print environment files or include their contents in documentation, logs, or commits.
- Do not overwrite unrelated changes or remove unrelated untracked files, including `src/app/auth/actions.ts.bak` and `t run`.
- Prefer free-tier services and avoid unexpected expenses. Do not assume an AI request is free because the user-facing allowance is free.
- Keep interfaces mobile-friendly, accessible, simple, and understandable. Beginner-friendly functionality takes priority over technical complexity.
- Manual food and exercise logging, formula calculations, and the planned manual calorie planner must remain free and consume no AI credits.
- Preserve optional exercise-calorie displays and smartwatch calorie entry even when those displays are hidden. Exercise calories do not change food calorie targets.
- Preserve server authentication checks and Supabase RLS. Derive ownership from verified authentication, never a client-provided user ID. Keep AI credentials and provider calls on the server.
- Preserve separate daily analysis/refinement allowances and Philippine midnight resets. Future provider fallback must not charge additional user credits for the same logical request.
- AI Fitness Coach belongs to Phase 7 and will use a separate allowance. One free session daily with up to eight AI replies is a proposal awaiting future approval, not an implemented or approved limit.
- Record discovered issues and verify them before fixes; do not silently change behavior while updating documentation.

## Verification commands

Install dependencies from the lockfile with `npm ci` when setup is authorized. On Windows PowerShell use the `.cmd` commands below; on other shells omit `.cmd`.

```powershell
npx.cmd --no-install vitest run
npm.cmd run lint
npm.cmd run build
```

There is currently no `npm test` script. Vitest configuration is in `vitest.config.mts`; tests are colocated with source files. For a focused test, pass its path to `npx.cmd --no-install vitest run`.

Write meaningful tests for application changes. When implementing features, run the complete test suite and production build, plus relevant lint and focused checks. Use mocked providers for automated tests; do not make paid calls without approval. Read the installed Next.js guides above before framework-specific code changes. Report exact results and anything not tested; never infer a passing build or test suite from code inspection.

For documentation-only changes, review content, links, consistency, `git diff --check`, and Git status. Do not claim application verification from documentation checks.

## Session continuity

After each completed development milestone, update `PROJECT_CONTEXT.md` and `ROADMAP.md` with features completed, relevant technical decisions, test/build commands and results, latest verified local commit, remaining problems, and the next development task. Distinguish implemented, tested, deployed, planned, and proposed states. Never present untested features as newly verified completions. Keep context in the repository rather than relying on earlier chat history.

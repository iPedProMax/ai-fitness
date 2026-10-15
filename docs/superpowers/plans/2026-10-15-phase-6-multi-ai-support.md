# Phase 6 - Auto Best Multi-AI Provider Support Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task only after owner approval. Steps use checkbox (`- [ ]`) syntax for tracking. Do not delegate without separate authorization.

**Status:** Original full Phase 6 proposal; only the Gemini provider foundation is authorized by Task #4. That narrowed subset is implemented and reviewed in Task #5: provider-neutral contracts, a server-only Gemini selector/adapter, route wiring, and focused tests. Prompts, response schemas, clarification logic, reservations, and model are preserved. Task #5 authorizes one local checkpoint commit, `refactor: introduce Gemini AI provider abstraction`, including this plan as project documentation. Schema extraction, provider capability routing, fallback, retries/timeouts, distributed budgets, privileged credentials, and idempotency below remain unimplemented and require future approval. See `PROJECT_CONTEXT.md` and `ROADMAP.md` for current verification results.

**Goal:** Keep Gemini primary while adding capability-aware provider fallback that preserves nutrition behavior and charges at most one user credit per accepted logical request.

**Architecture:** Use small server-only provider adapters behind one router. Keep prompts, canonical schemas, deterministic clarifications, and arithmetic in application code. Use persistent Supabase admission/attempt records for idempotency and atomic budgets across server instances; every provider attempt consumes an internal allowance, while the user is charged once outside the attempt loop.

**Tech Stack:** Existing Next.js 16.3.7, TypeScript, Zod, Supabase SSR/Postgres, Vitest, and `@google/genai`; native server `fetch` for Groq and an optional OpenAI adapter, avoiding an additional orchestration dependency initially.

**Spec:** The owner's Task #3 requirements, restated in the constraints and design below. This combined proposal needs owner review; it is not an approved implementation specification.

## Checkpoint and scope

Branch/worktree: `feature/supabase-auth`, `C:\Users\Ped\GitHub\ai-fitness\.worktrees\supabase-auth`.

Local documentation commit: `ad986ef338415a3ca8df8d1f46f30c3c89be570f`, `docs: establish AI Fitness project context and roadmap`. It contains only `AGENTS.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `README.md`. Their earlier checkpoint refers to the inspected application commit `9b07977`; use `git log -1` to obtain current HEAD rather than treating that historical snapshot as live Git state.

Phase 6 is Multi-AI Support. Phase 7 remains AI Fitness Coach. The daily meal calorie planner remains a pending Phase 5 enhancement. Coach allowance, meal-planner implementation, and unrelated technical fixes are outside this plan.

## Global constraints

- Keep Gemini as the initial primary provider.
- Support multiple providers through a shared interface and fall back automatically on eligible failures or rate limiting.
- Select only models capable of the requested task, including vision and the complete image count/payload for photos.
- Preserve existing JSON nutrition response structure, prompts, clarification logic, and deterministic calculations.
- Deduct at most one initial analysis credit per accepted analysis regardless of provider fallback. Apply the same one-charge rule to each logical AI refinement using its separate allowance.
- Preserve 20 daily analyses, 60 daily AI refinements, and Philippine midnight resets; manual tracking and deterministic scale refinements remain free.
- Keep provider API keys and any privileged Supabase credential on the server; never expose values or place secrets in public configuration.
- Enforce server-wide quotas, spending safeguards, real request cancellation, timeouts, and bounded attempts across all server instances.
- Paid API calls remain disabled unless explicitly approved. No live provider testing is implied by implementation approval.
- Keep current authentication, ownership checks, and existing data RLS intact. Production migration application requires separate approval.
- Do not commit further work, push, or deploy without explicit approval. Preserve `src/app/auth/actions.ts.bak` and `t run`.
- Before framework code changes, read relevant installed Next.js guides under `node_modules/next/dist/docs/`, including route handlers and server/client boundaries.

## Inspection baseline before the Task #4 extraction

`src/app/api/food/analyze/route.ts`, `text/route.ts`, and `refine/route.ts` authenticate first, validate input, reserve analysis/refinement usage, and call `GoogleGenAI.interactions.create()` with `gemini-3.5-flash-lite`. Each requests schema-shaped JSON and validates the decoded result with Zod. No app-level shared router, explicit timeout/attempt policy, distributed provider budget, or request idempotency was found.

Photo analysis applies scale, prepared-drink, material-uncertainty, brand, and variety clarification rules after validation. Text analysis sets `TEXT_AI`, forces estimate sources, caps confidence, recomputes calories, and adds brand/variety clarifications. Refinement requests an additive plan, performs final arithmetic on the server, and retains a legacy full-analysis response fallback. Scale-tare answers return without AI or credits.

Photo uploads currently allow up to 10 JPG/PNG/WEBP images, each up to 10 MB. Model compatibility must also check total encoded payload size, image dimensions, estimated input tokens, and output budget. Never drop images, merge independent meals, or split analysis into independently charged requests to fit a fallback. Hosting body-size limits still require verification.

The installed Google SDK contains retry machinery and cancellation options. Its type comments warn that client-side cancellation does not cancel work at the service and may still incur charges. Disable or tightly account for SDK retries; a `Promise.race` timeout alone cannot control upstream spending.

## Provider research and initial recommendation

Official documentation was read on 2026-10-15. Documentation establishes advertised capability, not access in this project's accounts, live schema compatibility, nutrition quality, or free-tier eligibility. No model API or account configuration was queried.

| Provider/model | Verified documentation | Proposed role |
| --- | --- | --- |
| Gemini `gemini-3.5-flash-lite` | Stable model supports image/text inputs and structured outputs; Interactions API lists it. Pricing lists free-tier input/output and separate paid rates. | Keep current primary and API transport initially. Verify the actual project's billing tier before enabling calls. |
| Groq `openai/gpt-oss-20b` | Production catalog entry; strict structured outputs and Free Plan limits are documented. | Initial text-analysis and AI-refinement fallback, subject to approved free account access and fixture evaluation. Mark as text-only in the application registry. |
| Groq `qwen/qwen3.8-27b` | Model page marks Preview, supports vision/JSON schema, and limits input to 3 images; Free Plan limits are documented. | Optional development/beta vision fallback only after explicit preview acceptance, for compatible requests. Not a dependable substitute for the app's complete 10-image range. |
| OpenAI `gpt-6-luna` | Official model page lists image input, structured outputs, Responses support, and paid token pricing. | Optional production vision/text fallback after spending approval and account verification; disabled by default. Do not assume free API access. |

Sources: [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [Interactions support](https://ai.google.dev/gemini-api/docs/interactions-overview), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Groq models](https://console.groq.com/docs/models), [Groq vision](https://console.groq.com/docs/vision), [Groq Qwen model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq rate limits](https://console.groq.com/docs/rate-limits), [OpenAI Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Recommendation: implement Gemini plus Groq text fallback first, with optional adapters gated by policy. Full photo fallback for 4-10 images cannot be promised from the researched Groq option. Approve a suitable production vision provider and its budget, or accept a clear temporary-unavailability response where no eligible free fallback exists. Fail closed rather than silently enabling paid calls.

“Auto Best” initially means the first approved, task-capable, healthy provider in a deterministic order: Gemini, then the approved fallback. It does not mean a model votes on providers or that multiple models analyze every request. Nutrition quality needs offline fixtures and, only with separate call approval, a small evaluation before changing priority.

Alternatives considered: a general AI SDK could reduce adapter boilerplate but adds migration/dependency risk around the current Interactions transport; a hosted gateway centralizes routing but adds another account, billing, and privacy dependency. Thin direct adapters best fit two initial providers and the existing app.

## Request flow and contracts

1. Verify authentication before reading the body; validate existing route inputs and reject invalid requests without charge.
2. For deterministic scale refinement, run the existing logic and return without entering the AI layer.
3. Build a canonical `ProviderRequest`, determine capable/enabled models, and validate idempotency headers. If no eligible provider exists, return 503 before admission.
4. Admit the logical request once using the authenticated Supabase client and the proposed `begin_ai_request` RPC. This replaces, rather than supplements, the route's existing reservation call. It atomically deduplicates and increments the existing daily counter once.
5. Before each outbound attempt, atomically reserve provider/global request, token, concurrency, and worst-case spend allowances through a server-only privileged budget RPC. If budget/state cannot be checked, stop; no call.
6. Call the adapter with a deadline, normalized schema, and output cap. Decode, normalize optional fields, and validate against the canonical Zod schema before accepting success. Every retry/fallback consumes an internal provider-attempt allowance, never another user credit.
7. Apply the same route-specific postprocessing as today and return the existing public JSON. Mark the request complete and store a short-lived replay result accessible only to its owner through the server.

Proposed shared types in `src/lib/ai/types.ts`:

```typescript
type AiTask = "photo-analysis" | "text-analysis" | "refinement";
type SchemaId = "food-analysis" | "additive-refinement";
type ProviderRequest = {
  task: AiTask;
  prompt: string;
  images: Array<{ mimeType: "image/jpeg" | "image/png" | "image/webp"; data: Uint8Array }>;
  schemaId: SchemaId;
  maxOutputTokens: number;
  signal: AbortSignal;
};
type ProviderResult = {
  json: unknown;
  inputTokens?: number;
  outputTokens?: number;
  upstreamRequestId?: string;
};
interface AiProvider {
  generate(request: ProviderRequest): Promise<ProviderResult>;
}
```

Registry entries hold provider/model IDs, supported tasks/modalities, schema mode, image/payload/context limits, pricing version, and enabled/free/paid policy. Browser input cannot choose provider, model, base URL, billing tier, price, or budget. Keep all AI modules server-only and use fixed provider hosts to prevent SSRF/credential forwarding.

Strict schemas vary between APIs. OpenAI requires all fields in strict schemas to be required, with nullable unions for optional values. Build transport-specific schema variants without changing the canonical `FoodAnalysis` or additive schema. Normalize transport nulls back to omitted optional values before canonical validation; do not discard required invalid values or invent missing nutrition numbers. Preserve the existing legacy refinement branch during migration.

### Error, timeout, and retry policy (proposed defaults)

- At most 2 outbound attempts per logical request: primary once, then one eligible fallback. No automatic SDK retries hidden inside either attempt. A later same-provider retry policy must share this ceiling.
- Per-attempt timeout: 20 seconds; overall AI operation budget: 45 seconds including admission, backoff, and postprocessing. These values need deployment-limit/latency validation before enablement.
- Initial output cap: 4,096 tokens, bounded by model availability and estimated JSON size. Test full 10-food fixtures; incomplete output is a failure, never partial success. Raising the cap requires a corresponding budget change.
- Fallback for transport failures, timeouts, 408/429, and 5xx. Allow one fallback for empty/truncated/schema-invalid output within the same ceiling. Do not retry client-input errors, auth/quota failures, or safety refusals to circumvent policy.
- Honor provider `Retry-After` as a cooldown; never wait beyond the remaining request deadline. Avoid immediately reusing a rate-limited provider. Use a shared circuit breaker after repeated transient failures; disable a misconfigured adapter on 401/403 without logging upstream bodies/secrets.
- An upstream 401/403 may move to an already approved, independently configured fallback within the same attempt ceiling; never retry the invalid credential. This differs from a caller authentication failure, which stops before admission.
- Retain worst-case cost reservations after ambiguous timeouts; upstream work may still be billed. Track each attempt separately and reconcile known token usage conservatively.
- Distinguish user quota exhaustion (429) from system/provider capacity exhaustion (503 with safe retry guidance). Keep success JSON unchanged and sanitize all errors.

### Idempotency and credit semantics

Use an `Idempotency-Key` per logical analysis/refinement submission. Bind it in the database to verified `auth.uid()`, task, and a hash of canonical input including ordered image bytes. Same key/same input replays a completed result without new calls or credits; same key/different input returns 409. An in-flight duplicate returns 409 with safe retry guidance rather than starting another operation. A terminal failure is replayed for that key; a deliberate new submission uses a new key.

`begin_ai_request` must combine the uniqueness check and existing 20/60 cap increment in one transaction; uniqueness applies across midnight too. A replay must not spend the following day's allowance. Its tables have RLS enabled and no direct client access. Its authenticated RPC derives ownership from `auth.uid()`; users cannot submit arbitrary owners or budget policies.

Proposal preserves current charge-on-admission behavior: an admitted request may retain its single credit if every model fails or a global capacity race later blocks its attempt. Known global unavailability is checked before admission where possible. Refunds are a separate decision, not silently introduced in Phase 6. This plan does not claim one credit buys only one upstream bill: fallback can incur multiple provider charges.

### Distributed quotas and spending

Add a durable request/attempt ledger and budget windows in the existing Supabase project; do not rely on process memory for server-wide enforcement. Proposed migration: `supabase/migrations/20261015_create_ai_request_and_provider_budgets.sql` (prepare later, apply to production only with approval).

Use separate atomic limits for global and provider/model RPM, input/output token budgets, RPD, daily/monthly spend, and concurrency. Attempt leases expire for concurrency cleanup; cost reservations remain conservative until reconciled. Count failed attempts toward request limits. Provider reset windows follow provider rules, while user allowance continues to use Manila midnight. Google documents project-level limits and Pacific-midnight RPD resets; Groq documents organization-level limits. Configure scope identifiers so multiple models/keys sharing a quota cannot bypass it.

Budget and attempt mutations are service-role-only; store the privileged credential only in a dedicated server module. Verify the stored admitted request before reserving an attempt. Clients cannot increase caps, change prices, mark themselves paid-approved, or clear cooldowns. Policies must be server-owned/persisted, shared across all deployments using the same keys. Existing browser clients remain publishable-key clients, and existing RLS is not loosened.

Worst-case spend calculations must include image input, prompt overhead, output, and billable reasoning tokens using verified model-specific rules. Unsupported cost estimation blocks paid routing. Successful usage reconciliation can release unused estimates; timeouts or missing usage retain the conservative reservation. Provider-side billed work can outlive client cancellation, so use provider account limits as well as application budgets.

Default paid allowance is false and USD budgets are zero. A key alone never enables paid routing. Free mode requires verified account/tier eligibility; the app cannot force a billed provider account to behave like a free account. Leave an unverified provider disabled. Approved paid mode needs explicit provider/model allowlists, hard application budgets, provider dashboard limits where available, and a kill switch. Missing limits/prices or accounting errors fail closed. Alerts alone are not spending enforcement.

Do not log images, nutrition-label photos, prompts, auth tokens, full provider responses, or secrets. Record only request IDs, provider/model IDs, sanitized error classes, latency, token counts, and estimated cost. Short-lived idempotency replay results contain nutrition data: restrict access, expire them after a proposed 24 hours, and delete results after expiry while retaining minimal admission records long enough to prevent duplicate charging.

Proposed deduplication retention: keep minimal key/task/input-hash admission tombstones until account deletion, with account deletion cascading to them. After the 24-hour replay result expires, return 410 for that old key rather than executing or charging again. A deliberate new submission requires a fresh key. Do not retain photo bytes in this ledger.

## Configuration and endpoint changes

Names below are proposed configuration identifiers, not current values. No environment files were read or changed.

| Configuration | Plan |
| --- | --- |
| `GEMINI_API_KEY` | Keep existing server-only secret. |
| `GROQ_API_KEY` | Add only when enabling the approved Groq adapter. |
| `OPENAI_API_KEY` | Optional, disabled adapter until paid use is approved. |
| `SUPABASE_SECRET_KEY` | Proposed server-only privileged credential for budget/attempt RPCs; verify the project's supported key format and least-privilege approach before provisioning. Never use this in existing browser clients. |
| `AI_ENABLED_PROVIDERS`, `AI_PRIMARY_PROVIDER` | Validated allowlist; Gemini is primary. Missing credentials disable the relevant adapter. |
| `AI_GEMINI_MODEL`, `AI_GROQ_TEXT_MODEL`, `AI_GROQ_VISION_MODEL`, `AI_OPENAI_MODEL` | Explicit approved model IDs; optional vision/paid choices disabled initially. Avoid floating “latest” aliases. |
| `AI_ALLOW_PAID`, `AI_DAILY_BUDGET_USD`, `AI_MONTHLY_BUDGET_USD` | Default false/zero; initialize server-owned policy, never accept browser overrides. Changes to paid policy require owner approval. |
| `AI_ATTEMPT_TIMEOUT_MS`, `AI_TOTAL_TIMEOUT_MS`, `AI_MAX_ATTEMPTS`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_CONCURRENT_REQUESTS` | Validated bounded settings; proposed 20,000/45,000/2/4,096, with concurrency and provider quota values taken from verified account limits. Missing quota policy blocks routing. |

Existing public Supabase auth configuration remains unchanged. No secret variable uses the `NEXT_PUBLIC_` prefix.

Modify the internals of `POST /api/food/analyze`, `POST /api/food/text`, and `POST /api/food/refine`; preserve URLs and success response formats. `GET /api/ai/usage` remains read-only and compatible with the existing counter. Do not create a public provider-selection, budget-reset, or key-testing endpoint.

Gemini initially keeps its SDK Interactions transport. Groq uses `https://api.groq.com/openai/v1/chat/completions`; optional OpenAI uses `https://api.openai.com/v1/responses`. Adapters translate image bytes to the provider's supported inline format and request schema-constrained JSON. Confirm request-specific SDK cancellation and exact REST fields against official docs during implementation.

## Review focus

1. Concurrent duplicates, midnight replays, and changed-input key reuse must never cause duplicate user charging or another provider call.
2. Four-to-ten-image or oversized photo requests must skip the three-image Groq option without losing any evidence.
3. Timeouts and hidden SDK retries must not exceed outbound attempt/spend limits or falsely release ambiguous cost reservations.
4. Nullable strict-schema fields and additive refinement must preserve current clarification/scale behavior, not generate invented zeroes or double-count food.
5. Browser attempts to set model/price/paid policy, global-budget races, and lost budget storage must never bypass limits or leak secrets.

## Implementation tasks (after approval)

### Task 1: Canonical contracts and Gemini extraction

**Files:** Create `src/lib/ai/types.ts`, `config.ts`, `registry.ts`, `schemas.ts`, `providers/gemini.ts`, and their focused tests. Extract additive schema into `src/lib/ai/refinement-schema.ts`; retain `src/lib/food-analysis.ts` as the canonical food contract. Do not switch route behavior in this task.

**Interfaces:** `AiProvider.generate(ProviderRequest): Promise<ProviderResult>`; `getAiConfig(): AiConfig`; `eligibleModels(request, config): ModelPolicy[]`; `decodeProviderResult(schemaId, raw): FoodAnalysis | AdditiveRefinement`. Export `AdditiveRefinement` from the extracted schema.

- [ ] Add failing tests for explicit Gemini priority, unsupported vision/image count/payload, disabled or unverified paid providers, strict-schema optional/null conversion, and unchanged canonical fixtures.
- [ ] Run `npx.cmd --no-install vitest run src/lib/ai` and verify the intended failures.
- [ ] Extract schema/transport responsibilities with server-only boundaries; keep Gemini prompts and API transport intact. Pin SDK retries and genuine cancellation after inspecting the installed SDK.
- [ ] Rerun focused tests; prove valid existing Gemini responses decode identically and missing credentials produce safe errors.

### Task 2: Durable admission and budget enforcement

**Files:** Prepare the proposed SQL migration; create `src/lib/ai/request-ledger.ts`, `budget-store.ts`, `admin-client.ts`, and focused tests; modify `src/lib/ai-usage.ts` only as needed to integrate admission while retaining the existing read contract.

**Interfaces:** `beginAiRequest(kind, key, inputHash): Promise<Admission>` through the authenticated client; `reserveProviderAttempt(requestId, modelPolicy, estimates): Promise<AttemptReservation>` through the privileged server client; `finalizeAttempt(attemptId, outcome): Promise<void>`; `completeAiRequest(requestId, result): Promise<void>`. `Admission` distinguishes new, replay, in-flight, conflict, denied, and unavailable states. Server-owned budget policy is read inside atomic RPCs, not passed by browser clients.

- [ ] Add failing tests for same-input replay, 409 conflicts, cross-user keys, 20/60 caps, midnight replay, racing admissions, global/provider budget races, lease expiry, uncertain-timeout spend, and fail-closed storage errors.
- [ ] Run focused mocked tests and verify intended failures; use a separately authorized local/disposable Postgres integration test for transaction/role/concurrency behavior.
- [ ] Implement atomic admission and attempt accounting with RLS, restricted RPC grants, and authenticated ownership. Preserve original migration files; do not apply production SQL.
- [ ] Prove authenticated users cannot write provider budgets or forge other owners, and concurrent instances cannot overspend. A mocked RPC test alone is insufficient proof of database atomicity.

### Task 3: Router and approved fallback adapters

**Files:** Create `src/lib/ai/router.ts`, `errors.ts`, `providers/groq.ts`, optional `providers/openai.ts`, and corresponding tests.

**Interfaces:** `runAiRequest(requestId, request): Promise<ProviderResult>` consumes registry/config, the ledger/budget interfaces, and provider adapters; central decoding validates candidate output before success. Model metadata remains internal.

- [ ] Add failing tests for primary success, 429/5xx/timeout fallback, no compatible fallback, schema-invalid/empty output, refusal without fallback, 401/403 adapter disablement, `Retry-After`, circuit cooldown, two-attempt ceiling, and deadline exhaustion.
- [ ] Add adapter fixtures for strict JSON, images, malformed/truncated output, token usage, and safe error redaction. Assert no provider call when paid mode is off or budget reservation fails.
- [ ] Run focused tests, implement the router and enabled adapters, then rerun. Use fake clocks and mocked network requests; never probe real keys or make paid calls.
- [ ] Test multi-instance accounting boundaries and prove SDK retry configuration cannot multiply router attempts. If bounded client cancellation cannot be guaranteed, disable that transport until a bounded direct transport is available; upstream completion may still be billed.

### Task 4: Route integration and submission idempotency

**Files:** Modify the three food API route files, `src/lib/analyze-food.ts`, `analyze-food-text.ts`, and `refine-food-analysis.ts`. Extract large route-local prompts/clarification helpers only when needed to preserve them testably. Update existing auth/quota and food route tests.

**Interfaces:** Preserve the public APIs and `FoodAnalysis` output; client helpers attach a fresh `Idempotency-Key` per deliberate submission and reuse it for a transport retry of that submission. No provider settings travel to the browser.

- [ ] Add failing integration tests proving Gemini failure then fallback success charges once, both failures charge no more than once, AI refinement touches only its allowance, invalid/auth-denied input calls neither budget nor model, and deterministic scale refinements use zero credits.
- [ ] Run focused route/auth/quota tests and verify failures; integrate admission once outside the router and replace direct Gemini calls.
- [ ] Preserve photo/text normalization, all clarification rules, additive arithmetic, legacy refinement parsing, and safe user-facing errors. Keep GET usage compatible.
- [ ] Rerun existing prompt, prepared-drink, material-uncertainty, brand/variety, additive-refinement, custom-answer, scale, and UI flow tests. Test 10-image filtering and no partial image dispatch.

### Task 5: Verification and controlled enablement

**Files:** Update `AGENTS.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `README.md` with actual implementation/verification outcomes; do not mark Phase 6 complete until its approved scope passes.

- [ ] Run `npx.cmd --no-install vitest run`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`; report exact output and any untested live flows.
- [ ] Verify browser bundles and errors contain no provider/admin secrets using synthetic test values, not real credential dumps. Review RLS and RPC privilege boundaries.
- [ ] Review offline fixture results for food photos, labels, serving quantities, scale evidence, additive refinements, and missing macros. Capability compatibility alone is not nutrition accuracy.
- [ ] Obtain separate approval before provisioning paid services, applying production migrations, making live API calls, committing implementation, pushing, or deploying. Confirm account limits, free-tier eligibility, data handling, and deployment payload/deadline support before enablement.
- [ ] Enable only approved providers/models with tested accounting and safe budgets; keep paid mode off by default. When no suitable fallback exists, show a simple temporary error and retain manual logging.

Existing tests to adapt include `src/lib/ai-usage.test.ts`, `ai-usage-routes.test.ts`, `food-api-auth.test.ts`, `food-api-routes-auth.test.ts`, route tests under `src/app/api/food/`, and frontend helper tests under `src/lib/`. Keep auth/proxy/security regressions in the full suite. No provider changes are needed in manual activity/food tracking, TDEE, goals, reports, or the AI usage counter's success contract.

## Decisions required before execution

Owner review must settle the initial provider/model allowlist; whether Groq preview vision is acceptable for beta; whether full 4-10-image fallback warrants an approved paid vision provider; and the account-derived global quota/concurrency limits. The proposed attempt/time/output defaults and retained-credit-on-terminal-failure policy also need acceptance. Paid mode remains false until specific spending authorization; refunds, coaching, and unrelated fixes remain separate tasks.

Original plan self-review: every Task #3 requirement maps to the constraints, provider capability checks, durable budget/idempotency design, route integration tests, or controlled enablement gates. That proposal did not claim completed implementation or passing checks. Tasks #4-5 subsequently implemented and verified only the foundation subset recorded at the top of this file; the remaining design still requires approval before application changes.

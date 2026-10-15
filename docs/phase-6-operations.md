# Phase 6 local implementation and activation requirements

Reviewed 2026-10-15. This is an operational guide, not permission to deploy,
configure credentials, change a live database, or send model traffic.

## Implemented locally

The three food POST endpoints use a request context. At their existing credit
reservation point, the server verifies the Supabase user again and atomically
admits the request through `control_ai_request`. User identity is never supplied
by the browser. Validation and deterministic/manual clarification branches run
before admission. Existing prompts, canonical nutrition schemas, Zod parsing,
normalization, and additive/legacy refinement arithmetic stay in the routes.

Admission binds `(verified user ID, Idempotency-Key)` to a SHA-256 hash of the
endpoint, method, and payload, plus analysis/refinement kind. JSON property order
is canonicalized; multipart transport boundaries are ignored, while ordered file
bytes, names, MIME types, and fields are bound. The hash stores no original food
text or photos. Reusing a key with a different payload returns 409. Concurrent
duplicates get 409 while running; completed requests replay the final public JSON
and HTTP status, including failures. Provider fallback does not reserve another
user credit. The SQL uses one global row lock and the existing atomic daily-usage
UPSERT; limits remain 20 analyses and 60 refinements at Manila midnight.

Browser helpers attach a random UUID and retry a transport failure at most once
with the same key. They never automatically retry an HTTP error. Callers may pass
`{ idempotencyKey }` to keep a key across separate helper invocations. Older callers
without a key get a server-generated key; they have no cross-submission deduplication
unless they retain the returned `Idempotency-Key` response header. Internally
generated browser keys are not yet exposed to current UI callers after an error;
manual recovery of a lost response is a remaining UX limitation.

Replay bodies are available for 24 hours. After that the key returns 410 and never
executes or charges again. An interrupted request is never taken over by another
worker, because upstream execution may be ambiguous. Its original credit remains
consumed; the same key returns 409. Request tombstones remain until account
deletion. Physical deletion of expired replay bodies requires scheduling
`purge_ai_replay_bodies()` with trusted administration; access to an expired key
also removes its body. The application does not automatically schedule this job.

## Distributed protection

Every real provider is wrapped by a server-only guard. Without a durable request
claim and a successful database attempt reservation it cannot make a model call.
Request, token, daily/monthly budget, in-flight, cooldown, and attempt checks are
shared across app instances. Accounting errors or missing migrations fail closed.
Only trusted server execution can call control RPCs; browser roles have no access
to control tables/RPCs, and even the service role gets RPC execution rather than
direct control-table privileges in this migration. Ordinary Supabase clients,
authentication guards, RLS, and meal ownership rules are unchanged.

There are two independent kill switches: the server environment `AI_ENABLED`
must equal `true`, and the database runtime policy must be enabled. Both default
off. Each outbound attempt rechecks database policy. Switching off does not undo
an upstream request already dispatched. Gemini remains the only production
registration. At most two distinct compatible providers may be attempted, with
20 seconds per attempt and 45 seconds overall generation time; accounting calls
also have five-second network timeouts. SDK retries remain disabled. Only known
transient failures or an exhausted provider's local capacity allow fallback.
Authentication/input/Zod/unknown errors, cancellation, user quota exhaustion,
and uncertain accounting do not. No image evidence is discarded for fallback.

Provider request/token caps use fixed minute/day windows. Gemini's day follows
Pacific midnight, including daylight saving; user credits follow Manila midnight;
global spending windows use UTC. Shared transient failures impose a 30-second
cooldown and return `Retry-After` when capacity remains unavailable. A configured
in-flight cap bounds concurrent attempts. Unknown, cancelled, or timed-out calls
retain a two-minute concurrency lease; request/token/budget reservations are never
refunded. Lease expiry bounds local capacity retention, not upstream cancellation.
Groq remains disabled: its UTC application day cap must be reconciled with its
account-specific reset/rolling-window semantics before activation. Provider 429s
remain possible at fixed-window boundaries or when another app uses the account.

Token reservations deliberately use each fixed model's full input/context plus
maximum output ceiling: Gemini 1,114,112; Groq 196,608. This covers images and
reasoning without claiming an unverified token estimate. It is conservative and
can reject every request on a smaller free-tier token limit. **Do not increase a
configured quota above the actual account allowance to work around this.** A
verified exact-count/output-bound strategy needs review before practical use on
those accounts. Model changes must update/reverify these server bounds together.

All paid execution is rejected, even if the database `paid_enabled` toggle is set.
Only explicitly verified free-tier policies with zero per-attempt cost are
accepted. Global monetary budgets default to zero; paid pricing/accounting and
paid activation are intentionally unavailable. A database flag cannot prove an
external account is actually free. The owner must verify free-only account setup,
disable automatic billing upgrades where available, and isolate quota/billing
from other applications. No code can account for calls made outside this ledger.
Provider-console protections are required in addition to application controls.

## Disabled backup and verified sources

`createGroqProvider()` implements the real HTTPS chat-completions protocol using
native fetch, with no hidden retries, bounded timeouts, no redirects, and sanitized
HTTP failures. It defaults disabled and is not registered by `getAiProvider()`.
The chosen fixed model `openai/gpt-oss-20b` is text-only, with JSON-schema support;
photo requests must never reach it. Best-effort JSON-schema mode preserves the
existing optional properties without rewriting the schema or prompt. Zod remains
mandatory; malformed or truncated output is not silently retried. Its live output
quality and account availability have not been tested.

Official sources checked on 2026-10-15:

- [Groq model catalog](https://console.groq.com/docs/models) and
  [GPT-OSS 20B capabilities](https://console.groq.com/docs/model/openai/gpt-oss-20b):
  production text model; 131,072 context and 65,536 maximum completion tokens.
- [Groq structured output modes](https://console.groq.com/docs/structured-outputs):
  strict mode requires every field required and forbids additional properties;
  best-effort mode supports existing optional schema fields.
- [Groq rate limits](https://console.groq.com/docs/rate-limits): free-plan listing
  currently shows 30 RPM, 1,000 RPD, 8,000 TPM, and 200,000 TPD for this model.
  Organization-specific limits must be verified in the account. The current
  conservative reservation exceeds that published TPM, so this adapter is not
  ready for free-tier activation under the existing counting strategy.
- [Groq API reference](https://console.groq.com/docs/api-reference): HTTPS endpoint
  and request/response protocol.
- [Gemini model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite),
  [pricing](https://ai.google.dev/gemini-api/docs/pricing), and
  [rate-limit reset](https://ai.google.dev/gemini-api/docs/rate-limits): existing
  text/image structured-output model, advertised free tier, and Pacific RPD reset.
  Published availability is not verification of this project's billing tier.

## Failed-request credit policy: unchanged, decision pending

Current behavior charges once on durable admission, before the provider call.
Later model failures, cancellation, timeouts, postprocessing failures, global
capacity rejection, or interrupted finalization retain that credit. Replays never
charge again. This preserves the existing charge-before-call policy, including its
unfairness when the system rejects a request after admission but before dispatch.
Validation, missing provider configuration, disabled admission, authentication
failure, or failed admission before transaction commit consume no new credit.

Options for a separately approved change:

1. Keep admission charging: simplest and resistant to abuse, but users pay for
   service failures.
2. **Recommended:** refund failures proven to occur before any outbound attempt,
   and consider verified provider-service failures under an abuse-limited policy.
   Refunds must be atomic, at most once, reference the original Manila usage day,
   and preserve replay/tombstone state. Never infer a refund from a timeout alone.
3. Charge only validated success: friendlier, but repeated failed model calls can
   consume unbounded provider resources unless a separate failure/attempt allowance
   is designed. This needs explicit approval and distributed accounting changes.

No refunds or failure-credit policy change were implemented.

## Activation requires owner review and approval

### Release ordering and Gemini continuity

Deploying this code with its defaults intentionally stops existing Gemini AI
analysis: missing `AI_ENABLED=true`, accounting credentials, the new RPC, or
enabled/verified database policies produce a closed gate. Manual tracking remains
available. Preserved prompts/model/schema are compatibility evidence, not proof
that a production release with missing setup will work.

Before an approved release, inventory actual migration history and verify
`auth.users`, Supabase roles, and the existing `ai_daily_usage` table with both
counters and its `get_ai_usage()` RPC. The direct application migration dependency
is `20261011_create_ai_daily_usage.sql`; do not rerun this one-shot creation script
if already applied. Apply only the new `20261015_ai_request_control.sql` after
verification and approval, preserving existing usage counters. On a fresh database,
establish the earlier dependency first. The repository also has two historical
`20261013` migration prefixes and lacks a checked-in `meals.consumed_at` migration;
reconcile migration history before using a blanket CLI migration push. Neither
unrelated issue was changed in this review.

Use disposable PostgreSQL with independently connected competing workers to test
same-key admission/replay/conflict, at-most-once credits and outbound attempts,
20/60 limits, Manila/Pacific reset boundaries, shared caps/concurrency/cooldowns,
kill switches, interrupted claims, and actual role/RPC permissions. PGlite alone
does not satisfy this release gate. Check the new RPC is visible to the API after
the approved migration, while browser roles remain denied.

Keep `GEMINI_API_KEY`; provision `SUPABASE_SERVICE_ROLE_KEY` only on the server
for the same project as the existing Supabase URL/authentication configuration.
Verify Gemini free-only account eligibility and model access. Set positive
`requests_per_minute`, `requests_per_day`, `tokens_per_minute`, `tokens_per_day`,
and `max_concurrent` within actual shared account limits. Leave monetary budgets
zero, `paid_enabled=false`, `cost_per_attempt_micros=0`, and Groq disabled. Set
`free_tier_verified=true` only after account verification. A Gemini call currently
needs room for 1,114,112 reserved tokens in both token windows: if actual limits
cannot accommodate that, activation is blocked until reviewed counting changes;
do not increase policy limits beyond the real allowance.

Confirm Gemini-only photo (including existing image formats/multiple images),
text, AI refinement, deterministic free clarification, result validation, and
same-key replay in staging with approved free-only smoke calls. Verify the 20/60
allowances and unchanged failure-credit policy. Coordinate the approved production
cutover: prepare database/configuration first, drain old AI workers so legacy
traffic does not bypass the new ledger, deploy the verified release, and activate
only Gemini's provider policy, runtime `enabled=true`, and `AI_ENABLED=true`.
If a safe cutover cannot avoid downtime, use an explicit maintenance window.
Repeat approved Gemini smoke checks after cutover; rollback the application if
compatibility fails, retaining additive database tables and usage records. Test
the database kill switch as the immediate way to stop new outbound attempts.
Schedule purge and monitoring as described below. No part of this checklist
authorizes those production actions now.

1. Review the local migration `supabase/migrations/20261015_ai_request_control.sql`.
   It depends on `20261011_create_ai_daily_usage.sql`; apply neither to a live
   project without approval. Migration defaults keep runtime/providers disabled.
2. Exercise the migration on disposable, multi-connection PostgreSQL/Supabase:
   competing independent connections, duplicate claims, quota boundaries, reset
   clocks, permissions, concurrency leases, kill switch, and RPC behavior. PGlite
   executes real PostgreSQL locally but queues callers through one connection; its
   passing tests do not prove separate-connection locking or a live deployment.
3. Approve and provision the server-only `SUPABASE_SERVICE_ROLE_KEY` separately.
   No credential was added by this task. Prefer a dedicated narrowly privileged
   execution identity in a future infrastructure review; this release uses only
   service-role-only control RPCs and does not expose the key to browser code.
4. Verify actual account/model availability, free-only billing, account limits,
   data retention/privacy terms, quality, and workable conservative token limits.
   Resolve counting limitations before enabling any affected free-tier account.
5. Set database request/token/in-flight limits and free-tier verification explicitly;
   enable Gemini/runtime policy and `AI_ENABLED=true` only after approved testing.
   Setting environment variables alone cannot bypass disabled database policy.
6. Groq needs a separate approved registration/configuration change, an approved
   server key (not currently read by the application), and disabled-by-default DB
   policy review. No real vision backup is included. Paid providers require a
   separate pricing/accounting implementation and billing approval.
7. Schedule replay-body purge; monitor database/storage usage, denied requests,
   global caps, interrupted requests, and provider-console billing/limits. SQL
   row-lock serialization favors safety over high throughput at current scale.

No live database, provider, deployment, or paid API was used for verification.

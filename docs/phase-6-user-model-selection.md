# Phase 6 — User-selected AI (first patch)

Change of direction: users explicitly select an AI model (Duck.ai-style). No
silent hierarchical fallback is permitted. Daily user allowance remains shared
across models, not multiplied by switching providers.

This first patch adds seven visible model choices, a private, authenticated
GET /api/ai/models catalog, a choice for photo and manual/text entry, persistence
of the last choice in browser localStorage, and server-side selection validation
before credit reservation. Refinements use the currently selected model. Models
which are not configured, activated, or compatible with the number of images
appear disabled. Provider HTTP 429 and safe capacity rejection are displayed as
"Temporarily limited" for this browser session. The actual atomic quota check
still occurs at request execution time; the model list is NOT a live balance API.

In the initial patch, Gemini was the ONLY registered generation provider. Phase 6.1 below adds two explicitly gated Gemini variants. Cloudflare/Groq
adapters exist but remain intentionally disabled. OpenRouter, Mistral, Hugging
Face, and Cerebras remain placeholders: credentials, adapters, verified free
commercial terms, capabilities, quota policies, and provider-specific tests must
be completed before any of them can be activated. Provider credentials must never
reach the browser, and AI_ENABLED remains false in staging until deliberate
free-only activation. No migration, provider API calls, or deployment needed for
this patch.

Before activation: implement a secure read-only, server-computed model quota
availability mechanism (with verified reset times) so users can see "Limit
reached" BEFORE submitting. A 429 currently disables the chosen provider for
this session, not globally. Models' maxImages are implementation limits, not
claims about a provider's entire public catalog.

Apply only after verifying the patch's exact source hashes; rerun focused and
full Vitest, tsc, and build locally. Never push or deploy without approval.

## Phase 6.1 — Individual Gemini models (2026-10-23)

The model picker now shows Gemini 3.5 Flash-Lite (legacy ID `gemini`),
Gemini 3.8 Flash, and Gemini 3.6 Flash, plus the other six planned providers.
The two new Gemini models are **disabled by default**. They share the existing
20 daily meal-analysis / 60 daily refinement credits but require independent
`ai_provider_policy` rows. Tokens, request-rate admission, cooldown, leases,
and attempted-provider records use the **exact selected model ID**. No automatic
fallback is performed.

Run all local tests, TypeScript and build after applying the patch. Before
any new model can become selectable, an administrator must review and apply
`supabase/migrations/20261023_distinct_free_gemini_models.sql` to the **staging
project only**. This migration does not change the existing `gemini` row and
inserts new rows with `enabled=false`, `free_tier_verified=false`, zero limits.
Verify the model is available to the project's actual **Free** tier in Google AI
Studio, and record its specific RPM, RPD, TPM, plus an appropriate conservative
local token/day limit and max concurrent attempts. Only then explicitly set
`enabled=true`, `free_tier_verified=true`, `cost_per_attempt_micros=0` and the
verified conservative limits for ONE model in staging. Do not guess capacities,
copy defaults from another model, or enable a paid API/project. The code NEVER
calls Google to check available quota from the model-picker endpoint. It shows
**our own application's** preflight daily/minute request headroom and cooldown;
Google may still enforce additional live project/model limits, which are checked
only when Google processes a real request. The atomic SQL request attempt is the
final authority and can reject a model just before dispatch. Alternate models
also require the read-only `list_free_gemini_models()` RPC to confirm policy
before reserving the user's credit.

`AI_ENABLED=true` still controls the global switch; the local model-name
allowlist blocks arbitrary models. The `SUPABASE_SERVICE_ROLE_KEY` remains
server-side only. SQL RPC execute access is granted solely to service_role.
Always apply and test the migration before enabling an alternate model. No
production activation, billing change or Git push is part of the patch.

Source of mutable provider availability and rate-limit information:
https://ai.google.dev/gemini-api/docs/pricing
https://ai.google.dev/gemini-api/docs/rate-limits

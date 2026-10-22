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

Currently Gemini is the ONLY registered generation provider. Cloudflare/Groq
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

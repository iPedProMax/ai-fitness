# Cloudflare Workers AI: disabled adapter and private local setup

Reviewed 2026-10-16. The adapter is prepared and tested with mocked HTTP only.
This guide does not authorize model calls, activation, paid plans, or deployment.

## What you can add locally

Open `.env.local` in the repository root yourself. Preserve existing settings and
add these two private variables, replacing the placeholders only in your editor:

```dotenv
CLOUDFLARE_ACCOUNT_ID=replace_locally_with_your_account_id
CLOUDFLARE_WORKERS_AI_API_TOKEN=replace_locally_with_your_token
```

The account ID is available in the Cloudflare dashboard. The token is the Workers
AI API token you created. Do not paste either value into chat, screenshots, source
files, or documentation. Never use a `NEXT_PUBLIC_` name for these settings.
The repository ignores `.env*`; verify `.env.local` remains ignored before any
future commit. This task did not read, create, or edit your environment file.

Use the account-scoped Workers AI token template rather than a Global API Key.
Cloudflare's [REST setup guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
documents the template and notes that manually created tokens need Workers AI
Read and Edit permissions. Restrict the token to the intended account.
No token verification request was made by the app or tests.

**Saving these variables does not enable Cloudflare or make a request.**
`getCloudflareProvider()` returns a disabled provider even with valid settings.
There is no supported environment variable to activate this adapter. The live
factory still registers Gemini only and never reads Cloudflare configuration.

## Prepared adapter behavior

`src/lib/ai/providers/cloudflare.ts` uses the fixed native REST endpoint for
`@cf/meta/llama-4-scout-17b-16e-instruct`. Account IDs must be 32 hexadecimal
characters, preventing arbitrary hosts/path injection. Only inline base64 images
are sent; no remote image URL is fetched. Ordered prompt/image parts and the
canonical response schema are preserved. Requests use bare
`response_format.json_schema`, as Cloudflare's native API documents, rather than
Groq's different schema wrapper.

The initial application limit is **one photo per request**, with JPEG, PNG, and
WebP supported. This is a conservative app policy, not a verified maximum for
the model. The existing router excludes it from requests with more photos; the
adapter also rejects such requests directly, never dropping image evidence.
Gemini's existing ten-image support is unchanged.

The adapter caps output at 8,192 tokens, serialized prompt/schema text at 64 KiB,
and the request body at 20 MiB. Requests have a 20-second deadline including body
reading, cancellation propagation, and timer/listener cleanup. There are no
hidden retries, redirects, tools, or provider/model selectors from the browser.

Native string and object JSON responses are supported. Empty, non-object,
malformed, or unsuccessful envelopes are rejected. Upstream error bodies and
credentials never become error messages. Existing route Zod validation and
normalization must still run; valid JSON alone does not prove valid nutrition.
HTTP 429/temporary failures remain eligible for the existing compatible fallback
policy, while authentication/invalid requests and unknown failures stop.

The explicit `true` factory argument is used only by mocked tests and is not
connected to environment flags or application routes. Adapters do not reserve
user credits. Existing request admission/authentication/idempotency and separate
20-analysis/60-refinement allowances remain unchanged.

## Not ready for activation

The adapter is not registered in `getAiProvider()`. Shared accounting has no
Cloudflare token/Neuron policy and the SQL provider allowlist excludes Cloudflare.
Wrapping it in the current guard fails closed before an outbound attempt, even
with a durable request claim. An integration regression verifies this behavior.
Do not bypass the guard to make the prepared transport run.

Before separate owner-approved activation work:

1. Implement distributed Cloudflare Neuron accounting and account-wide limits,
   with any needed local migration reviewed before production application.
   Cloudflare's free allowance is shared across models/account usage, not per
   AI Fitness user. Calls made elsewhere cannot be accounted for by this app.
2. Verify the actual Free plan, model access, token scope, privacy/license terms,
   and account limits. Stay on Free; do not add paid billing or AI Gateway credits.
   The [pricing guide](https://developers.cloudflare.com/workers-ai/platform/pricing/)
   currently lists 10,000 free Neurons/day, resetting at 00:00 UTC. Free-plan
   operations stop at the allowance; paid-plan overages can be billed.
3. Perform separately approved free-only staging checks for photo understanding,
   full nutrition/additive schema compatibility, JSON output, image/payload limits,
   output completion, and account-specific error behavior. No real model output
   quality or joint vision-plus-schema behavior is claimed from mocked tests.
4. Add approved server registration only after accounting and compatibility pass.
   Preserve Gemini primary routing, image capability filtering, one user credit
   per logical request, kill switches, and all disabled defaults until release.

The [model page](https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/)
advertises vision. Its [official catalog schema](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/workers-ai-models/llama-4-scout-17b-16e-instruct.json)
explicitly includes ordered image/text content and JSON-schema request parameters.
The generic [JSON Mode guide](https://developers.cloudflare.com/workers-ai/features/json-mode/)
has a shorter supported-model list that omits Scout; the model-specific schema
supports preparing the adapter, but live compatibility still needs confirmation.

The previous Gemini reservation fix remains separate, tested, and uncommitted.
No credentials, account settings, database schema, provider activation, or release
was changed by this adapter task.

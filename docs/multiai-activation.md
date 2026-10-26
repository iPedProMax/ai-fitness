# Multi-AI provider activation (staging first)

The app now supports **explicitly selected providers**: Google Gemini (default), Cloudflare Workers AI (one photo or text), and GroqCloud (Qwen 3.8 vision, up to three photos). There is **no automatic provider fallback** and no user-facing Gemini version changer.

## Safe activation checklist

1. Confirm the Supabase migrations up to `20261023_distinct_free_gemini_models.sql` are already applied. In Supabase SQL Editor, review and run `20261025_multiai_provider_foundation.sql`. It adds a Cloudflare quota bucket and updates the existing, service-role-only accounting functions; it does **not** enable Cloudflare or Groq.
2. Keep Cloudflare on **Workers Free**, not Workers Paid. The 10,000 free Neurons/day allowance is NOT measured in token units, so the app's token cap is only an auxiliary guardrail. The Workers Free plan's provider-side stop is essential; inspect actual Neuron use in the Cloudflare dashboard before activating wider access.
3. Verify the selected Groq account's current *free* `qwen/qwen3.8-27b` rate limits in the Groq console. The example below is **conservative**, not a claim of guaranteed available capacity.
4. Add server-only environment values in `.env.local` (never commit or upload it), and repeat in hosting environment only after staging validation:

   ```env
   AI_ENABLE_CLOUDFLARE_FREE=true
   CLOUDFLARE_ACCOUNT_ID=your_32_character_hex_account_id
   CLOUDFLARE_WORKERS_AI_API_TOKEN=your_workers_ai_token
   AI_ENABLE_GROQ_FREE=true
   GROQ_API_KEY=your_groq_key
   ```

5. In Supabase SQL Editor, start with conservative **operator-approved** caps after verifying free entitlements. These statements are NOT executed by the PowerShell installer:

   ```sql
   -- Example staging-only settings. Do not copy blindly into production.
   update public.ai_provider_policy
   set enabled=true, free_tier_verified=true, requests_per_minute=1,
       requests_per_day=5, tokens_per_minute=32768,
       tokens_per_day=163840, max_concurrent=1, cost_per_attempt_micros=0
   where provider='cloudflare';

   update public.ai_provider_policy
   set enabled=true, free_tier_verified=true, requests_per_minute=1,
       requests_per_day=20, tokens_per_minute=7800,
       tokens_per_day=150000, max_concurrent=1, cost_per_attempt_micros=0
   where provider='groq';
   ```

6. Restart Next.js after setting environment values. The provider selector fetches local availability status, but **cannot determine live external provider quota**. The server rechecks local quota atomically for every call. Stop testing if an unexpected billable account or quota is involved.
7. Use a new test account for photo (Cloudflare, one JPEG), photo (Groq, start with one photo; up to three if token budget permits), text (Groq), and clarification. Check credits, throttling and error messages before real users. Never put keys in browser code, screenshots, or the conversation.

## Known caveats

- Cloudflare uses Neurons for its free allocation; the database's token-based cap cannot measure exact Neuron consumption. Free account enforcement remains essential.
- Groq Qwen 3.8 is capped at 1,024 completion tokens for 0-2 photos and 512 for three. The 8K TPM Free-plan cap means three-image requests can fail conservative token admission. Never silently drop images or spend paid quota. Complex food responses might truncate; validate in staging.
- Existing 20/day analysis credits and 60/day refinement limit continue to apply across all providers, with provider calls still limited by the global usage ledger.
- Before either account is configured and its operator-approved policy is enabled, the new options remain unavailable and Gemini continues as default.
- Unimplemented OpenRouter, Mistral, Hugging Face and Cerebras remain disabled.

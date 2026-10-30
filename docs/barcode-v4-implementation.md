# AI Fitness — Barcode V4: Nutrition completion and My Foods

Prerequisite: Barcode V3 patch installed, tests passing. This V4 patch upgrades only barcode UI and adds a personal-food table migration, server actions, utilities and tests. It does NOT commit/push, change keys, call AI during installation, or execute SQL.

## Workflow
1. Scan, upload, or type barcode. The server checks **this signed-in user's saved barcode record** before using Open Food Facts/cache; a found personal record wins. For unknown products, the normal manual fallback remains available.
2. If nutrients are incomplete, review nutrition manually (free) or upload nutrition-label/package photos and **explicitly** choose `Analyze label (1 AI credit)`. The existing quota-controlled food-analysis API receives those photos under the selected AI provider. Provider photo caps and no-paid-fallback remain enforced by the server.
3. AI returns a draft; user must verify serving grams and macros before using `Review meal for saving` and `Save ... to My Foods`. No AI suggestion is auto-saved. If the AI cannot provide an appropriate single-food result or portion weight, the app requires user correction. It is not an independent verification of nutritional accuracy.
4. Saved per-100g values are private to the user's Supabase account, mapped to the barcode. The same barcode uses saved values first on later scans. Null macros stay unknown, never false zeroes.
5. If the personal-food migration has not been applied, barcode lookup and ordinary meal saving still work; the My Foods action shows a migration warning instead of pretending it saved.

## Staging first
Review `supabase/migrations/20261030_personal_barcode_foods.sql` in a separate staging Supabase project. It creates `public.user_barcode_foods` with `(user_id, barcode)` primary key and owner-only Row Level Security on each operation. Also review the earlier optional daily-logging and shared-rate-limit migrations. Never run these on production blindly.

## Browser test
`npm.cmd run dev`, sign in, go to `/barcode`, scan `4800016552113`, fill its calories/macros from a real label, select `Review meal for saving`, then `Save reviewed nutrition to My Foods`. After the staging migration has been applied, reload, scan the same barcode and confirm `From My Foods` appears with the saved numbers. Test no-label, unreadable-image, unknown barcode, no-auth, provider cooldown, and AI-disabled cases.

For shared public production traffic, apply and test the separate **shared-rate-limits migration** before deploying the catalog lookup endpoint. Development-mode in-process limits do not protect multiple Vercel instances.

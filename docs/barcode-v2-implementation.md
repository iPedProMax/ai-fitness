# AI Fitness — Barcode Reliability + AI Photo Fallback (V2)

**Base:** Install after the first `fitness_ai_daily_logging_barcode_recipes_water_v1.ps1` pack (the user reported that pack passes 670 tests). This V2 makes no changes to recipes, water, saved meals, AI quota accounting, or model providers.

## Implemented

1. **Free photo AI fallback:** When a product is missing, the barcode page shows a link to the existing `/` photo scanner. Upload photos of the front of the package and readable nutrition label. AI *must not* infer exact nutrition from a bare barcode number. The existing photo scanner requires an explicit Analyze click and uses the existing daily AI analysis allowance; no AI calls run on a barcode lookup.
2. **Cross-browser camera:** The scanner now loads `@zxing/browser` on demand after user action, so it does not depend on the experimental `BarcodeDetector`. Camera still needs user permission and HTTPS/localhost. Manual barcode input always remains available. The scanning library is MIT-licensed and open source.
3. **Local product cache:** A bounded 24-hour localStorage cache stores only returned, public Open Food Facts product metadata (not photos, user IDs or prompts). The result is visibly marked cached and users are told to check the current label. Maximum approximately 45 product searches per browser. No cache of unsuccessful or error responses.
4. **Manual fallback:** Users can enter a packaged food's own nutrition values and save it with no AI usage. Missing macros are preserved as *unknown* (not zero). Enter values for the actual amount consumed.
5. **Serving shortcuts:** Detect a single unambiguous gram weight from Open Food Facts `serving_size` or `quantity` and offer one serving / one package / 100 g; never convert mL to grams or guess the weight of a piece. Manual grams remain editable.
6. **Production shared rate limits:** An optional new Supabase migration `20261030_food_catalog_shared_limits.sql` implements an atomic, shared, globally serialized per-user + global request gate. Until the migration is applied to the production database, the server fails closed with HTTP 503 for product lookup in production; development retains a guarded process-local limit. Existing photo AI scanner is unaffected.
7. **Tests:** Photo fallback UI wiring, caching, serving options, validation, upstream error behavior and production fail-closed gate.

## Operating limits

Open Food Facts publishes 15 product-lookups/min/IP and 10 search-queries/min/IP. AI Fitness limits outbound **production** API requests to max 10 barcode and 6 search/min globally, 3 barcode and 2 search/min per user, plus 40 barcode/day and 15 search/day per user. The 24-hour browser cache helps repeated lookups. These limits count real *uncached server calls* only, not product views from the browser cache. Open Food Facts data is provided under ODbL and may be missing or inaccurate; keep attribution and comply with reuse rules.

## Install and validate

Run from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\fitness_ai_barcode_reliability_ai_fallback_v2.ps1"
```

The installer verifies the expected V1 source files, makes timestamped backups, runs `npm.cmd install @zxing/browser@0.2.1 --save-exact`, `tsc --noEmit`, focused Vitest tests, the full Vitest suite and `npm.cmd run build`. It does **not** execute SQL, change cloud credentials, commit or push.

Test with `npm.cmd run dev`:
- `/barcode`, enter `3017624010701`, review nutrition and change serving shortcut.
- Search for a product name with just one match; it should now be selectable automatically.
- Scan a real package with a mobile browser over HTTPS; refuse camera permission and confirm manual entry still works.
- Enter an unknown barcode and try **Enter nutrition manually** and **Use photo AI instead**; confirm the photo scanner needs an explicit AI Analyze click and displays the normal quota.
- Repeat a product lookup and check the cached notice appears.

**Public release block:** Before deploying barcode lookup, review and apply the *separate* shared-limit SQL to an isolated staging Supabase project, validate RPC on two concurrent users, and then review the migration for production. Recipe/favorite/water migration from V1 is separate and is still optional. Do not blindly run either migration on a live database.

## Sources
- Open Food Facts API: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- ZXing browser library: https://www.npmjs.com/package/@zxing/browser

# AI Fitness — Daily Logging Usability Expansion

## Included in this installer

- `/barcode` — packaged-food lookup by barcode or deliberate product search via Open Food Facts, with an optional native browser camera scan (BarcodeDetector), manual fallback, user-reviewed serving size, nutrition and Add Meal.
- `/meals` — Log again without AI credits, delete a meal with confirmation, save a favorite, and edit saved-meal nutrition (editor uses an optional atomic database function).
- `/recipes` — recipe builder with whole-batch ingredients and per-serving amounts, persistent favorite meals and saved recipes (optional database migration).
- `/dashboard` — optional water logging, and simple week-average context where records exist (optional migration for water records).
- AURA personalization — extends the existing opt-in saved-data snapshot with water logs when available and limited seven-day nutrition averages based on logged days only.

## Important limits

- Open Food Facts data is user-contributed, can be missing or wrong. Barcode results should be checked against packaging. Product source must be attributed under ODbL.
- Live barcode reading uses the browser BarcodeDetector API; it is not supported on every device/browser and requires camera permission on HTTPS or localhost. Enter barcode manually as fallback.
- Camera, barcode lookup and saved-meal re-logging need no paid AI API.
- Recipe/favorite storage, water records, and post-save nutrition editing need optional migration `supabase/migrations/20261030_daily_logging_optional.sql`. The installer WILL NOT apply it or alter any Supabase project.
- Apply the migration only after confirming that the target Supabase database is separate staging and after reviewing it. Production requires separate migration review.
- Product search is click-to-search only, not search-as-you-type; upstream rate limits apply (Open Food Facts: 15 product lookups/min/IP; 10 searches/min/IP).
- Server in-memory rate caps are best-effort. For multi-instance deployment, add durable shared abuse controls and a cache before major public launch.
- This is a feature implementation, not an assertion of working production integration. Run tests and perform a live device/DB test.

## Deferred until separate integrations are justified

- Wearables/step import (depends on supported data providers and consent).
- Detailed micronutrients (requires validated nutrient database coverage, units and provenance).
- Voice logging (depends on browser/device and speech recognition provider).
- Notifications and exports (require product decisions and further privacy work).
- Fully adaptive calorie targets (needs long-term consistent data, safety review and careful handling of missing logs).

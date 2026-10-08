# Save Meal + Meal History Design

## Goal

Turn the food scanner into a real tracker by allowing signed-in users to save analyzed meals and view their own meal history, while keeping the scanner usable by guests.

## User Experience

Guests:
- Can scan food and view AI nutrition results.
- Cannot save meals.
- Pressing Add Meal should prompt/signpost them to sign in.

Signed-in users:
- Can scan food.
- Can save the final AI result.
- Can view only their own saved meals.
- Can later use saved meals for reports, goals, charts, and broader nutrition tracking.

## Data Model

Use a hybrid relational + JSON approach.

### meals

Stores one saved meal per row.

Fields:
- id
- user_id
- created_at
- total_calories
- total_protein
- total_carbs
- total_fat
- notes
- analysis_snapshot JSONB

The analysis snapshot preserves the final FoodAnalysis result for traceability and future schema changes.

### meal_items

Stores each analyzed food item separately.

Fields:
- id
- meal_id
- user_id
- name
- estimated_grams
- calories
- protein
- carbs
- fat
- confidence
- weight_source
- nutrition_source
- created_at

This relational structure makes future reporting and nutrition aggregation easier.

## Security

All saved data is user-owned.

Supabase Row Level Security must enforce:
- users can only read their own meals
- users can only insert meals with their own user_id
- users can only update/delete their own meals
- meal_items must follow the same ownership rules

The server must verify the authenticated Supabase user before saving.

Client-side hiding is not considered security.

## Guest Mode

The root food scanner remains public.

Guest users may analyze food but cannot persist data.

The Add Meal action must detect an unauthenticated user and direct them to sign in instead of attempting a database write.

## Privacy

Uploaded food photos will not be permanently stored in this first version.

Only the final nutrition result and meal metadata will be persisted.

This reduces storage, privacy, and retention complexity while still enabling meal history and reports.

## Nutrition Expansion

The current schema stores:
- calories
- protein
- carbs
- fat

Future fields may include:
- sugar
- fiber
- sodium
- saturated fat
- cholesterol
- caffeine
- other nutrition metrics

The database design should allow those fields to be added without replacing the meal system.

## Meal Time Handling

Store the actual timestamp only.

Do not permanently classify meals as breakfast, lunch, dinner, or snack yet.

Morning/Afternoon/Evening groupings can be derived later for Daily Reports and adjusted without rewriting stored meal records.

## Initial Implementation Scope

1. Create meals and meal_items tables.
2. Add Row Level Security policies.
3. Add a secure server-side saveMeal action.
4. Connect the existing Add Meal button.
5. Handle guests with a sign-in-to-save flow.
6. Add a basic Meal History page.
7. Verify cross-user access is blocked.

## Not Included Yet

- permanent image storage
- calorie goals
- sugar/sodium goals
- health-condition management
- charts
- daily report UI
- editing saved meals
- drinking mode
- subscriptions or premium limits

These can build on top of the saved meal foundation later.

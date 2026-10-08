# Save Meal + Meal History Implementation Plan

Goal: Let signed-in users save AI-analyzed meals and view their own history while guests can still use the scanner.

## Task 1 - Database + RLS
- Create `meals`
- Create `meal_items`
- Add ownership with `user_id`
- Add Row Level Security
- Prevent cross-user access

## Task 2 - Save Meal
- Create secure server action
- Validate FoodAnalysis
- Verify authenticated Supabase user
- Save meal totals + food items
- Never trust user_id from the browser

## Task 3 - Add Meal Button
- Connect existing Add Meal button
- Guests go to sign in
- Signed-in users save meals
- Show Saving / Saved / Error states

## Task 4 - Meal History
- Create `/meals`
- Show newest meals first
- Display calories, macros, food names and timestamp
- Guests cannot access history
- Add Meal History link to account menu

## Task 5 - Security Verification
- Test guest behavior
- Save meal with Account A
- Confirm Account B cannot see Account A data
- Run full tests and production build

Constraints:
- Scanner stays public
- Food photos are not permanently stored
- RLS is required
- Current Google/email auth stays unchanged
- Future sugar, sodium, fiber and other nutrition fields can build on this system

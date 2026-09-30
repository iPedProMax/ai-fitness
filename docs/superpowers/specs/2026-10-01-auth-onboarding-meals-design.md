# Authentication, Onboarding, and Meal Persistence Design

## Goal

Add user accounts, personalized fitness onboarding, calorie/macro targets,
and persistent meal saving to the existing AI Fitness food scanner.

The existing food analysis and clarification workflow should remain intact.

---

## Scope

This phase introduces:

- Supabase
- Email/password authentication
- Google authentication
- User profile storage
- Step-by-step onboarding
- TDEE/BMR-based calorie targets
- Weight goal configuration
- Optional custom calorie targets
- Persistent meal saving
- Per-user data security

Meal history dashboards, analytics, activity tracking, AI coaching, and
advanced reporting will build on this foundation later.

---

## Authentication

Users can authenticate using:

1. Email and password
2. Google

Supabase Auth owns authentication and user identity.

The Next.js application uses Supabase SSR clients so authentication works
between browser components, server components, route handlers, and protected
pages.

Google authentication uses the OAuth PKCE flow and an application callback
route.

---

## Authentication Flow

### New user

Sign up / Google Sign In
→ authenticated session
→ check profile onboarding status
→ onboarding wizard if incomplete
→ scanner/home if complete

### Existing user

Sign in
→ authenticated session
→ scanner/home

### Signed-out user

Protected user data such as saved meals and profile information is not
accessible.

---

## Onboarding

Onboarding uses a wizard rather than one large form.

A wizard is a form divided into multiple screens so the user only handles a
small amount of information at a time.

### Step 1: Basic Information

Fields:

- Display name
- Date of birth
- Sex

Date of birth is stored instead of a fixed age so age can be calculated as
time passes.

### Step 2: Measurements

Fields:

- Height
- Weight
- Unit system

Supported unit systems:

- Metric
- Imperial

Values should be normalized for calculations/storage where appropriate.

### Step 3: Activity

The user selects an activity level.

The UI includes descriptions so users understand each choice.

Activity options:

- Sedentary
- Lightly active
- Moderately active
- Very active
- Extra active

The application may include a "Not sure" helper experience without storing
"not sure" as the final activity value used for calculation.

### Step 4: Goal

Goal options:

- Lose weight
- Maintain weight
- Gain weight
- Custom calorie target

For lose/gain goals, users can choose the amount of control they want.

#### Simple

The app selects a reasonable default calorie adjustment.

#### Flexible

The user selects:

- Slow
- Moderate
- Aggressive

#### Advanced

The user enters an exact calorie deficit or calorie surplus.

#### Custom calorie target

The user directly enters the desired calories per day instead of deriving the
target from a TDEE adjustment.

Maintain uses estimated maintenance calories and does not need
slow/moderate/aggressive options.

### Step 5: Optional Information

Body fat percentage is optional.

Users are not required to estimate body fat if they do not know it.

### Step 6: Target Summary

Show:

- BMR
- Estimated TDEE
- Goal
- Adjustment strategy
- Daily calorie target
- Protein target
- Carbohydrate target
- Fat target

Calculated macro targets are the default.

Users can customize macro targets later.

---

## Skipping Onboarding

Onboarding can be skipped.

A user who skips onboarding can:

- use the food scanner
- analyze food
- answer clarifications
- save meals

However, personalized calorie and macro targets are unavailable until the
required profile information is completed.

Where targets would normally appear, the UI should prompt the user to finish
profile setup.

Skipping onboarding must not prevent the core food scanner from working.

---

## Goal Calculation

The application calculates a BMR estimate from profile data and derives an
estimated TDEE using the selected activity level.

Goal adjustments are applied to TDEE for automatic targets.

Supported target modes:

- Maintain
- Simple loss/gain
- Flexible loss/gain
- Advanced exact deficit/surplus
- Direct custom calorie target

Calculation logic should live in a dedicated pure TypeScript module rather
than directly inside UI components.

The calculation module must be unit tested.

---

## Macro Targets

The application automatically generates macro targets from the calculated
daily calorie target.

Automatic targets are intended to make setup easy for beginners.

Advanced users can override macro targets later.

Custom macro editing is not required for the initial authentication and meal
persistence milestone unless needed by the onboarding UI.

---

## Database

### profiles

One profile belongs to one Supabase Auth user.

Suggested fields:

- user_id
- display_name
- date_of_birth
- sex
- height_cm
- weight_kg
- activity_level
- body_fat_percent
- unit_system
- onboarding_completed
- created_at
- updated_at

### nutrition_goals

Stores the user's current nutrition target configuration.

Suggested fields:

- id
- user_id
- goal_type
- adjustment_mode
- adjustment_rate
- calorie_adjustment
- custom_calorie_target
- calculated_bmr
- calculated_tdee
- calorie_target
- protein_target_g
- carbs_target_g
- fat_target_g
- created_at
- updated_at

A user has one active current nutrition goal in the MVP.

### meals

Represents one saved eating event.

Suggested fields:

- id
- user_id
- eaten_at
- total_calories
- notes
- created_at
- updated_at

### meal_items

Represents the individual foods belonging to a saved meal.

Suggested fields:

- id
- meal_id
- user_id
- name
- estimated_grams
- calories
- protein_g
- carbs_g
- fat_g
- confidence
- weight_source
- nutrition_source
- created_at

The saved values represent the final confirmed/refined scanner result rather
than the initial unconfirmed AI result.

---

## Meal Saving Flow

Current scanner flow:

Photos
→ AI analysis
→ clarification
→ refinement
→ user confirmation

New persistence flow:

Photos
→ AI analysis
→ clarification
→ refinement
→ user presses Add Meal
→ authenticated save request
→ create meal
→ create meal items
→ success confirmation

The scanner should not automatically save an AI result before the user
confirms it.

---

## Security

Row Level Security must be enabled on all user-owned exposed tables.

Users may only read and modify their own:

- profile
- nutrition goals
- meals
- meal items

Policies use the authenticated Supabase user ID.

Client-provided user IDs must never be trusted as authorization by
themselves.

The database authorization layer remains responsible for enforcing ownership.

---

## Application Structure

Keep responsibilities separated.

Suggested modules:

- Supabase browser client
- Supabase server client
- auth callback
- authentication UI/actions
- profile/onboarding UI
- goal calculation library
- profile persistence
- meal persistence

The existing food-analysis logic remains separate from authentication and
database persistence.

---

## Routing

Initial application routes should include concepts equivalent to:

- /auth/login
- /auth/sign-up
- /auth/callback
- /onboarding
- / scanner/home

Exact UI route organization can follow the existing Next.js App Router
structure.

Authenticated users with incomplete onboarding may be directed to onboarding,
while still retaining a way to skip it and access the scanner.

---

## Error Handling

Authentication errors should be shown clearly without exposing sensitive
details.

Onboarding validation should identify the field that needs correction.

Database save failures must not pretend that a meal was successfully saved.

If meal saving fails, the analyzed/refined meal should remain visible so the
user can retry instead of rescanning the food.

OAuth callback failures should return the user to an authentication screen
with an understandable error state.

---

## Testing

Use the existing Vitest test suite.

Behavior changes follow RED → GREEN TDD.

Tests should cover at minimum:

- BMR/TDEE calculation
- goal adjustment calculation
- custom calorie target behavior
- onboarding required versus optional fields
- skipped onboarding behavior
- meal payload construction
- authentication requirement for persistent meal saving
- ownership/RLS expectations where practical
- existing food scanner regression tests

The existing scanner tests must remain green.

---

## MVP Constraints

Do not add unnecessary systems during this milestone.

Not included yet:

- social features
- subscriptions
- wearable integration
- workout programming
- AI coaching
- long-term analytics
- meal sharing
- image storage/history
- multi-profile households

Those can be added after authentication, onboarding, and meal persistence are
stable.

---

## Success Criteria

This milestone is successful when:

1. A user can sign up with email/password.
2. A user can sign in with Google.
3. Authentication survives navigation and refresh.
4. A new user can complete or skip onboarding.
5. Completing onboarding produces personalized calorie and macro targets.
6. A skipped user can still use the food scanner.
7. The existing scanner and clarification behavior remains functional.
8. Pressing Add Meal saves the final confirmed meal.
9. Saved meals belong only to the authenticated user.
10. One user cannot access another user's profile, goals, meals, or meal
    items.
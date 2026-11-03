KHALORIES AI — PHASE Y4 (ADMIN ACCOUNT CONTROLS)

Purpose
-------
User Management gains a Manage action for each account. The account details page
shows counts and includes separate Reset tracking and Delete account workflows.

Protection
----------
1. The logged-in admin must have app_metadata.khalories_role=admin AND their UID
   must be on KHALORIES_ADMIN_USER_IDS. This is stricter than the read-only directory.
2. Admin must have signed in within the previous 10 minutes (a new login, not
   an arbitrary shared password). For truly sensitive production actions, enable
   MFA and review authorization at deployment.
3. Target must not be an admin, the signed-in admin or a UID on the allowlist.
4. Exact target email, an operation-specific confirmation phrase and a user
   request reason are required. Independently verify the request first.
5. Default feature flag KHALORIES_ENABLE_ADMIN_ACCOUNT_ACTIONS is OFF.
6. Storage ownership must be clear. The operation blocks if any owned Storage
   objects or meal thumbnail references are found; use Supabase Storage API
   to remove them only after confirming ownership and user consent.
7. All operations require the restricted audit table. Missing SQL functions and
   schema cause failures, not silent destructive fallback.
8. Reset uses one atomic Postgres function and keeps Auth and AI credit usage.
   Delete uses the Supabase Auth Admin API; verified ON DELETE CASCADE foreign keys
   remove public user-owned rows. Auth access tokens may remain valid briefly.
9. Admin audit entries contain actor/target IDs, action, reason and outcome.
10. The staging project's existing schema was checked as of Nov 3, 2026;
    a separate production database needs independent verification.

Install
-------
1. Run the accompanying PhaseY4.ps1 installer on feature/supabase-auth.
   This changes source files only, builds and tests, and rolls back on failure.
   It does NOT change the database or accounts.
2. Review docs/khalories_phase_y4_admin_account_controls.sql against the CURRENT
   schema of your selected Supabase project. Apply it manually via SQL Editor,
   after backups and a staging test. It creates the audit table and two restricted
   SQL functions; installation alone does not delete user data.
3. Ensure SUPABASE_SERVICE_ROLE_KEY is set SERVER ONLY, and make sure
   KHALORIES_ADMIN_USER_IDS includes the appropriate admin Auth UID. Never
   expose these values to the browser or this conversation.
4. After verifying the SQL migration and staging workflow, set SERVER ONLY
   KHALORIES_ENABLE_ADMIN_ACCOUNT_ACTIONS=true, restart the app, and sign
   in again. Absent this flag, all destructive controls stay disabled.
5. Visit /admin/analytics/users > Manage. First test with a dedicated staging
   user account you own and whose data may be discarded. Never test on live users.

Known limitations
-----------------
- This phase intentionally does not automatically delete Storage objects. It
  fails closed until storage is cleared via the supported Storage API.
- Neither this installer nor the SQL migration is a transactionally recoverable
  backup of data. Permanent deletion cannot be undone.
- Server code checks a recent sign-in but does not implement a full password/
  passkey reauthentication challenge; require MFA for production hardening.
- The Y4 reset covers existing user data tables, not provider-wide ledgers or
  AI quota accounting. Update the reset list if new user tables are added.
- Before enabling account deletion, verify each database you deploy to has
  ON DELETE CASCADE for all user-owned tables.

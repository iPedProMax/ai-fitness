/**
 * Narrow types for the tables and RPCs used by Phase Y4 admin operations.
 * The main Khalories project does not currently generate Supabase Database types,
 * so the default supabase-js client infers unknown RPC args and `never` mutations.
 * These declarations describe the existing, reviewed staging schema plus the
 * migration in docs/khalories_phase_y4_admin_account_controls.sql.
 * Update them alongside any future migration that changes those objects.
 */
type OwnedTable = {
  Row: { user_id: string };
  Insert: { user_id: string };
  Update: { user_id?: string };
  Relationships: [];
};

type AuditAction = "reset" | "delete";
type AuditOutcome = "started" | "completed" | "failed";

type AccountAuditRow = {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  action: AuditAction;
  outcome: AuditOutcome;
  reason: string;
  created_at: string;
};

export type AdminAccountDatabase = {
  public: {
    Tables: {
      meals: OwnedTable;
      meal_items: OwnedTable;
      activities: OwnedTable;
      fitness_goals: OwnedTable;
      weight_entries: OwnedTable;
      water_entries: OwnedTable;
      meal_templates: OwnedTable;
      user_preferences: OwnedTable;
      user_barcode_foods: OwnedTable;
      khalories_admin_account_audit: {
        Row: AccountAuditRow;
        Insert: Omit<AccountAuditRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AccountAuditRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      khalories_admin_user_storage_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      khalories_admin_reset_tracking: {
        Args: {
          p_actor_user_id: string;
          p_target_user_id: string;
          p_reason: string;
        };
        Returns: { ok: boolean };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

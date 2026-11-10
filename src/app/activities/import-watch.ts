"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activityTimeValid, ACTIVITY_TYPES, INTENSITIES } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES), intensity: z.enum(INTENSITIES),
  durationMinutes: z.number().int().min(1).max(720),
  reportedCalories: z.number().min(0).max(10000).nullable(),
  performedAt: z.iso.datetime({ offset: true }),
  notes: z.string().max(200),
}).strict();
export type WatchCsvRow = z.infer<typeof rowSchema>;
export type ImportWatchResult = {ok:true; imported:number;duplicates:number}|{ok:false;message:string};

export async function importWatchActivities(input: unknown): Promise<ImportWatchResult> {
  const parsed = z.array(rowSchema).min(1).max(40).safeParse(input);
  if (!parsed.success || parsed.data.some(row => !activityTimeValid(row.performedAt))) {
    return {ok:false,message:"Only 1–40 valid past workouts can be imported at a time."};
  }
  const supabase = await createClient();
  const {data:{user},error:authError} = await supabase.auth.getUser();
  if (authError || !user) return {ok:false,message:"Sign in before importing watch workouts."};
  const rows = parsed.data.map(row => ({
    user_id: user.id,
    import_source: "watch_csv",
    import_key: createHash("sha256").update(JSON.stringify([row.activityType,row.intensity,row.durationMinutes,row.reportedCalories,row.performedAt,row.notes])).digest("hex"),
    activity_type: row.activityType,
    intensity: row.intensity,
    duration_minutes: row.durationMinutes,
    weight_kg: null,
    calories_burned: row.reportedCalories,
    calorie_source: row.reportedCalories === null ? "not_estimated" : "reported",
    performed_at: row.performedAt,
    notes: row.notes ? `Watch CSV: ${row.notes}`.slice(0,280) : "Imported from watch CSV",
  }));
  const {data,error} = await supabase.from("activities").upsert(rows,{onConflict:"user_id,import_source,import_key",ignoreDuplicates:true}).select("id");
  if (error) return {ok:false,message:"Could not import. Make sure the watch CSV migration is applied to this Supabase project."};
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  return {ok:true,imported:data?.length??0,duplicates:rows.length-(data?.length??0)};
}

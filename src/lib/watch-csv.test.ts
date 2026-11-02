import {describe,it,expect} from "vitest";
import {parseWatchCsvWorkouts} from "./watch-csv";
describe("watch CSV validation",()=>{
  const header="performed_at,duration_minutes,activity_type,calories_burned,intensity,notes\n";
  it("reads timezone-aware watch workouts",()=>{
    const rows=parseWatchCsvWorkouts(header+"2026-09-30T18:00:00+08:00,35,walking,155,moderate,Treadmill\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({durationMinutes:35,activityType:"walking",reportedCalories:155});
  });
  it("requires timezone offsets and valid exercises",()=>{
    expect(()=>parseWatchCsvWorkouts(header+"2026-09-30T18:00:00,35,walking,155,moderate,Treadmill\n")).toThrow("row 2");
    expect(()=>parseWatchCsvWorkouts(header+"2026-09-30T18:00:00+08:00,35,flying,155,moderate,Treadmill\n")).toThrow("row 2");
  });
  it("rejects oversized batches and invalid calories",()=>{
    expect(()=>parseWatchCsvWorkouts(header+"2026-09-30T18:00:00+08:00,35,walking,-9,moderate,Treadmill\n")).toThrow();
    expect(()=>parseWatchCsvWorkouts(header+"2026-09-30T18:00:00+08:00,35,walking,155,moderate,Treadmill\n".repeat(41))).toThrow("up to 40");
  });
});

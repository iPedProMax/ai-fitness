import { ACTIVITY_TYPES, INTENSITIES } from "@/lib/activity";
import type { WatchCsvRow } from "@/app/activities/import-watch";

/** Small RFC 4180-style CSV parser: supports quotes, doubled quotes and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quote = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c === '"') { if (quote && text[i+1] === '"') {field+='"';i++;} else quote=!quote; }
    else if (!quote && c===',') {row.push(field);field="";}
    else if (!quote && (c==='\n'||c==='\r')) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field="";if(row.some(x=>x.trim()))rows.push(row);row=[];}
    else field+=c;
  }
  if (quote) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function parseWatchCsvWorkouts(text: string): WatchCsvRow[] {
  const csv=parseCsv(text);if(csv.length<2)throw new Error("Add a header and at least one workout row.");
  const headers=csv[0].map(x=>x.trim().toLowerCase());
  const keys=["performed_at","duration_minutes","activity_type","calories_burned"];
  if(keys.some(x=>!headers.includes(x)))throw new Error("Required columns: performed_at, duration_minutes, activity_type, calories_burned.");
  if(csv.length>41)throw new Error("Import up to 40 workouts per file.");
  return csv.slice(1).map((values,i)=>{
    const field=(key:string)=>values[headers.indexOf(key)]?.trim()??"";
    const rawWhen=field("performed_at");
    const date=new Date(rawWhen);
    const duration=Number(field("duration_minutes"));
    const rawCalories=field("calories_burned");const calories=rawCalories===""?null:Number(rawCalories);
    const activity=field("activity_type");
    const intensity=field("intensity")||"moderate";
    const notes=field("notes");
    if(!rawWhen||!/(Z|[+-]\d{2}:\d{2})$/i.test(rawWhen)||Number.isNaN(date.getTime())||date.getTime()>Date.now()+300000||date.getTime()<Date.UTC(2020,0,1)||
      !Number.isInteger(duration)||duration<1||duration>720||
      (calories!==null&&(!Number.isFinite(calories)||calories<0||calories>10000))||
      !ACTIVITY_TYPES.includes(activity as typeof ACTIVITY_TYPES[number])||
      !INTENSITIES.includes(intensity as typeof INTENSITIES[number])||notes.length>200)throw new Error(`Invalid workout on CSV row ${i+2}.`);
    return {performedAt:date.toISOString(),durationMinutes:duration,activityType:activity as WatchCsvRow["activityType"],intensity:intensity as WatchCsvRow["intensity"],reportedCalories:calories,notes};
  });
}

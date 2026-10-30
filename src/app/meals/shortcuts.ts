"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { foodAnalysisSchema } from "@/lib/food-analysis";
import { saveMeal } from "@/app/meals/actions";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result={ok:true}|{ok:false;message:string};
async function currentUser(){const db=await createClient();const{data:{user},error}=await db.auth.getUser();return{db,user:!error?user:null};}
export async function logMealAgain(id:string):Promise<Result>{
  if(!uuid.test(id))return{ok:false,message:"Invalid meal ID."};
  const{db,user}=await currentUser();if(!user)return{ok:false,message:"Sign in first."};
  const{data,error}=await db.from("meals").select("analysis_snapshot").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(error||!data)return{ok:false,message:"Meal not available."};
  const parsed=foodAnalysisSchema.safeParse(data.analysis_snapshot);
  if(!parsed.success)return{ok:false,message:"Old meal format cannot be re-logged. Try manual logging."};
  const result=await saveMeal(parsed.data);
  if(!result.ok)return{ok:false,message:result.message};
  revalidatePath("/dashboard");revalidatePath("/meals");revalidatePath("/reports");
  return{ok:true};
}
export async function deleteSavedMeal(id:string):Promise<Result>{
  if(!uuid.test(id))return{ok:false,message:"Invalid meal ID."};
  const{db,user}=await currentUser();if(!user)return{ok:false,message:"Sign in first."};
  const{data,error}=await db.from("meals").delete().eq("id",id).eq("user_id",user.id).select("id");
  if(error||!data?.length)return{ok:false,message:"Could not delete meal. Check whether it's referenced by another record."};
  revalidatePath("/dashboard");revalidatePath("/meals");revalidatePath("/reports");
  return{ok:true};
}
export async function saveFavoriteMeal(id:string):Promise<Result>{
  if(!uuid.test(id))return{ok:false,message:"Invalid meal ID."};
  const{db,user}=await currentUser();if(!user)return{ok:false,message:"Sign in first."};
  const{data,error}=await db.from("meals").select("analysis_snapshot").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(error||!data)return{ok:false,message:"Meal not available."};
  const parsed=foodAnalysisSchema.safeParse(data.analysis_snapshot);
  if(!parsed.success)return{ok:false,message:"Cannot save this old meal as a favorite."};
  const title=parsed.data.foods.slice(0,3).map(food=>food.name).join(" + ").slice(0,120);
  const result=await db.from("meal_templates").upsert({user_id:user.id,title,kind:"favorite",analysis_snapshot:parsed.data},{onConflict:"user_id,title,kind"});
  if(result.error)return{ok:false,message:"Could not save favorite. The optional database migration may not be installed."};
  revalidatePath("/recipes");return{ok:true};
}

"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {foodAnalysisSchema} from "@/lib/food-analysis";
export async function updateSavedMealNutrition(id:string,analysis:unknown):Promise<{ok:true}|{ok:false;message:string}>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return{ok:false,message:"Invalid meal ID"};
  const parsed=foodAnalysisSchema.safeParse(analysis);
  if(!parsed.success)return{ok:false,message:"Check the edited food values."};
  const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return{ok:false,message:"Sign in first."};
  // A single transactional RPC prevents inconsistencies between meals and meal_items.
  const{data,error}=await db.rpc("replace_saved_meal_nutrition",{p_meal_id:id,p_analysis:parsed.data});
  if(error||data!==true)return{ok:false,message:"Could not update meal. The optional meal-edit migration may not be installed."};
  revalidatePath("/meals");revalidatePath("/dashboard");revalidatePath("/reports");return{ok:true};
}

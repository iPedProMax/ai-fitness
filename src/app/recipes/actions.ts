"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import { recipeOneServing } from "@/lib/recipe-utils";
export async function saveRecipeTemplate(input:unknown):Promise<{ok:true}|{ok:false;message:string}>{
  let recipe:ReturnType<typeof recipeOneServing>;
  try{recipe=recipeOneServing(input);}catch(e){return{ok:false,message:e instanceof Error?e.message:"Invalid recipe"};}
  const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return{ok:false,message:"Sign in first."};
  const{error}=await db.from("meal_templates").upsert({user_id:user.id,title:recipe.title,kind:"recipe",analysis_snapshot:recipe.analysis},{onConflict:"user_id,title,kind"});
  if(error)return{ok:false,message:"Could not save recipe. Check the optional database migration."};
  revalidatePath("/recipes");return{ok:true};
}
export async function deleteMealTemplate(id:string):Promise<{ok:true}|{ok:false;message:string}>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return{ok:false,message:"Invalid template ID."};
  const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return{ok:false,message:"Sign in first."};
  const{data,error}=await db.from("meal_templates").delete().eq("id",id).eq("user_id",user.id).select("id");
  if(error||!data?.length)return{ok:false,message:"Could not delete saved template."};
  revalidatePath("/recipes");return{ok:true};
}

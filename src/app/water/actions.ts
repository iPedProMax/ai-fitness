"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {manilaDateKey} from "@/lib/fitness-goals";
export async function addWater(ml:number):Promise<{ok:true}|{ok:false;message:string}>{
  if(!Number.isInteger(ml)||ml<50||ml>2000)return{ok:false,message:"Enter 50–2,000 mL per entry."};
  const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return{ok:false,message:"Sign in first."};
  const today=manilaDateKey();const{count,error:countError}=await db.from("water_entries").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("logged_on",today);
  if(countError)return{ok:false,message:"Water tracking isn't ready. Apply the optional database migration."};
  if((count??0)>=30)return{ok:false,message:"Daily water log limit reached."};
  const{error}=await db.from("water_entries").insert({user_id:user.id,logged_on:today,amount_ml:ml});
  if(error)return{ok:false,message:"Could not save water entry."};
  revalidatePath("/dashboard");return{ok:true};
}

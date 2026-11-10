"use server";
import {createClient} from "@/lib/supabase/server";
import {personalBarcodeFoodSchema,savedRowToCatalog, type PersonalBarcodeFoodInput} from "@/lib/personal-barcode-food";
import {validBarcode,type CatalogFood} from "@/lib/open-food-facts";

export type PersonalBarcodeLookup =
  | {status:"found"; food:CatalogFood}
  | {status:"not_found"}
  | {status:"not_configured"}
  | {status:"error";message:string};

/** User-scoped read, never the service-role key. Reads are also protected by RLS. */
export async function findMyBarcodeFood(barcode:string):Promise<PersonalBarcodeLookup> {
  if(!validBarcode(barcode))return {status:"error",message:"Invalid barcode."};
  try{
    const db=await createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user)return {status:"error",message:"Sign in to access your foods."};
    const {data,error}=await db.from("user_barcode_foods")
      .select("barcode,name,brand,serving_description,package_description,calories_100g,protein_100g,carbs_100g,fat_100g,source")
      .eq("user_id",user.id).eq("barcode",barcode).maybeSingle();
    if(error){
      if(error.code==="42P01"||error.code==="PGRST205")return {status:"not_configured"};
      if(process.env.NODE_ENV!=="production")console.warn("[MY_FOODS_LOOKUP_ERROR]",{code:error.code,message:error.message});
      return {status:"error",message:"Your saved foods could not be checked right now."};
    }
    if(!data)return {status:"not_found"};
    const food=savedRowToCatalog(data);
    return food?{status:"found",food}:{status:"error",message:"Your saved food has invalid nutrition values. Please review it."};
  }catch{return {status:"error",message:"Your saved foods are temporarily unavailable."};}
}

export type SavePersonalBarcodeResult = {ok:true}|{ok:false;reason:"invalid"|"unauthenticated"|"not_configured"|"database";message:string};
export async function saveMyBarcodeFood(raw:PersonalBarcodeFoodInput):Promise<SavePersonalBarcodeResult>{
  const parsed=personalBarcodeFoodSchema.safeParse(raw);
  if(!parsed.success)return {ok:false,reason:"invalid",message:"Check the barcode, grams and nutrition before saving."};
  try{
    const db=await createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user)return {ok:false,reason:"unauthenticated",message:"Sign in to save foods to your account."};
    const d=parsed.data;
    const {error}=await db.from("user_barcode_foods").upsert({
      user_id:user.id,barcode:d.barcode,name:d.name,brand:d.brand,
      serving_description:d.servingDescription,package_description:d.packageDescription,
      calories_100g:d.calories100g,protein_100g:d.protein100g,
      carbs_100g:d.carbs100g,fat_100g:d.fat100g,
      source:d.source,updated_at:new Date().toISOString(),
    },{onConflict:"user_id,barcode"});
    if(error){
      if(error.code==="42P01"||error.code==="PGRST205")return {ok:false,reason:"not_configured",message:"My Foods isn't enabled yet. Review and apply the personal barcode migration in staging first."};
      if(process.env.NODE_ENV!=="production")console.warn("[MY_FOODS_SAVE_ERROR]",{code:error.code,message:error.message});
      return {ok:false,reason:"database",message:"Could not save My Foods. Please retry."};
    }
    return {ok:true};
  }catch{return {ok:false,reason:"database",message:"Could not connect to My Foods."};}
}

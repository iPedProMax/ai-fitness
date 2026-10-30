import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {RecipeBuilder} from "@/components/recipe-builder";
export const dynamic="force-dynamic";
export default async function RecipesPage(){const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)redirect("/auth/login");
  const{data,error}=await db.from("meal_templates").select("id,title,kind,analysis_snapshot").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  return <main className="bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-4xl"><Link href="/meals" className="text-sm font-semibold text-emerald-700 hover:underline">← Meal history</Link><h1 className="mt-5 text-3xl font-bold">Recipes & favorites</h1><p className="my-5 text-sm text-slate-600">Save common meals and recipes so you can log them in one tap next time.</p><RecipeBuilder templates={data??[]} error={Boolean(error)}/></div></main>;
}

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFoodApiAuth } from "@/lib/food-api-auth";
import { parseOpenFoodFactsProduct, validBarcode } from "@/lib/open-food-facts";
import { CATALOG_LIMITS, type CatalogLimitKind } from "@/lib/catalog-limit-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const head = { "Cache-Control":"private, no-store" };
const globalCalls:Record<CatalogLimitKind,number[]>={barcode:[],search:[]};
const userAgent = "AI-Fitness/0.1 (https://github.com/iPedProMax/ai-fitness; Open Food Facts lookup)";
const blocked=(message:string,code:string,status:number,retry=60)=>NextResponse.json({error:message,code}, {status,headers:{...head,...(status===429?{"Retry-After":String(retry)}:{})}});

/** Local development only. In production we require an atomic DB gate shared by ALL instances. */
async function authorize(kind:CatalogLimitKind):Promise<NextResponse|null>{
  if(process.env.NODE_ENV==="production"){
    try{
      const client=await createClient();
      const {data:{user},error}=await client.auth.getUser();
      if(error||!user)return blocked("Sign in to search food.","UNAUTHENTICATED",401);
      const {data,error:limitError}=await client.rpc("admit_food_catalog_lookup",{p_kind:kind});
      if(limitError||!data||typeof data!=="object"||Array.isArray(data)||!("allowed" in data))
        return blocked("Food search is temporarily paused until shared rate limits are configured.","CATALOG_LIMITS_UNAVAILABLE",503);
      if(data.allowed!==true)return blocked("Food searches are temporarily limited. Try again later.","CATALOG_RATE_LIMITED",429,Number.isFinite(Number(data.retry_after))?Math.max(1,Math.min(86400,Number(data.retry_after))):60);
      return null;
    }catch{return blocked("Food search is temporarily unavailable.","CATALOG_LIMITS_UNAVAILABLE",503);}
  }
  const now=Date.now();const cap=CATALOG_LIMITS[kind].perMinuteGlobal;
  globalCalls[kind]=globalCalls[kind].filter(time=>now-time<60_000);
  if(globalCalls[kind].length>=cap)return blocked("Food lookup is busy. Try again in a minute.","CATALOG_RATE_LIMITED",429);
  globalCalls[kind].push(now);return null;
}
export async function GET(request:Request){
  const denied=await requireFoodApiAuth();if(denied)return denied;
  const params=new URL(request.url).searchParams;
  const barcode=params.get("barcode")?.trim()??"";
  const query=params.get("q")?.trim()??"";
  if(Boolean(barcode)===Boolean(query))return blocked("Choose either a barcode or a product search.","INVALID_QUERY",400);
  if(barcode?!validBarcode(barcode):query.length<3||query.length>60||/[\u0000-\u001f]/.test(query))
    return blocked("Enter an 8–14 digit barcode or a search of 3–60 characters.","INVALID_QUERY",400);
  const kind:CatalogLimitKind=barcode?"barcode":"search";
  const limited=await authorize(kind);if(limited)return limited;
  const fields="code,product_name,product_name_en,brands,serving_size,quantity,nutriments";
  const url=barcode
    ? `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`
    : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=${fields}`;
  try{
    const response=await fetch(url,{headers:{"User-Agent":userAgent,"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(8000),cache:"no-store"});
    if(response.status===429)return blocked("The food database is rate limiting lookups. Try again later.","UPSTREAM_RATE_LIMITED",429);
    if(!response.ok)return blocked("Food database temporarily unavailable.","UPSTREAM_UNAVAILABLE",503);
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object")throw new Error("Invalid response");
    const obj=raw as Record<string,unknown>;
    const candidates=barcode?(obj.status===1&&obj.product?[obj.product]:[]):(Array.isArray(obj.products)?obj.products.slice(0,8):[]);
    const foods=candidates.map(parseOpenFoodFactsProduct).filter((food):food is NonNullable<typeof food>=>food!==null);
    return NextResponse.json({foods,source:"Open Food Facts",license:"ODbL",attribution:"https://world.openfoodfacts.org/"},{headers:head});
  }catch{return blocked("Food lookup failed. You can enter the values manually or use photo AI.","UPSTREAM_UNAVAILABLE",503);}
}

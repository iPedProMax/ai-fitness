import {createClient} from "@/lib/supabase/server";
import {manilaDateKey} from "@/lib/fitness-goals";
import {WaterWidget} from "@/components/water-widget";
export async function WaterSummary(){
  try{const db=await createClient();const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return null;
    const{data,error}=await db.from("water_entries").select("amount_ml").eq("user_id",user.id).eq("logged_on",manilaDateKey()).limit(50);
    if(error)return <WaterWidget total={null} available={false}/>;
    return <WaterWidget total={(data??[]).reduce((sum,i)=>sum+Number(i.amount_ml||0),0)} available={true}/>;
  }catch{return <WaterWidget total={null} available={false}/>;}
}

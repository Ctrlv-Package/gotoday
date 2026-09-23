import {NextResponse} from "next/server";
import {db} from "../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const r=await db.query("select current_database() as database, now() as server_time, (select count(*)::int from sources) as sources, (select count(*)::int from events) as events");
    return NextResponse.json({ok:true,...r.rows[0]});
  }catch(e){
    console.error("DB health check failed",e);
    return NextResponse.json({ok:false,error:"Database connection failed"},{status:500});
  }
}

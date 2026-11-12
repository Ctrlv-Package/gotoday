import {NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {aiPostsCap,capReached,summarizeReaderByDay,summarizeReaderRows} from "../../../lib/readerCounts";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const r=await db.query("select current_database() as database, now() as server_time, (select count(*)::int from sources) as sources, (select count(*)::int from events) as events");
    const out:any={ok:true,...r.rows[0]};
    // Which model read each Instagram post, today and the last 14 days. Rows read before the
    // reader column existed count as "unknown"; if the column itself isn't there yet (the schema
    // change hasn't run), fall back to totals so the page still answers.
    const todayStart="date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'";
    try{
      const t=await db.query(`select coalesce(reader,'unknown') as reader,count(*)::int as n from social_posts where created_at>=${todayStart} group by 1`);
      out.aiPostsToday=summarizeReaderRows(t.rows);
      const d=await db.query(`select to_char(created_at at time zone 'America/New_York','MM-DD') as day,coalesce(reader,'unknown') as reader,count(*)::int as n from social_posts where created_at>now()-interval '14 days' group by 1,2 order by 1,2`);
      out.aiPostsByDay=summarizeReaderByDay(d.rows);
    }catch{
      const t=await db.query(`select count(*)::int as n from social_posts where created_at>=${todayStart}`);
      out.aiPostsToday={gemini:0,claude:0,unknown:Number(t.rows[0]?.n)||0};
      const d=await db.query(`select to_char(created_at at time zone 'America/New_York','MM-DD') as day,count(*)::int as n from social_posts where created_at>now()-interval '14 days' group by 1 order by 1`);
      out.aiPostsByDay=d.rows.map((x:any)=>({day:x.day,gemini:0,claude:0,unknown:Number(x.n)||0}));
    }
    out.aiCap=aiPostsCap();
    out.paidCapReached=capReached(out.aiPostsToday.claude,out.aiCap);
    return NextResponse.json(out);
  }catch(e){
    console.error("DB health check failed",e);
    return NextResponse.json({ok:false,error:"Database connection failed"},{status:500});
  }
}

// POST /api/admin/cardfix {id:"db-123", url?, registrationUrl?, registrationText?} (Bearer INGESTION_SECRET):
// set a card's real event page and registration notice by hand when its source doesn't publish them. Kept in
// card_fixes and re-applied after every reading of that source. GET lists the fixes.
import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {ensureCardFixes,applyCardFixes} from "../../../../lib/ingestion/persist";
const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return !!s&&req.headers.get("authorization")===`Bearer ${s}`};
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 await ensureCardFixes();
 return NextResponse.json({ok:true,fixes:(await db.query("select f.*,s.name as source from card_fixes f join sources s on s.id=f.source_id order by updated_at desc limit 200")).rows});
}
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const b:any=await req.json().catch(()=>({}));const id=Number(String(b?.id||"").replace(/^db-/,""));
 if(!id)return NextResponse.json({ok:false,error:"id required"},{status:400});
 const ok=(u:any)=>typeof u==="string"&&/^https?:\/\//.test(u)?u:null;
 await ensureCardFixes();
 const ev=(await db.query("select source_id,title,local_date from events where id=$1",[id])).rows[0];
 if(!ev)return NextResponse.json({ok:false,error:"no such event"},{status:404});
 // all=true: every date of this event from this source (a weekly program), not only this one.
 const dates=b?.all?(await db.query("select distinct local_date from events where source_id=$1 and title=$2",[ev.source_id,ev.title])).rows.map((r:any)=>r.local_date):[ev.local_date];
 for(const d of dates)await db.query(`insert into card_fixes(source_id,title,local_date,official_url,registration_url,registration_text) values($1,$2,$3,$4,$5,$6)
  on conflict(source_id,title,local_date) do update set official_url=excluded.official_url,registration_url=excluded.registration_url,registration_text=excluded.registration_text,updated_at=now()`,
  [ev.source_id,ev.title,d,ok(b.url),ok(b.registrationUrl),typeof b.registrationText==="string"&&b.registrationText.trim()?b.registrationText.trim().slice(0,200):null]);
 const changed=await applyCardFixes(ev.source_id);
 return NextResponse.json({ok:true,event:ev.title,dates:dates.length,changed});
}

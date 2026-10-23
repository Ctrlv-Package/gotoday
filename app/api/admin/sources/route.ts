import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {loadSourceConfigs} from "../../../../lib/ingestion/registry";
import {PLATFORMS,buildFetcher} from "../../../../lib/ingestion/platforms";
export const dynamic="force-dynamic";
export const maxDuration=120;

const authed=(req:NextRequest)=>{const s=process.env.INGESTION_SECRET;return!!s&&req.headers.get("authorization")===`Bearer ${s}`};

// GET  /api/admin/sources            -> every source config + its last run status, and the platform catalog
// GET  /api/admin/sources?remote=1   -> enabled remote-only sources (used by the GitHub job)
export async function GET(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const configs=await loadSourceConfigs();
 if(req.nextUrl.searchParams.get("remote")==="1"){
  const remote=configs.filter(c=>c.enabled!==false&&c.remote);
  // Instagram accounts share one hourly Meta budget: offer the stalest accounts first, so when the budget
  // runs out mid-run it's the recently-updated accounts that wait — not the same tail of the list every time.
  try{const {rows}=await db.query("select name,last_success_at from sources");
   const succ=new Map(rows.map((r:any)=>[r.name,r.last_success_at?new Date(r.last_success_at).getTime():0]));
   const slots=remote.map((c,i)=>c.platform==="instagram"?i:-1).filter(i=>i>=0);
   const igs=slots.map(i=>remote[i]).sort((a,b)=>(succ.get(a.name)??0)-(succ.get(b.name)??0));
   slots.forEach((slot,j)=>{remote[slot]=igs[j]});
  }catch{}
  return NextResponse.json({ok:true,sources:remote});
 }
 const names=req.nextUrl.searchParams.get("names");
 if(names){const want=new Set(names.split("|"));return NextResponse.json({ok:true,sources:configs.filter(c=>want.has(c.name))})}
 const {rows}=await db.query(`select s.name,s.last_success_at,s.last_error_at,s.last_error,count(e.id) filter (where e.status='active')::int as active_events
  from sources s left join events e on e.source_id=s.id group by s.id`);
 const status=new Map(rows.map((r:any)=>[r.name,r]));
 // Each source's most recent run (success / error / skipped), so the status page can show a rate-limit
 // deferral as its own state instead of the source silently going "Late".
 const lastRuns=(await db.query(`select distinct on (ir.source_id) s.name as name,ir.status as run_status,coalesce(ir.finished_at,ir.started_at) as run_at from ingestion_runs ir join sources s on s.id=ir.source_id order by ir.source_id,ir.id desc`).catch(()=>({rows:[]}))).rows;
 for(const r of lastRuns){const st=status.get(r.name);if(st){st.last_run_status=r.run_status;st.last_run_at=r.run_at}}
 const lastRun=(await db.query("select * from ingest_log where trigger<>'github' order by id desc limit 1").catch(()=>({rows:[]}))).rows[0]||null;
 const details=(await db.query(`select count(*) filter (where key<>'__error')::int as tried,count(*) filter (where (data->>'found')='true')::int as found,
   max(case when key='__error' then data->>'msg' end) as error from event_details`).catch(()=>({rows:[]}))).rows[0]||null;
 const lastGithub=(await db.query("select * from ingest_log where trigger='github' order by id desc limit 1").catch(()=>({rows:[]}))).rows[0]||null;
 // Latest quality check of what visitors see (duplicates, borrowed photos, wrong labels…), saved by the GitHub job.
 const quality=(await db.query("select checked_at,cards,summary,examples from quality_audits order by id desc limit 1").catch(()=>({rows:[]}))).rows[0]||null;
 return NextResponse.json({ok:true,lastRun,lastGithub,details,quality,sources:configs.map(c=>({...c,status:status.get(c.name)||null})),platforms:Object.fromEntries(Object.entries(PLATFORMS).map(([k,v])=>[k,{describe:v.describe,params:v.params}]))});
}

// POST /api/admin/sources  {name, platform, params, url?, region?, timezone?, remote?, enabled?, priority?, source_type?, test?}
// Adds or updates a source. With "test": true it fetches the next 14 days first and refuses to save if it fails.
export async function POST(req:NextRequest){
 if(!authed(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({ok:false,error:"Invalid JSON"},{status:400})}
 if(!b?.name||!b?.platform)return NextResponse.json({ok:false,error:"name and platform are required"},{status:400});
 if(!PLATFORMS[b.platform])return NextResponse.json({ok:false,error:`Unknown platform. Use one of: ${Object.keys(PLATFORMS).join(", ")}`},{status:400});
 let sample:any=null;
 if(b.test){
  try{
   const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()+14);
   const evs=await buildFetcher(b.platform,b.params||{},{name:b.name})(now.toISOString().slice(0,10),end.toISOString().slice(0,10));
   sample={count:evs.length,first:evs.slice(0,5).map(e=>({title:e.title,date:e.date,time:e.time,venue:e.venue,city:e.city,url:e.url}))};
  }catch(e:any){return NextResponse.json({ok:false,error:`Test fetch failed: ${e?.message||e}`},{status:422})}
 }
 await loadSourceConfigs();
 await db.query(`insert into source_configs(name,platform,params,source_type,url,priority,region,timezone,enabled,remote,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
  on conflict(name) do update set platform=excluded.platform,params=excluded.params,source_type=excluded.source_type,url=excluded.url,priority=excluded.priority,region=excluded.region,timezone=excluded.timezone,enabled=excluded.enabled,remote=excluded.remote,updated_at=now()`,
  [b.name,b.platform,JSON.stringify(b.params||{}),b.source_type||"official-city",b.url||null,b.priority??90,b.region||null,b.timezone||"America/New_York",b.enabled!==false,!!b.remote]);
 return NextResponse.json({ok:true,saved:b.name,sample});
}

import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {townCenter,venueCoords,cityCoords,setLookupLimit} from "../../../../lib/ingestion/geocode";
export const dynamic="force-dynamic";
export const maxDuration=300;
// POST /api/admin/regeo?step=towns|venues (Bearer INGESTION_SECRET): repair map points saved before towns had real
// centers and named places were looked up. towns: each town's center from OpenStreetMap; events still sitting on the old
// (ZIP-average) center move to the real one. venues: upcoming events at a named place that still sit on their town's
// center get the place's own point. A batch per call; call again until "left" is 0.
export async function POST(req:NextRequest){
 const s=process.env.INGESTION_SECRET;
 if(!s||req.headers.get("authorization")!==`Bearer ${s}`)return NextResponse.json({ok:false},{status:401});
 const step=req.nextUrl.searchParams.get("step"),started=Date.now(),out:string[]=[];let moved=0;
 // step=igtowns: Instagram events saved with a clipped town ("West, FL" for Weston) get the town their post named,
 // and a map point in that town.
 if(step==="igtowns"){
  const {rows}=await db.query(`select e.id,e.title,e.local_date::text d,e.city,e.official_url,v.name venue,c.params from events e join sources s on s.id=e.source_id join source_configs c on c.name=s.name left join venues v on v.id=e.venue_id
   where c.platform='instagram' and e.local_date>=current_date and e.updated_at>'2026-10-27T17:00:00Z' and e.id>$1 order by e.id limit 2000`,[Number(req.nextUrl.searchParams.get("after"))||0]);
  const urls=[...new Set(rows.map((r:any)=>r.official_url).filter(Boolean))];
  const posts=new Map((await db.query("select permalink,extracted from social_posts where permalink=any($1)",[urls])).rows.map((r:any)=>[r.permalink,r.extracted]));
  let fixed=0;
  for(const r of rows){
   if(Date.now()-started>240e3)break;
   const ex:any[]=Array.isArray(posts.get(r.official_url))?posts.get(r.official_url):[];
   const hit=ex.find(x=>x?.date===r.d&&x?.town)||ex.find(x=>x?.town);
   const st=String(r.params?.city||"").split(",")[1]?.trim()||"FL";
   const town=String(hit?.town||"").trim().replace(/(?:,\s*|\s+)(?:AL|CT|DC|DE|FL|GA|MA|MD|ME|NC|NH|NJ|NY|PA|RI|SC|VA|VT|WV)$/,"").replace(/,?\s+(?:Florida|New Jersey|New York|Georgia|Virginia|Maryland|Pennsylvania|Connecticut|Massachusetts|North Carolina|South Carolina)$/i,"").trim();
   const city=town&&/^[A-Za-z .'-]{3,40}$/.test(town)?`${town}, ${st}`:String(r.params?.city||r.city);
   if(!city||city===r.city)continue;
   const pt=(r.venue?await venueCoords(r.venue,city).catch(()=>null):null)||await cityCoords(city).catch(()=>null);
   await db.query("update events set city=$2,latitude=coalesce($3,latitude),longitude=coalesce($4,longitude) where id=$1",[r.id,city,pt?.latitude??null,pt?.longitude??null]);
   fixed++;out.push(`${r.city} → ${city}`);
  }
  return NextResponse.json({ok:true,checked:rows.length,fixed,last:rows.length?rows[rows.length-1].id:null,examples:out.slice(0,25)});
 }
 if(step==="towns"){
  await db.query("alter table places add column if not exists method text").catch(()=>{});
  if(req.nextUrl.searchParams.get("redo")){await db.query("update places set method=null where key not like 'venue:%'");await db.query("delete from places where key like 'venue:%'")}
  const {rows}=await db.query("select key,latitude,longitude from places where key not like 'venue:%' and coalesce(method,'')<>'osm2' order by key limit 150");
  for(const r of rows){
   if(Date.now()-started>240e3)break;
   const c=await townCenter(r.key);
   await db.query("update places set latitude=coalesce($2,latitude),longitude=coalesce($3,longitude),method='osm2',updated_at=now() where key=$1",[r.key,c?.latitude??null,c?.longitude??null]);
   if(c&&r.latitude!=null){
    const shift=Math.hypot((c.latitude-r.latitude)*69,(c.longitude-r.longitude)*69*Math.cos(c.latitude*Math.PI/180));
    if(shift>0.3){
     const u=await db.query("update events set latitude=$1,longitude=$2 where latitude=$3 and longitude=$4 and lower(regexp_replace(btrim(coalesce(city,'')),'\\s+',' ','g'))=$5",[c.latitude,c.longitude,r.latitude,r.longitude,r.key]);
     await db.query("update venues set latitude=$1,longitude=$2 where latitude=$3 and longitude=$4",[c.latitude,c.longitude,r.latitude,r.longitude]);
     moved+=u.rowCount||0;out.push(`${r.key}: ${shift.toFixed(1)} mi, ${u.rowCount} events`);
    }
   }
  }
  const left=(await db.query("select count(*)::int n from places where key not like 'venue:%' and coalesce(method,'')<>'osm2'")).rows[0].n;
  return NextResponse.json({ok:true,step,moved,left,changed:out.slice(0,60)});
 }
 if(step==="venues"){
  setLookupLimit(1000);
  // Upcoming events at a named place (no street address) whose point is exactly their town's center.
  const {rows}=await db.query(`select v.id as venue_id,v.name,e.city,min(e.latitude) as lat,min(e.longitude) as lng
   from events e join venues v on v.id=e.venue_id join places p on p.key=lower(regexp_replace(btrim(coalesce(e.city,'')),'\\s+',' ','g'))
   where e.status='active' and e.local_date>=current_date and e.latitude=p.latitude and e.longitude=p.longitude and (v.address is null or v.address !~ '\\d')
     and not exists(select 1 from places q where q.key='venue:'||lower(v.name)||'|'||lower(e.city))
   group by v.id,v.name,e.city order by count(*) desc limit 200`);
  let tried=0;
  for(const r of rows){
   if(Date.now()-started>240e3)break;tried++;
   const p=await venueCoords(r.name,r.city);if(!p)continue;
   const u=await db.query("update events set latitude=$1,longitude=$2 where venue_id=$3 and latitude=$4 and longitude=$5",[p.latitude,p.longitude,r.venue_id,r.lat,r.lng]);
   await db.query("update venues set latitude=$1,longitude=$2 where id=$3",[p.latitude,p.longitude,r.venue_id]);
   moved+=u.rowCount||0;out.push(`${r.name} (${r.city}) → ${u.rowCount} events`);
  }
  return NextResponse.json({ok:true,step,tried,moved,left:Math.max(0,rows.length-tried),found:out.slice(0,80)});
 }
 return NextResponse.json({ok:false,error:"step=towns or step=venues"});
}

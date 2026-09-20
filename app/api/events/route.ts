import { NextRequest, NextResponse } from "next/server";

function dedupeKey(title:string,venue:string,date:string){return [title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim(),venue.toLowerCase().trim(),date].join("|")}

function windowDates(range:string){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(new Date());
 const get=(t:string)=>parts.find(p=>p.type===t)?.value||"";
 const today=`${get("year")}-${get("month")}-${get("day")}`;
 const base=new Date(today+"T12:00:00Z");
 const ymd=(d:Date)=>d.toISOString().slice(0,10);
 let s=new Date(base),e=new Date(base);
 if(range==="tomorrow"){s.setUTCDate(s.getUTCDate()+1);e=new Date(s)}
 if(range==="weekend"){
   const day=base.getUTCDay();
   if(day===0){s=new Date(base);e=new Date(base)}
   else if(day===6){s=new Date(base);e=new Date(base);e.setUTCDate(e.getUTCDate()+1)}
   else {const toSat=6-day;s=new Date(base);s.setUTCDate(s.getUTCDate()+toSat);e=new Date(s);e.setUTCDate(e.getUTCDate()+1)}
 }
 return{startDate:ymd(s),endDate:ymd(e)};
}

const localEvents=[
 {id:"ppines-hispanic-heritage-2026",title:"Hispanic Heritage Festival",city:"Pembroke Pines, FL",venue:"Charles F. Dodge City Center",date:"2026-09-26",time:"17:00:00",url:"https://www.ppines.com/1755/Hispanic-Heritage-Festival",category:"Family",genre:"Festival",desc:"Free city festival with live entertainment, food, art and activities for all ages.",tags:["Family","Free","Festival"],emoji:"🎉",source:"Local"},
 {id:"ppines-summer-symphony-2026",title:"Summer Symphony Series",city:"Pembroke Pines, FL",venue:"River of Grass ArtsPark",date:"2026-09-27",time:"16:00:00",url:"https://www.ppines.com/Calendar.aspx",category:"Music",genre:"Live Music",desc:"Final afternoon of the season with live orchestral music.",tags:["Music","Family","Local"],emoji:"🎻",source:"Local"}
];

export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,postalCode=p.get("postalCode")||"33326",radius=p.get("radius")||"25",range=p.get("range")||"today",lat=p.get("lat"),lng=p.get("lng"),w=windowDates(range);
 const locals=localEvents.filter(e=>e.date>=w.startDate&&e.date<=w.endDate);
 let tm:any[]=[];const configured=Boolean(process.env.TICKETMASTER_API_KEY);
 if(configured){
  const url=new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey",process.env.TICKETMASTER_API_KEY!);url.searchParams.set("countryCode","US");
  url.searchParams.set("localStartEndDateTime",`${w.startDate}T00:00:00,${w.endDate}T23:59:59`);
  url.searchParams.set("size","100");url.searchParams.set("sort","date,asc");
  if(lat&&lng){url.searchParams.set("latlong",`${lat},${lng}`);url.searchParams.set("radius",radius);url.searchParams.set("unit","miles")}
  else if(/^33\d{3}$/.test(postalCode)){url.searchParams.set("marketId","15")}
  else{url.searchParams.set("postalCode",postalCode);url.searchParams.set("radius",radius);url.searchParams.set("unit","miles")}
  try{
   const r=await fetch(url.toString(),{cache:"no-store"});
   if(r.ok){const d=await r.json();tm=(d?._embedded?.events||[]).map((event:any)=>{const v=event?._embedded?.venues?.[0],c=event.classifications?.[0],price=event.priceRanges?.[0],image=[...(event.images||[])].sort((a:any,b:any)=>(b.width||0)-(a.width||0))[0]?.url;return{id:event.id,title:event.name,city:[v?.city?.name,v?.state?.stateCode].filter(Boolean).join(", "),venue:v?.name||"",date:event.dates?.start?.localDate||"",time:event.dates?.start?.localTime||"",image:image||"",url:event.url||"",category:c?.segment?.name||"Event",genre:c?.genre?.name||"",minPrice:price?.min??null,source:"Ticketmaster"}})}
  }catch{}
 }
 // Ticketmaster can occasionally return dates outside the requested window; enforce it ourselves.
 tm=tm.filter((e:any)=>e.date>=w.startDate&&e.date<=w.endDate);
 const seen=new Set<string>();
 const events=[...locals,...tm].filter((e:any)=>{const k=dedupeKey(e.title,e.venue,e.date);if(seen.has(k))return false;seen.add(k);return true}).slice(0,40);
 return NextResponse.json({events,configured,range,startDate:w.startDate,endDate:w.endDate,localCount:locals.length,ticketmasterCount:tm.length});
}

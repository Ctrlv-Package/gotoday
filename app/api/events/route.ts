import { NextRequest, NextResponse } from "next/server";

function dedupeKey(title:string,venue:string,date:string){return [title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim(),venue.toLowerCase().trim(),date].join("|")}
function windowDates(range:string){const now=new Date();const local=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));const ymd=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;const s=new Date(local),e=new Date(local);if(range==="tomorrow"){s.setDate(s.getDate()+1);e.setDate(e.getDate()+1)}if(range==="weekend"){const n=(6-s.getDay()+7)%7;s.setDate(s.getDate()+n);e.setTime(s.getTime());e.setDate(e.getDate()+1)}return{startDate:ymd(s),endDate:ymd(e),start:ymd(s)+"T00:00:00Z",end:ymd(e)+"T23:59:59Z"}}

const localEvents=[
 {id:"ppines-hispanic-heritage-2026",title:"Hispanic Heritage Festival",city:"Pembroke Pines, FL",venue:"Charles F. Dodge City Center",date:"2026-09-26",time:"17:00:00",url:"https://www.ppines.com/325/Special-Events",category:"Family",genre:"Festival",desc:"City of Pembroke Pines Hispanic Heritage Festival.",tags:["Family","Free","Local"],emoji:"🎉",source:"Local"},
 {id:"ppines-bow-wow-ween-2026",title:"Bow Wow Ween",city:"Pembroke Pines, FL",venue:"Pembroke Pines",date:"2026-10-03",time:"09:00:00",url:"https://www.ppines.com/325/Special-Events",category:"Family",genre:"Community",desc:"Halloween costume event for dogs hosted by the City of Pembroke Pines.",tags:["Family","Free","Local"],emoji:"🐶",source:"Local"},
 {id:"ppines-storybook-2026",title:"Storybook Festival",city:"Pembroke Pines, FL",venue:"Pembroke Pines",date:"2026-11-14",url:"https://www.ppines.com/325/Special-Events",category:"Family",genre:"Kids",desc:"Annual Storybook Festival from the City of Pembroke Pines.",tags:["Kids","Family","Local"],emoji:"📚",source:"Local"},
 {id:"ppines-artisan-market-2026",title:"Pembroke Pines Artisan Market",city:"Pembroke Pines, FL",venue:"Pembroke Pines",date:"2026-11-21",url:"https://www.ppines.com/325/Special-Events",category:"Family",genre:"Market",desc:"Local artisan market hosted by the City of Pembroke Pines.",tags:["Family","Local"],emoji:"🛍️",source:"Local"}
];

export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams, postalCode=p.get("postalCode")||"33326",radius=p.get("radius")||"25",range=p.get("range")||"today",source=p.get("source")||"all",lat=p.get("lat"),lng=p.get("lng");
 const w=windowDates(range);
 const locals=localEvents.filter(e=>e.date>=w.startDate&&e.date<=w.endDate);
 let tm:any[]=[]; let configured=Boolean(process.env.TICKETMASTER_API_KEY);
 if(source!=="local"&&configured){
  const url=new URL("https://app.ticketmaster.com/discovery/v2/events.json");url.searchParams.set("apikey",process.env.TICKETMASTER_API_KEY!);url.searchParams.set("countryCode","US");url.searchParams.set("startDateTime",w.start);url.searchParams.set("endDateTime",w.end);url.searchParams.set("size","100");url.searchParams.set("sort","date,asc");
  if(lat&&lng){url.searchParams.set("latlong",`${lat},${lng}`);url.searchParams.set("radius",radius);url.searchParams.set("unit","miles")}else if(/^33\d{3}$/.test(postalCode)){url.searchParams.set("marketId","15")}else{url.searchParams.set("postalCode",postalCode)}
  try{const r=await fetch(url.toString(),{cache:"no-store"});if(r.ok){const d=await r.json();const raw=d?._embedded?.events||[];tm=raw.map((event:any)=>{const v=event?._embedded?.venues?.[0],c=event.classifications?.[0],price=event.priceRanges?.[0],image=[...(event.images||[])].sort((a:any,b:any)=>(b.width||0)-(a.width||0))[0]?.url;return{id:event.id,title:event.name,city:[v?.city?.name,v?.state?.stateCode].filter(Boolean).join(", "),venue:v?.name||"",date:event.dates?.start?.localDate||"",time:event.dates?.start?.localTime||"",image:image||"",url:event.url||"",category:c?.segment?.name||"Event",genre:c?.genre?.name||"",minPrice:price?.min??null,source:"Ticketmaster"}})}}catch{}
 }
 let combined=source==="local"?locals:source==="ticketmaster"?tm:[...locals,...tm];
 const seen=new Set<string>();combined=combined.filter((e:any)=>{const k=dedupeKey(e.title,e.venue,e.date);if(seen.has(k))return false;seen.add(k);return true}).slice(0,40);
 return NextResponse.json({events:combined,configured,range,source,localCount:locals.length,ticketmasterCount:tm.length});
}

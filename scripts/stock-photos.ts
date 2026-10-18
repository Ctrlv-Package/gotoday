// GitHub job: fill the stock photo library. The site picks the photos (it holds the Pixabay key); this job downloads
// them at a gentle pace (Pixabay's image server turns away fast or datacenter-heavy traffic) and hands each to the site.
const base=process.env.SITE_URL||"https://www.mygotoday.com",secret=process.env.INGESTION_SECRET||"";
const H={authorization:`Bearer ${secret}`};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const plan:any=await fetch(`${base}/api/admin/stock?plan=1`,{headers:H}).then(r=>r.json());
 if(!plan.ok){console.log("plan failed:",plan.error);process.exit(1)}
 console.log(`${plan.items.length} photos to fetch`);
 let ok=0,fail=0;
 for(const it of plan.items){
  let buf:Buffer|null=null;
  for(const [i,u] of [it.url,it.alt].entries()){
   for(let attempt=0;attempt<3&&!buf;attempt++){
    await sleep(attempt?10000:1200);
    const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36","referer":"https://pixabay.com/"}}).catch(()=>null);
    if(r?.ok){buf=Buffer.from(await r.arrayBuffer());break}
    console.log(`  ${it.topic} ${it.id} ${i?"alt":"main"}: HTTP ${r?.status||"error"}`);
    if(r&&r.status!==429)break;
   }
   if(buf)break;
  }
  if(!buf){fail++;continue}
  const d:any=await fetch(`${base}/api/admin/stock?put=${encodeURIComponent(it.topic)}&id=${it.id}`,{method:"POST",headers:{...H,"content-type":"application/octet-stream"},body:new Uint8Array(buf)}).then(r=>r.json()).catch(()=>({}));
  d.ok?ok++:fail++;
 }
 console.log(`saved ${ok}, failed ${fail}`);
}
main();

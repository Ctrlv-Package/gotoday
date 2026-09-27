// fetch with a couple of retries for transient failures (connection resets, timeouts, 429/5xx),
// and error messages that say what actually went wrong instead of just "fetch failed".
export async function fetchRetry(url:string,init:RequestInit={},tries=3):Promise<Response>{
 let last:unknown;
 for(let i=0;i<tries;i++){
  try{
   const r=await fetch(url,{...init,signal:AbortSignal.timeout(20000)});
   if((r.status===429||r.status>=500)&&i<tries-1){await sleep(1500*(i+1));continue}
   return r;
  }catch(e){last=e;if(i<tries-1)await sleep(1500*(i+1))}
 }
 const e:any=last,cause=e?.cause?.code||e?.cause?.message||e?.name||"";
 throw new Error(`Network error fetching ${new URL(url).host}${cause?` (${cause})`:""}`);
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

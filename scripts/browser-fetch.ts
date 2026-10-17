// Replaces global fetch with a real (headless) Chrome, so sites whose firewalls reject Node's HTTP client see an
// ordinary browser. Calls to GoToday itself (they carry our password header) still use the normal fetch.
import {chromium,type Browser,type BrowserContext} from "playwright";

const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
let browser:Browser|null=null,ctx:BrowserContext|null=null;

export async function installBrowserFetch(){
 const exe=process.env.CHROMIUM_PATH;
 browser=await chromium.launch({...(exe?{executablePath:exe}:{channel:"chromium"}),headless:true,args:["--disable-blink-features=AutomationControlled"]});
 ctx=await browser.newContext({userAgent:UA,locale:"en-US",timezoneId:"America/New_York",viewport:{width:1366,height:900}});
 await ctx.addInitScript(()=>{Object.defineProperty(navigator,"webdriver",{get:()=>undefined})});
 const nodeFetch=globalThis.fetch;
 globalThis.fetch=(async(input:any,init?:any)=>{
  const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
  const method=(init?.method||"GET").toUpperCase();
  // Calls that carry credentials (our own GoToday API) go direct: a page load can't send an Authorization header.
  const hasAuth=!!new Headers(init?.headers||{}).get("authorization");
  if(hasAuth||!/^https?:/.test(url))return nodeFetch(input,init);
  // Data requests other than GET (broward.org's calendar is a POST) are sent from inside the site's own page, so they
  // carry the browser's cookies and fingerprint like a visitor's would.
  if(method!=="GET"){
   const page=await ctx!.newPage();
   try{
    const h=new Headers(init?.headers||{}),referer=h.get("referer")||new URL(url).origin+"/";
    await page.goto(referer,{waitUntil:"domcontentloaded",timeout:45000}).catch(()=>{});
    await page.waitForLoadState("networkidle",{timeout:10000}).catch(()=>{});
    const headers:Record<string,string>={};h.forEach((v,k)=>{if(!/^(user-agent|referer|cookie|host|content-length)$/i.test(k))headers[k]=v});
    const out=await page.evaluate(async({url,method,headers,body})=>{const r=await fetch(url,{method,headers,body,credentials:"include"});return{status:r.status,type:r.headers.get("content-type")||"",text:await r.text()}},{url,method,headers,body:typeof init?.body==="string"?init.body:undefined});
    if(out.status>=400)console.log(`   browser ${method} ${out.status} ${url}`);
    return new Response(out.text,{status:out.status,headers:{"content-type":out.type||"application/json"}});
   }finally{await page.close()}
  }
  const page=await ctx!.newPage();
  try{
   let resp=await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
   let status=resp?.status()??0,final=resp;
   // Bot-check interstitials ("Just a moment…") resolve themselves in a real browser; give it time.
   if(status===403||status===429||status===503){
    await page.waitForLoadState("networkidle",{timeout:15000}).catch(()=>{});
    const again=await page.waitForResponse(r=>r.url().split("#")[0]===url.split("#")[0]&&r.status()<400,{timeout:12000}).catch(()=>null);
    if(again){status=again.status();final=again}
   }
   // Still refused: pause like a person would, then reload once.
   if(status===403||status===429){
    await page.waitForTimeout(6000+Math.random()*4000);
    resp=await page.reload({waitUntil:"domcontentloaded",timeout:45000}).catch(()=>resp);
    status=resp?.status()??status;final=resp;
   }
   // Raw response body (JSON feeds stay JSON); fall back to the rendered DOM.
   const body=(final?await final.text().catch(()=>""):"")||await page.content();
   const type=final?.headers()["content-type"]||"text/html; charset=utf-8";
   const server=resp?.headers()["server"]||"";
   if(status>=400)console.log(`   browser GET ${status} ${url} (server: ${server||"?"}; title: ${(await page.title()).slice(0,80)})`);
   return new Response(body,{status:status||200,headers:{"content-type":type}});
  }finally{await page.close()}
 }) as typeof fetch;
}

/** Start over with a clean browser profile (new cookies/session), e.g. before retrying a site that refused us. */
export async function resetBrowserContext(){
 if(!browser)return;
 await ctx?.close().catch(()=>{});
 ctx=await browser.newContext({userAgent:UA,locale:"en-US",timezoneId:"America/New_York",viewport:{width:1366,height:900}});
 await ctx.addInitScript(()=>{Object.defineProperty(navigator,"webdriver",{get:()=>undefined})});
}

export async function closeBrowserFetch(){await ctx?.close().catch(()=>{});await browser?.close().catch(()=>{})}

// Developer tool: fetch pages with the same headless Chrome the update job uses (sites that block plain requests),
// and save each one to out/N.txt for inspection. Usage: BROWSER_URLS="url1 url2" tsx scripts/browser-get.ts
import {mkdirSync,writeFileSync,appendFileSync} from "fs";
import {installBrowserFetch,closeBrowserFetch} from "./browser-fetch";
const urls=String(process.env.BROWSER_URLS||"").split(/\s+/).filter(Boolean);
mkdirSync("out",{recursive:true});
await installBrowserFetch();
let i=0;
for(const u of urls){i++;
 try{const r=await fetch(u);const t=await r.text();writeFileSync(`out/${i}.txt`,`HTTP ${r.status}\n${t.slice(0,6_000_000)}`)}
 catch(e:any){writeFileSync(`out/${i}.txt`,`ERROR ${e?.message||e}`)}
 appendFileSync("out/index.txt",`${i} ${u}\n`);
}
await closeBrowserFetch();

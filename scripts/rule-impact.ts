// Rule-change impact report: what would a facets/dedup rule change do to live listings?
// Run it BEFORE a rule change and AFTER, then diff the two reports (or --compare them):
//   npx tsx scripts/rule-impact.ts [--live] [--out before.json]
//   npx tsx scripts/rule-impact.ts --compare before.json after.json
// Fixtures are the known edge cases (the Yiddish recital, Halloween Movie Night, the Plantation
// trunk-or-treats); --live adds a sample of real listings through the public /api/events endpoint.
// A rule change that moves fixtures is a regression; one that moves many live listings needs a
// look before it ships, whatever the fixtures say.
import {facetsFor,type Facet} from "../lib/facets";
import {sameEventCard} from "../lib/sameCard";

const BASE=(process.env.GOTODAY_URL||"https://www.mygotoday.com").replace(/\/$/,"");
const args=process.argv.slice(2);
type FacetCase={name:string;input:any;expect?:string[];forbid?:string[]};
const FACETS:FacetCase[]=[
 {name:"Yiddish recital, Everyone tag",input:{title:"Yiddish Songs and Stories",desc:"Enjoy an afternoon of Yiddish songs and stories with a professional singer.",tags:["Everyone","Performances - Dance, Concerts & Theater","Free","Library","Indoor"],source:"Broward County Library",category:"Arts & Theatre",ageMin:0,ageMax:99},forbid:["Family","Kids"]},
 {name:"Halloween Movie Night, Everyone tag",input:{title:"Halloween Movie Night",tags:["Everyone","Library"],source:"Broward County Library",category:"Local"},expect:["Family"]},
 {name:"Bingo for Books, Everyone tag",input:{title:"Bingo for Books",desc:"All ages welcome.",tags:["Everyone"],source:"Broward County Library",category:"Local"},expect:["Family"]},
 {name:"Teen Anime Club",input:{title:"Teen Anime Club",tags:["Teens"],source:"Broward County Library",category:"Local",ageMin:13,ageMax:17},expect:["Kids"]},
 {name:"Coffee @ The Library (teens+adults)",input:{title:"Coffee @ The Library",desc:"Calling all lovers of books and music!",tags:["Teens","New Adults","Adults","Discussion/Lecture"],source:"Broward County Library",category:"Local",ageMin:13,ageMax:99},forbid:["Kids"]},
 {name:"Plantation Trunk or Treat (city)",input:{title:"Trunk or Treat",tags:["Local"],source:"City of Plantation",category:"Local"},expect:["Family"]},
 {name:"Plant Affair (city rule grants Family)",input:{title:"Broward County Plant Affair",tags:["Local"],source:"City of Plantation",category:"Local"},expect:["Family"]},
 {name:"City Commission Meeting (meeting blocks city rule)",input:{title:"City Commission Meeting",tags:["Local"],source:"City of Plantation",category:"Local"},forbid:["Family","Kids"]},
];
type PairCase={name:string;a:any;b:any;expect:boolean};
const PAIRS:PairCase[]=[
 {name:"same event, different wording",a:{title:"Trunk-Or-Treat (RESIDENTS ONLY)",date:"2026-10-24",time:"18:00:00",venue:"City of Plantation",city:"Plantation, FL",source:"City of Plantation"},b:{title:"Villains vs. Superheroes Trunk or Treat",date:"2026-10-24",time:"18:00:00",venue:"Pine Island Park",city:"Plantation, FL",source:"Plantation Parks & Rec · Instagram"},expect:true},
 {name:"one shared word is not enough",a:{title:"Halloween Party",date:"2026-10-24",time:"18:00:00",venue:"City of Plantation",city:"Plantation, FL",source:"City of Plantation"},b:{title:"Halloween Dance",date:"2026-10-24",time:"18:00:00",venue:"Volunteer Park",city:"Plantation, FL",source:"Plantation Parks & Rec · Instagram"},expect:false},
 {name:"same title, different day",a:{title:"Trunk or Treat",date:"2026-10-24",time:"18:00:00",venue:"Pine Island Park",city:"Plantation, FL",source:"City of Plantation"},b:{title:"Trunk or Treat",date:"2026-10-25",time:"18:00:00",venue:"Pine Island Park",city:"Plantation, FL",source:"City of Plantation"},expect:false},
];
async function liveSample(){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date());
 const out:any[]=[];
 for(const [zip,date] of [["33326",today],["33101",today]]){
  const r=await fetch(`${BASE}/api/events?postalCode=${zip}&range=${date}&today=${today}`,{headers:{"user-agent":"gotoday-rule-impact"}});
  if(!r.ok)continue;const d:any=await r.json();
  for(const e of d.events||[])out.push({id:e.id,title:e.title,facets:facetsFor({title:e.title,desc:e.desc,tags:e.tags,source:e.source,category:e.category})});
 }
 return out.slice(0,300);
}
async function build(){
 const facets=FACETS.map(c=>{const got=facetsFor(c.input);
  return{name:c.name,facets:got,pass:(c.expect||[]).every(x=>got.includes(x as Facet))&&(c.forbid||[]).every(x=>!got.includes(x as Facet))}});
 const pairs=PAIRS.map(c=>{const got=sameEventCard(c.a,c.b);return{name:c.name,merged:got,pass:got===c.expect}});
 const live=args.includes("--live")?await liveSample():[];
 const counts:Record<string,number>={};for(const e of live)for(const f of e.facets)counts[f]=(counts[f]||0)+1;
 return{generatedAt:new Date().toISOString(),facets,pairs,liveCounts:counts,live};
}
function compare(a:any,b:any){
 const lines:string[]=[];
 for(const fa of a.facets){const fb=b.facets.find((x:any)=>x.name===fa.name);
  if(!fb||JSON.stringify(fa.facets)!==JSON.stringify(fb.facets))lines.push(`fixture changed: ${fa.name}: ${JSON.stringify(fa.facets)} → ${JSON.stringify(fb?.facets)}`)}
 for(const pa of a.pairs){const pb=b.pairs.find((x:any)=>x.name===pa.name);
  if(!pb||pa.merged!==pb.merged)lines.push(`dedup changed: ${pa.name}: ${pa.merged} → ${pb?.merged}`)}
 const keys=new Set([...Object.keys(a.liveCounts||{}),...Object.keys(b.liveCounts||{})]);
 for(const k of keys){const x=a.liveCounts?.[k]||0,y=b.liveCounts?.[k]||0;if(x!==y)lines.push(`live ${k}: ${x} → ${y}`)}
 const am=new Map<string,any>((a.live||[]).map((e:any)=>[e.id,e])),bm=new Map<string,any>((b.live||[]).map((e:any)=>[e.id,e]));
 for(const [id,ea] of am){const eb=bm.get(id);
  if(eb&&JSON.stringify(ea.facets)!==JSON.stringify(eb.facets))lines.push(`live listing changed: ${ea.title} (${id}): ${JSON.stringify(ea.facets)} → ${JSON.stringify(eb.facets)}`)}
 return lines;
}
async function main(){
 const {readFileSync,writeFileSync}=await import("node:fs");
 if(args.includes("--compare")){
  const [fa,fb]=[args[args.indexOf("--compare")+1],args[args.indexOf("--compare")+2]];
  const lines=compare(JSON.parse(readFileSync(fa,"utf8")),JSON.parse(readFileSync(fb,"utf8")));
  console.log(lines.length?lines.join("\n"):`No changes between ${fa} and ${fb}.`);
  return;
 }
 const rep=await build();
 const failed=[...rep.facets.filter(f=>!f.pass),...rep.pairs.filter(p=>!p.pass)];
 console.log(`Rule impact: ${rep.facets.length} facet fixtures (${rep.facets.filter(f=>f.pass).length} pass), ${rep.pairs.length} dedup fixtures (${rep.pairs.filter(p=>p.pass).length} pass)${rep.live.length?`, ${rep.live.length} live listings`:""}`);
 for(const f of failed)console.log(`  FAIL: ${f.name}`);
 console.log(`  live facet counts: ${JSON.stringify(rep.liveCounts)}`);
 const out=args[args.indexOf("--out")+1];
 if(out){writeFileSync(out,JSON.stringify(rep,null,2));console.log(`Report written to ${out}`)}
 if(failed.length)process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1)});

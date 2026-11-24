// Drift: compare two quality-audit reports (scripts/quality-audit.ts --json output) and flag
// shifts that usually mean a rule broke, not that a town changed. Thresholds are deliberately
// coarse: this is a tripwire for a human to look, not a verdict. Exit code comes from the CLI.
export type SourceStats={events:number;familyNoSignal:number;stock:number;missingImage:number;missingTime:number;failsValidation:number;brokenImage?:number;duplicateImage?:number};
export type PhotoFindings={broken:string[];duplicate:string[]};
export type AuditReport={generatedAt:string;totals:{events:number};perSource:Record<string,SourceStats>;findingsByType:Record<string,number>;photoFindings?:PhotoFindings};
const share=(n:number,d:number)=>d>0?n/d:0;

export function driftAlerts(before:AuditReport,after:AuditReport):string[]{
 const alerts:string[]=[];
 for(const [name,a] of Object.entries(after.perSource)){
  const b=before.perSource[name];
  // A new source is expected (sources get added every week): not an alert.
  if(!b)continue;
  // Only a big source losing most of its events looks like a broken feed; small sources and growth swing day to day
  // (10 → 6 events at a downtown calendar is normal).
  if(b.events>=40){
   const ch=(a.events-b.events)/b.events;
   if(ch<=-0.5)alerts.push(`source volume drop: ${name} ${b.events} → ${a.events} events (${Math.round(ch*100)}%)`);
  }
  const fns=share(a.familyNoSignal,a.events)-share(b.familyNoSignal,b.events);
  // Only a rise is a problem (labels going wrong); a drop means the labels got better.
  if(fns>=0.05&&a.familyNoSignal-b.familyNoSignal>=5)
   alerts.push(`family-no-signal share shift: ${name} ${Math.round(share(b.familyNoSignal,b.events)*100)}% → ${Math.round(share(a.familyNoSignal,a.events)*100)}%`);
  const sts=share(a.stock,a.events)-share(b.stock,b.events);
  // Only a rise is a problem (real pictures going missing); a drop means more cards have their own picture.
  if(sts>=0.1&&a.stock-b.stock>=10)
   alerts.push(`stock-photo share shift: ${name} ${Math.round(share(b.stock,b.events)*100)}% → ${Math.round(share(a.stock,a.events)*100)}%`);
  const mis=share(a.missingImage,a.events)-share(b.missingImage,b.events);
  // Only a rise is a problem (more cards with no photo at all, i.e. emoji tiles); a drop means more cards have pictures.
  if(mis>=0.05&&a.missingImage-b.missingImage>=5)
   alerts.push(`missing-image share shift: ${name} ${Math.round(share(b.missingImage,b.events)*100)}% → ${Math.round(share(a.missingImage,a.events)*100)}%`);
 }
 for(const [name,b] of Object.entries(before.perSource))
  if(!after.perSource[name]&&b.events>=40)alerts.push(`source disappeared: ${name} (had ${b.events} events)`);
 // A dead picture or a photo shared by two different events fails the run only when it is
 // NEW: the finding's identity (event IDs + image key) is not in yesterday's report. A
 // standing finding is still reported by the audit itself, but it does not fail every run
 // until it is fixed — otherwise one stubborn pair fails the daily run forever. A report
 // from before this change carries no identities, so any photo problem in it fails the run
 // as before (one transitional run; the next baseline carries identities).
 const beforePhoto=before.photoFindings,afterPhoto=after.photoFindings;
 if(beforePhoto&&afterPhoto){
  const newBroken=afterPhoto.broken.filter(id=>!beforePhoto.broken.includes(id));
  const newDup=afterPhoto.duplicate.filter(id=>!beforePhoto.duplicate.includes(id));
  if(newBroken.length)alerts.push(`new broken image: ${newBroken.length} listing(s) whose picture 404s`);
  if(newDup.length)alerts.push(`new duplicate image: ${newDup.length} shared photo(s) across different events`);
 }else{
  for(const [name,a] of Object.entries(after.perSource)){
   if((a.brokenImage||0)>0)alerts.push(`broken image: ${name} has ${a.brokenImage} listing(s) whose picture 404s`);
   if((a.duplicateImage||0)>0)alerts.push(`duplicate image: ${name} has ${a.duplicateImage} shared photo(s) across different events`);
  }
 }
 const totCh=before.totals.events>0?(after.totals.events-before.totals.events)/before.totals.events:0;
 if(Math.abs(totCh)>=0.25)alerts.push(`total volume shift: ${before.totals.events} → ${after.totals.events} events (${Math.round(totCh*100)}%)`);
 return alerts;
}

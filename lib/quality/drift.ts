// Drift: compare two quality-audit reports (scripts/quality-audit.ts --json output) and flag
// shifts that usually mean a rule broke, not that a town changed. Thresholds are deliberately
// coarse: this is a tripwire for a human to look, not a verdict. Exit code comes from the CLI.
export type SourceStats={events:number;familyNoSignal:number;stock:number;missingImage:number;missingTime:number;failsValidation:number};
export type AuditReport={generatedAt:string;totals:{events:number};perSource:Record<string,SourceStats>;findingsByType:Record<string,number>};
const share=(n:number,d:number)=>d>0?n/d:0;

export function driftAlerts(before:AuditReport,after:AuditReport):string[]{
 const alerts:string[]=[];
 for(const [name,a] of Object.entries(after.perSource)){
  const b=before.perSource[name];
  if(!b){if(a.events>=5)alerts.push(`new source: ${name} (${a.events} events)`);continue}
  if(b.events>=10){
   const ch=(a.events-b.events)/b.events;
   if(Math.abs(ch)>=0.3)alerts.push(`source volume shift: ${name} ${b.events} → ${a.events} events (${Math.round(ch*100)}%)`);
  }
  const fns=share(a.familyNoSignal,a.events)-share(b.familyNoSignal,b.events);
  if(Math.abs(fns)>=0.05&&Math.abs(a.familyNoSignal-b.familyNoSignal)>=5)
   alerts.push(`family-no-signal share shift: ${name} ${Math.round(share(b.familyNoSignal,b.events)*100)}% → ${Math.round(share(a.familyNoSignal,a.events)*100)}%`);
  const sts=share(a.stock,a.events)-share(b.stock,b.events);
  if(Math.abs(sts)>=0.1&&Math.abs(a.stock-b.stock)>=10)
   alerts.push(`stock-photo share shift: ${name} ${Math.round(share(b.stock,b.events)*100)}% → ${Math.round(share(a.stock,a.events)*100)}%`);
 }
 for(const [name,b] of Object.entries(before.perSource))
  if(!after.perSource[name]&&b.events>=10)alerts.push(`source disappeared: ${name} (had ${b.events} events)`);
 const totCh=before.totals.events>0?(after.totals.events-before.totals.events)/before.totals.events:0;
 if(Math.abs(totCh)>=0.25)alerts.push(`total volume shift: ${before.totals.events} → ${after.totals.events} events (${Math.round(totCh*100)}%)`);
 return alerts;
}

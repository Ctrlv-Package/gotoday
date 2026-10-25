// Drift check: compare two quality-audit reports and fail loudly on shifts that usually mean
// a rule broke. Used by the daily quality workflow (previous report from the quality-results
// branch vs. today's), and by hand:
//   npx tsx scripts/drift-check.ts --before prev.json --after today.json
// Exit 0 = no drift, exit 1 = alerts (the workflow failing is the alert).
import {driftAlerts,type AuditReport} from "../lib/quality/drift";
async function main(){
 const args=process.argv.slice(2);
 const before=args[args.indexOf("--before")+1],after=args[args.indexOf("--after")+1];
 if(!before||!after){console.error("usage: drift-check.ts --before prev.json --after today.json");process.exit(2)}
 const {readFileSync}=await import("node:fs");
 const alerts=driftAlerts(JSON.parse(readFileSync(before,"utf8")) as AuditReport,JSON.parse(readFileSync(after,"utf8")) as AuditReport);
 if(!alerts.length){console.log("No drift.");return}
 console.log(alerts.map(a=>`DRIFT: ${a}`).join("\n"));process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1)});

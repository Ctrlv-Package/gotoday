import { sources,sourcePriority } from "./registry";import { dedupe,normalize } from "./utils";import type { EventRecord } from "./types";
export async function ingestEvents(startDate:string,endDate:string){const settled=await Promise.allSettled(sources.map(async s=>(await s.fetch(startDate,endDate)).map(normalize)));const events:EventRecord[]=settled.flatMap(x=>x.status==="fulfilled"?x.value:[]);return dedupe(events).sort((a,b)=>sourcePriority(b.source)-sourcePriority(a.source)||(a.date+a.time).localeCompare(b.date+b.time));}
export type {EventRecord} from "./types";

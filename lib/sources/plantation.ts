import type {EventRecord} from "../ingestion/types";
import {fetchOpenCities} from "./opencities";

// plantation.org returns 403 to non-browser clients; browser headers are sent by fetchOpenCities.
// If it still 403s from Vercel, the error message in the ingest summary will say so.
export function fetchPlantationEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchOpenCities({
  listUrl:"https://www.plantation.org/government/departments/parks-recreation/events",
  eventPath:"/government/departments/parks-recreation/events",
  source:"City of Plantation",idPrefix:"plantation",city:"Plantation, FL",venue:"City of Plantation",
  block:/\b(board|commission|committee|hearing|workshop|advisory|meeting|budget|planning|zoning|orientation|essay contest)\b/i,
  maxPages:6
 },startDate,endDate);
}

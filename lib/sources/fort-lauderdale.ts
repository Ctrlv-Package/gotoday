import type {EventRecord} from "../ingestion/types";
import {fetchOpenCities} from "./opencities";

// The old strategic-communications list-view URL now 404s; the calendar lives here.
export function fetchFortLauderdaleEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchOpenCities({
  listUrl:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",
  eventPath:"/Explore-FTL/Event-Calendar",
  source:"City of Fort Lauderdale",idPrefix:"ftl",city:"Fort Lauderdale, FL",venue:"Fort Lauderdale",
  block:/\b(board|commission|committee|advisory|meeting|hearing|webinar|king tides|hazardous waste|waste|drop-off|certificate of use|bargaining session|magistrate|development review|code enforcement)\b/i,
  maxPages:8
 },startDate,endDate);
}

import type {EventRecord} from "../ingestion/types";
import {fetchOpenCities} from "./opencities";

// The month-grid URL (/-curm-/-cury-) doesn't include titles in the HTML; use the list page.
export function fetchSunriseEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchOpenCities({
  listUrl:"https://www.sunrisefl.gov/our-city/calendar-of-events",
  eventPath:"/our-city/calendar-of-events",
  source:"City of Sunrise",idPrefix:"sunrise",city:"Sunrise, FL",venue:"City of Sunrise",
  block:/\b(board|commission|committee|hearing|workshop|advisory|meeting|budget|planning|zoning|orientation|essay contest)\b/i,
  maxPages:6
 },startDate,endDate);
}

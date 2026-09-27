import type {EventRecord} from "../ingestion/types";
import {fetchGovAccess} from "./govaccess";

// sunrisefl.gov is Granicus govAccess. Leisure Services "Events" has the public events as tiles;
// the city calendar grid adds anything else (meetings there are rejected by the discovery rules).
export function fetchSunriseEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchGovAccess({site:"https://www.sunrisefl.gov",source:"City of Sunrise",idPrefix:"sunrise",city:"Sunrise, FL",venue:"City of Sunrise",
  tilePages:["/departments-services/leisure-services/events"],calendarPaths:["/our-city/calendar-of-events"]},startDate,endDate);
}

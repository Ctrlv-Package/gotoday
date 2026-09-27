import type {EventRecord} from "../ingestion/types";
import {fetchGovAccess} from "./govaccess";

// plantation.org is Granicus govAccess; Parks & Recreation "Events" lists all upcoming events as tiles.
export function fetchPlantationEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchGovAccess({site:"https://www.plantation.org",source:"City of Plantation",idPrefix:"plantation",city:"Plantation, FL",venue:"City of Plantation",
  tilePages:["/government/departments/parks-recreation/events","/government/departments/parks-recreation/events/-toggle-next30days"]},startDate,endDate);
}

import type {EventRecord} from "../ingestion/types";
import {fetchCommunico} from "./communico";

// Map branch names to their city so distance filtering works (the feed has no addresses).
const BRANCH_CITY:[RegExp,string][]=[
 [/north regional|broward college.*north/i,"Coconut Creek, FL"],[/northwest regional/i,"Coral Springs, FL"],
 [/southwest regional|south regional|pembroke pines/i,"Pembroke Pines, FL"],[/west regional/i,"Plantation, FL"],
 [/main library|african american research|riverland|fort lauderdale|galt ocean|imperial point/i,"Fort Lauderdale, FL"],
 [/nova southeastern|alvin sherman|davie/i,"Davie, FL"],[/miramar/i,"Miramar, FL"],[/weston/i,"Weston, FL"],
 [/sunrise/i,"Sunrise, FL"],[/hollywood/i,"Hollywood, FL"],[/pompano/i,"Pompano Beach, FL"],
 [/hallandale/i,"Hallandale Beach, FL"],[/lauderdale lakes/i,"Lauderdale Lakes, FL"],[/lauderhill/i,"Lauderhill, FL"],
 [/dania/i,"Dania Beach, FL"],[/tamarac/i,"Tamarac, FL"],[/margate/i,"Margate, FL"],[/deerfield/i,"Deerfield Beach, FL"],
 [/coral springs/i,"Coral Springs, FL"],[/coconut creek/i,"Coconut Creek, FL"],[/plantation/i,"Plantation, FL"],
 [/oakland park/i,"Oakland Park, FL"],[/lighthouse point/i,"Lighthouse Point, FL"],[/cooper city/i,"Cooper City, FL"],
 [/pembroke park|west park/i,"West Park, FL"],[/hillsboro|century plaza/i,"Deerfield Beach, FL"],[/north lauderdale/i,"North Lauderdale, FL"],
 [/wilton manors/i,"Wilton Manors, FL"],[/parkland/i,"Parkland, FL"],[/beach branch/i,"Hollywood, FL"]
];
function branchCity(venue:string){for(const [rx,city] of BRANCH_CITY)if(rx.test(venue))return city;return "Broward County, FL"}

export function fetchBrowardLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchCommunico({client:"broward",source:"Broward County Library",idPrefix:"bcl",defaultVenue:"Broward County Library",cityFor:branchCity},startDate,endDate);
}

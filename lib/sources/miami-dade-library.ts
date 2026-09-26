import type {EventRecord} from "../ingestion/types";
import {fetchCommunico} from "./communico";

// Same Communico JSON feed as Broward. Branch names mostly contain the city/neighborhood.
const BRANCH_CITY:[RegExp,string][]=[
 [/north miami beach/i,"North Miami Beach, FL"],[/north miami/i,"North Miami, FL"],[/miami beach|north shore|south shore/i,"Miami Beach, FL"],
 [/coral gables/i,"Coral Gables, FL"],[/hialeah|palm springs/i,"Hialeah, FL"],[/homestead|naranja|redland/i,"Homestead, FL"],
 [/doral/i,"Doral, FL"],[/miami springs/i,"Miami Springs, FL"],[/miami lakes/i,"Miami Lakes, FL"],[/opa-?locka/i,"Opa-locka, FL"],
 [/key biscayne/i,"Key Biscayne, FL"],[/aventura/i,"Aventura, FL"],[/sunny isles/i,"Sunny Isles Beach, FL"],[/pinecrest/i,"Pinecrest, FL"],
 [/cutler bay|south dade/i,"Cutler Bay, FL"],[/miami gardens|california club/i,"Miami Gardens, FL"],[/sweetwater/i,"Sweetwater, FL"],
 [/golden glades/i,"Miami Gardens, FL"],[/west kendall|kendall|westchester|tamiami|fairlawn|west dade|country walk|kendale lakes/i,"Kendall, FL"]
];
function cityFor(venue:string){for(const [rx,c] of BRANCH_CITY)if(rx.test(venue))return c;return "Miami, FL"}

export function fetchMiamiDadeLibraryEvents(startDate:string,endDate:string):Promise<EventRecord[]>{
 return fetchCommunico({client:"mdpls",source:"Miami-Dade Public Library",idPrefix:"mdpl",defaultVenue:"Miami-Dade Public Library",cityFor,siteUrl:"https://mdpls.org"},startDate,endDate);
}

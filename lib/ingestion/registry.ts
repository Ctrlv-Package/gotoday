import type { EventSource } from "./types";
import { fetchSunriseEvents } from "../sources/sunrise";
import { fetchPembrokePinesEvents } from "../sources/pembroke-pines";
import { fetchRiverwalkEvents } from "../sources/riverwalk";
import { fetchBrowardParkEvents } from "../sources/broward-parks";
import { fetchBrowardLibraryEvents } from "../sources/broward-library";
import { fetchPlantationEvents } from "../sources/plantation";
export const sources:EventSource[]=[
{name:"City of Sunrise",type:"official-city",url:"https://www.sunrisefl.gov/our-city/calendar-of-events",priority:100,fetch:fetchSunriseEvents},
{name:"City of Pembroke Pines",type:"official-city",url:"https://www.ppines.com/Calendar.aspx",priority:100,fetch:fetchPembrokePinesEvents},
{name:"Broward County Library",type:"official-county",url:"https://www.broward.org/library/events",priority:98,fetch:fetchBrowardLibraryEvents},
{name:"Broward County Parks",type:"official-county",url:"https://www.broward.org/parks/Events",priority:95,fetch:fetchBrowardParkEvents},
{name:"City of Plantation",type:"official-city",url:"https://www.plantation.org/government/departments/parks-recreation/events",priority:100,fetch:fetchPlantationEvents},
{name:"Riverwalk Fort Lauderdale",type:"local-aggregator",url:"https://www.goriverwalk.com/events/greater-fort-lauderdale-event-calendar",priority:85,fetch:fetchRiverwalkEvents}
];
export const sourcePriority=(name:string)=>sources.find(s=>s.name===name)?.priority??40;

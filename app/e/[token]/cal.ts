import {eventByShare,startOf,endOf} from "../../../lib/community";
import type {CalEvent} from "../../../lib/calendar";
import {rrule} from "../../../lib/repeat";
export async function communityCal(token:string,origin:string):Promise<CalEvent|null>{
 const e=await eventByShare(token);if(!e||e.status!=="live")return null;
 return{uid:`gotoday-c${e.id}`,title:e.title,description:e.description,location:[e.venue,e.address,e.city].filter(Boolean).join(", "),start:startOf(e),end:endOf(e),allDay:e.allDay,tz:e.tz,url:`${origin}/e/${token}`,rrule:rrule(e.date,e.repeat)||undefined};
}

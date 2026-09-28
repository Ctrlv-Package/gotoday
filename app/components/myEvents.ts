// Events this browser created (title + links), so creators can find their manage links again.
export type MyEvent={title:string;date:string;shareUrl:string;manageUrl:string;visibility:string};
const KEY="gotoday:myEvents";
export function myEvents():MyEvent[]{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
export function rememberEvent(e:MyEvent){try{const list=myEvents().filter(x=>x.manageUrl!==e.manageUrl);localStorage.setItem(KEY,JSON.stringify([e,...list].slice(0,50)))}catch{}}
export function forgetEvent(manageUrl:string){try{localStorage.setItem(KEY,JSON.stringify(myEvents().filter(x=>x.manageUrl!==manageUrl)))}catch{}}

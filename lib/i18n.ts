// GoToday in English, Spanish and Russian. Every piece of the site's own text is written in English and looked up here;
// event titles and descriptions stay as the organizer wrote them. Anything missing falls back to English.
import {ES,RU} from "./i18n-dict";

export type Lang="en"|"es"|"ru";
export const LANGS:{code:Lang;name:string;english:string;short:string}[]=[
 {code:"en",name:"English",english:"English",short:"EN"},
 {code:"es",name:"Español",english:"Spanish",short:"ES"},
 {code:"ru",name:"Русский",english:"Russian",short:"RU"},
];
export const LOCALE:Record<Lang,string>={en:"en-US",es:"es-US",ru:"ru-RU"};
export const isLang=(x:unknown):x is Lang=>x==="en"||x==="es"||x==="ru";

const DICT:Record<Lang,Record<string,string>>={en:{},es:ES,ru:RU};
// Phrases with numbers inside them that come from event listings ("5 of 20 spots left").
const PATTERNS:[RegExp,string][]=[[/^(\d+) of (\d+) spots left$/,"{1} of {2} spots left"]];
export function translate(lang:Lang,s:string,v?:Record<string,string|number>){
 const fill=(x:string)=>v?x.replace(/\{(\w+)\}/g,(m,k)=>k in v?String(v[k]):m):x;
 if(lang==="en"||!s)return fill(s.split("|")[0]);
 let out=DICT[lang]?.[s];
 if(out==null)for(const [re,key] of PATTERNS){const m=s.match(re);if(m&&DICT[lang][key]){out=DICT[lang][key].replace(/\{(\d)\}/g,(_,i)=>m[Number(i)]);break}}
 out??=DICT[lang]?.[s.toLowerCase()]??s.split("|")[0];
 return fill(out);
}
/** A server-side t() for one language. */
export const tFor=(lang:Lang)=>(s:string,v?:Record<string,string|number>)=>translate(lang,s,v);

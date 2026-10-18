"use client";
import {createContext,useContext,useState} from "react";
import {useRouter} from "next/navigation";
import {LANGS,LOCALE,translate,type Lang} from "../../lib/i18n";
import Dropdown from "./Dropdown";

const Ctx=createContext<{lang:Lang;set:(l:Lang)=>void}>({lang:"en",set:()=>{}});

export function LangProvider({lang,children}:{lang:Lang;children:React.ReactNode}){
 const [cur,setCur]=useState<Lang>(lang),router=useRouter();
 // Pages drawn on the server (event pages, My GoToday) redraw in the new language once it's saved.
 const set=(l:Lang)=>{
  document.cookie=`gt_lang=${l};path=/;max-age=${60*60*24*400};samesite=lax`;
  document.documentElement.lang=l;setCur(l);
  // Signed in: keep it in the account too (guests get a quiet "not signed in").
  fetch("/api/me/lang",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lang:l})}).catch(()=>{}).finally(()=>router.refresh());
 };
 return <Ctx.Provider value={{lang:cur,set}}>{children}</Ctx.Provider>;
}

/** t("Search") → "Buscar"; t("{n} mi",{n:5}). Also the date locale for the current language. */
export function useT(){
 const {lang,set}=useContext(Ctx);
 return{lang,locale:LOCALE[lang],setLang:set,t:(s:string,v?:Record<string,string|number>)=>translate(lang,s,v)};
}

/** Language menu in the top bar: globe + EN/ES/RU, opening the same menu style as the site's other dropdowns. */
export function LangPicker(){
 const {lang,setLang,t}=useT();
 const cur=LANGS.find(l=>l.code===lang)!;
 return <Dropdown value={lang} align="right" ariaLabel={t("Language")} triggerClass="langBtn"
  trigger={<><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg><span>{cur.short}</span></>}
  options={LANGS.map(l=>({value:l.code,label:l.name,sub:l.english!==l.name?l.english:undefined}))} onChange={v=>setLang(v as Lang)}/>;
}

/** My GoToday: the account's language, as three buttons. */
export function LangSetting(){
 const {lang,setLang}=useT();
 return <div className="seg langSeg" role="radiogroup">{LANGS.map(l=><button key={l.code} type="button" role="radio" aria-checked={lang===l.code} className={lang===l.code?"active":""} onClick={()=>setLang(l.code)}>{l.name}</button>)}</div>;
}

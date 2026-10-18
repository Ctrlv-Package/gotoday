import {cache} from "react";
import {cookies} from "next/headers";
import {isLang,type Lang} from "./i18n";
import {currentUser} from "./auth";

/** The visitor's language. Signed in: the language saved in their account (the same on every device). Otherwise
 *  the one they picked on this device. English by default. */
export const getLang=cache(async():Promise<Lang>=>{
 const jar=await cookies();
 if(jar.get("gt_session")){const u=await currentUser().catch(()=>null);if(isLang(u?.lang))return u!.lang as Lang}
 const c=jar.get("gt_lang")?.value;
 return isLang(c)?c:"en";
});

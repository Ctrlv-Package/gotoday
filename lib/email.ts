// Sending account emails (verification, password reset) through Resend.
// The app sends directly with RESEND_API_KEY; the digest relay (Cloudflare
// Worker) is a separate path for digests only. If the key isn't set, email
// sign-in shows as "being set up" and Google keeps working.
export const emailConfigured=()=>!!process.env.RESEND_API_KEY;
const FROM="GoToday <hello@mygotoday.com>";

export async function sendEmail(to:string,subject:string,html:string):Promise<boolean>{
 const key=process.env.RESEND_API_KEY;if(!key)return false;
 try{
  const r=await fetch("https://api.resend.com/emails",{method:"POST",
   headers:{Authorization:`Bearer ${key}`,"content-type":"application/json"},
   body:JSON.stringify({from:FROM,to,subject,html})});
  return r.ok;
 }catch{return false}
}

const wrap=(title:string,body:string)=>`<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px">${title}</h2>${body}<p style="color:#71717a;font-size:13px;margin-top:24px">GoToday — mygotoday.com</p></body></html>`;

export function verificationEmail(origin:string,token:string){
 const url=`${origin}/api/auth/email/verify?token=${encodeURIComponent(token)}`;
 return{subject:"Verify your GoToday account",
  html:wrap("Verify your GoToday account",`<p>Tap the link below to verify your email and finish creating your GoToday account. The link works for 24 hours.</p><p><a href="${url}">Verify my account</a></p><p style="color:#71717a;font-size:13px">If you didn't create a GoToday account, just ignore this email.</p>`)};
}

export function resetEmail(origin:string,token:string){
 const url=`${origin}/signin?reset=${encodeURIComponent(token)}`;
 return{subject:"Reset your GoToday password",
  html:wrap("Reset your GoToday password",`<p>Tap the link below to choose a new password. The link works for 1 hour.</p><p><a href="${url}">Choose a new password</a></p><p style="color:#71717a;font-size:13px">If you didn't ask for this, just ignore this email — your password stays the same.</p>`)};
}

// A visitor's problem report, mailed to the site contact. The report itself is already saved in the
// admin list before this is sent, so a failed send never loses the report — it just means no email.
export function reportEmail(title:string,link:string|null,reason:string,note:string){
 const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 return{subject:`GoToday report: ${reason} — ${title}`,
  html:wrap("A visitor reported a problem",`<p><b>${esc(title)}</b></p><p>Problem: ${esc(reason)}</p>${note?`<p>Details: ${esc(note)}</p>`:""}${link?`<p><a href="${link}">Open the event</a></p>`:""}<p style="color:#71717a;font-size:13px">Review it in /admin (Reports from visitors) and dismiss it once you've checked. A report never changes the listing by itself.</p>`)};
}

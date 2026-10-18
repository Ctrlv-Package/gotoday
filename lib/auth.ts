// Optional GoToday accounts. Nothing on the site requires one; signing in adds saving across devices, following
// annual events and a personal calendar.
//
// Sign-in: "Continue with Google" (OpenID Connect, authorization code + PKCE). Google checks the person; we only
// receive their name, email and picture (no access to their Google Calendar or anything else).
// Session: a random token in an httpOnly cookie; the database stores only its hash, so a database leak can't be
// used to sign in.
import {createHash,createHmac,randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {db} from "./db";
import {ensureSchema} from "./schema";

export const SESSION_COOKIE="gt_session";
const OAUTH_COOKIE="gt_oauth";
const SESSION_DAYS=180;
export type User={id:number;email:string;name:string|null;image:string|null;calendarToken:string|null;lang?:string|null};

const secret=()=>process.env.AUTH_SECRET||process.env.INGESTION_SECRET||"";
const hashToken=(t:string)=>createHmac("sha256",secret()).update(t).digest("hex");
const b64url=(b:Buffer)=>b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const cookieBase={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};

/** The signed-in person for this request, or null. */
export async function currentUser():Promise<User|null>{
 const tok=(await cookies()).get(SESSION_COOKIE)?.value;
 if(!tok||!/^[A-Za-z0-9_-]{30,}$/.test(tok))return null;
 await ensureSchema();
 const {rows}=await db.query(`select u.id,u.email,u.name,u.image,u.calendar_token,u.lang from sessions s join users u on u.id=s.user_id
  where s.token_hash=$1 and s.expires_at>now()`,[hashToken(tok)]);
 const r=rows[0];if(!r)return null;
 return{id:r.id,email:r.email,name:r.name,image:r.image,calendarToken:r.calendar_token,lang:r.lang};
}

async function startSession(userId:number){
 const tok=b64url(randomBytes(32));
 await db.query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+make_interval(days=>$3))",[hashToken(tok),userId,SESSION_DAYS]);
 await db.query("update users set last_seen_at=now() where id=$1",[userId]);
 (await cookies()).set(SESSION_COOKIE,tok,{...cookieBase,maxAge:SESSION_DAYS*86400});
}

export async function signOut(){
 const jar=await cookies(),tok=jar.get(SESSION_COOKIE)?.value;
 if(tok)await db.query("delete from sessions where token_hash=$1",[hashToken(tok)]).catch(()=>{});
 jar.delete(SESSION_COOKIE);
}

/** Only same-site paths are allowed as the page to return to after signing in. */
export const safeNext=(n:string|null|undefined)=>n&&/^\/(?!\/)[^\s]*$/.test(n)?n:"/me";

// ---------- Google ----------
export const googleConfigured=()=>!!(process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET);
const redirectUri=(origin:string)=>`${origin}/api/auth/callback/google`;

/** Step 1: send the person to Google's sign-in page. */
export async function googleStart(origin:string,next:string){
 const state=b64url(randomBytes(16)),verifier=b64url(randomBytes(32));
 const challenge=b64url(createHash("sha256").update(verifier).digest());
 (await cookies()).set(OAUTH_COOKIE,JSON.stringify({state,verifier,next:safeNext(next)}),{...cookieBase,maxAge:600});
 const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 u.searchParams.set("client_id",process.env.AUTH_GOOGLE_ID!);u.searchParams.set("redirect_uri",redirectUri(origin));
 u.searchParams.set("response_type","code");u.searchParams.set("scope","openid email profile");
 u.searchParams.set("state",state);u.searchParams.set("code_challenge",challenge);u.searchParams.set("code_challenge_method","S256");
 u.searchParams.set("prompt","select_account");
 return u.toString();
}

/** Step 2: Google sends the person back with a one-time code; trade it for their verified identity. */
export async function googleFinish(origin:string,code:string|null,state:string|null):Promise<{next:string}|{error:string}>{
 const jar=await cookies(),raw=jar.get(OAUTH_COOKIE)?.value;jar.delete(OAUTH_COOKIE);
 let saved:{state:string;verifier:string;next:string};
 try{saved=JSON.parse(raw||"")}catch{return{error:"Your sign-in took too long or was opened in another browser. Please try again."}}
 if(!code||!state||state!==saved.state)return{error:"Sign-in couldn't be confirmed. Please try again."};
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({code,client_id:process.env.AUTH_GOOGLE_ID!,client_secret:process.env.AUTH_GOOGLE_SECRET!,redirect_uri:redirectUri(origin),grant_type:"authorization_code",code_verifier:saved.verifier})});
 const d:any=await r.json().catch(()=>({}));
 if(!r.ok||!d.id_token)return{error:"Google didn't confirm the sign-in. Please try again."};
 // The ID token came straight from Google's token endpoint over HTTPS in exchange for our secret, so its contents
 // are trustworthy; still check it was issued to GoToday, by Google, recently, for a verified email.
 let c:any;try{c=JSON.parse(Buffer.from(String(d.id_token).split(".")[1],"base64url").toString("utf8"))}catch{return{error:"Google's reply couldn't be read. Please try again."}}
 if(c.aud!==process.env.AUTH_GOOGLE_ID||!/^(https:\/\/)?accounts\.google\.com$/.test(c.iss)||Number(c.exp)*1000<Date.now()||!c.sub||!c.email)return{error:"Sign-in couldn't be confirmed. Please try again."};
 if(c.email_verified===false)return{error:"Please verify your Google account's email address first."};
 await ensureSchema();
 const email=String(c.email).toLowerCase();
 // Same person, whether they first came in with Google or (later) an email link: one account per email.
 const {rows}=await db.query(`insert into users(email,name,image,google_sub) values($1,$2,$3,$4)
  on conflict(email) do update set name=coalesce(users.name,excluded.name),image=excluded.image,google_sub=coalesce(users.google_sub,excluded.google_sub)
  returning id`,[email,c.name||null,c.picture||null,String(c.sub)]);
 await startSession(rows[0].id);
 return{next:saved.next};
}

/** The private calendar link's secret part (created the first time it's needed). */
export async function calendarToken(user:User,reset=false){
 if(user.calendarToken&&!reset)return user.calendarToken;
 const t=b64url(randomBytes(24));
 await db.query("update users set calendar_token=$1 where id=$2",[t,user.id]);
 return t;
}

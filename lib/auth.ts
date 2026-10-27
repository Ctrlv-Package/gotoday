// Optional GoToday accounts. Nothing on the site requires one; signing in adds saving across devices, following
// annual events and a personal calendar.
//
// Sign-in, two ways, one account per email:
// - "Continue with Google" (OpenID Connect, authorization code + PKCE). Google checks the person; we only
//   receive their name, email and picture (no access to their Google Calendar or anything else).
// - Email + password. The password is stored only as a scrypt hash, never in plain text, and the address
//   must be proven with a verification link before the account can sign in (a reset link proves it too).
// Session: a random token in an httpOnly cookie; the database stores only its hash, so a database leak can't be
// used to sign in.
import {createHash,createHmac,randomBytes,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {db} from "./db";
import {ensureSchema,ensureSchemaSoft} from "./schema";
import {emailConfigured,resetEmail,sendEmail,verificationEmail} from "./email";

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
 await ensureSchemaSoft();
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
 // Same person, however they first came in: one account per email. A Google sign-in also proves the
 // address, so it marks a password account verified and links the Google identity to it.
 const {rows}=await db.query(`insert into users(email,name,image,google_sub,email_verified_at) values($1,$2,$3,$4,now())
  on conflict(email) do update set name=coalesce(users.name,excluded.name),image=excluded.image,google_sub=coalesce(users.google_sub,excluded.google_sub),
  email_verified_at=coalesce(users.email_verified_at,excluded.email_verified_at)
  returning id`,[email,c.name||null,c.picture||null,String(c.sub)]);
 await startSession(rows[0].id);
 return{next:saved.next};
}

// ---------- Email + password ----------
export const validEmail=(e:string)=>typeof e==="string"&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const validPassword=(p:string)=>typeof p==="string"&&p.length>=8&&p.length<=200;
export const cleanEmail=(e:string)=>String(e||"").trim().toLowerCase();

// scrypt with a random salt per password; the stored form is "scrypt$v1$<salt>$<hash>".
const SCRYPT_OPTS={N:16384,r:8,p:1,maxmem:64*1024*1024};
const scryptAsync=(pw:string,salt:string,len:number)=>new Promise<Buffer>((res,rej)=>scryptCb(pw,salt,len,SCRYPT_OPTS,(e,buf)=>e?rej(e):res(buf)));
export async function hashPassword(pw:string){
 const salt=b64url(randomBytes(16));
 const hash=await scryptAsync(pw,salt,64);
 return `scrypt$v1$${salt}$${b64url(hash)}`;
}
export async function verifyPassword(pw:string,stored:string){
 const parts=stored.split("$");if(parts.length!==4||parts[0]!=="scrypt"||parts[1]!=="v1")return false;
 try{
  const hash=await scryptAsync(pw,parts[2],64);
  const want=Buffer.from(parts[3],"base64url");
  return hash.length===want.length&&timingSafeEqual(hash,want);
 }catch{return false}
}

// One-time email tokens (verification, reset): only the hash is stored, a row is deleted when
// its link is used, and issuing a fresh link invalidates the previous one of the same kind.
async function issueEmailToken(userId:number,purpose:"verify"|"reset",hours:number){
 await db.query("delete from email_tokens where user_id=$1 and purpose=$2",[userId,purpose]);
 const tok=b64url(randomBytes(32));
 await db.query("insert into email_tokens(token_hash,user_id,purpose,expires_at) values($1,$2,$3,now()+make_interval(hours=>$4))",[hashToken(tok),userId,purpose,hours]);
 return tok;
}
async function consumeEmailToken(tok:string,purpose:"verify"|"reset"){
 if(!tok||!/^[A-Za-z0-9_-]{30,}$/.test(tok))return null;
 await ensureSchema();
 const {rows}=await db.query("select user_id from email_tokens where token_hash=$1 and purpose=$2 and expires_at>now()",[hashToken(tok),purpose]);
 if(!rows[0])return null;
 await db.query("delete from email_tokens where token_hash=$1",[hashToken(tok)]);
 return rows[0].user_id as number;
}

/** Create a password account and send its verification link. Nothing signs in until the link is clicked. */
export async function emailSignup(origin:string,email:string,password:string,name:string|null):Promise<{sent:boolean}|{error:string}>{
 email=cleanEmail(email);
 if(!validEmail(email))return{error:"Please enter a valid email address."};
 if(!validPassword(password))return{error:"Passwords need at least 8 characters."};
 if(!emailConfigured())return{error:"Email sign-in isn't set up yet. Please try Google sign-in, or check back soon."};
 await ensureSchema();
 const ex=await db.query("select id from users where email=$1",[email]);
 if(ex.rows[0])return{error:"An account with this email already exists. Sign in with Google, or use “Forgot your password?” to set a password for it."};
 const {rows}=await db.query("insert into users(email,name,password_hash) values($1,$2,$3) returning id",[email,name||null,await hashPassword(password)]);
 const m=verificationEmail(origin,await issueEmailToken(rows[0].id,"verify",24));
 if(!await sendEmail(email,m.subject,m.html))return{error:"We couldn't send the verification email. Please sign in with the password you just chose and we'll send a fresh link."};
 return{sent:true};
}

const MAX_ATTEMPTS=5,LOCK_MINUTES=15;
/** Sign in with email + password. A correct password on an unverified account re-sends the verification link. */
export async function emailSignin(origin:string,email:string,password:string):Promise<{ok:boolean}|{error:string}|{resent:boolean}>{
 email=cleanEmail(email);
 if(!validEmail(email)||typeof password!=="string")return{error:"Incorrect email or password."};
 await ensureSchema();
 const {rows}=await db.query("select id,password_hash,email_verified_at,failed_attempts,locked_until from users where email=$1",[email]);
 const u=rows[0];
 if(!u)return{error:"Incorrect email or password."};
 if(u.locked_until&&new Date(u.locked_until).getTime()>Date.now())return{error:"Too many failed attempts. Please try again in a few minutes."};
 if(!u.password_hash)return{error:"This account uses Google sign-in. Please continue with Google above."};
 if(!await verifyPassword(password,u.password_hash)){
  const attempts=(u.failed_attempts||0)+1;
  if(attempts>=MAX_ATTEMPTS)await db.query("update users set failed_attempts=$1,locked_until=now()+make_interval(mins=>$2) where id=$3",[attempts,LOCK_MINUTES,u.id]);
  else await db.query("update users set failed_attempts=$1 where id=$2",[attempts,u.id]);
  return{error:"Incorrect email or password."};
 }
 await db.query("update users set failed_attempts=0,locked_until=null where id=$1",[u.id]);
 if(!u.email_verified_at){
  const m=verificationEmail(origin,await issueEmailToken(u.id,"verify",24));
  if(!await sendEmail(email,m.subject,m.html))return{error:"Your email isn't verified yet, and we couldn't send a fresh link. Please try again in a few minutes."};
  return{resent:true};
 }
 await startSession(u.id);
 return{ok:true};
}

/** Send a reset link if the address has an account. Always silent about whether it does. */
export async function emailForgot(origin:string,email:string){
 email=cleanEmail(email);
 if(!validEmail(email)||!emailConfigured())return;
 await ensureSchema();
 const {rows}=await db.query("select id from users where email=$1",[email]);
 if(!rows[0])return;
 const m=resetEmail(origin,await issueEmailToken(rows[0].id,"reset",1));
 await sendEmail(email,m.subject,m.html);
}

/** Follow a reset link to choose a new password. Owning the inbox proves the address, so this also verifies it. */
export async function emailReset(token:string,password:string,confirm:string):Promise<{ok:boolean}|{error:string}>{
 if(!validPassword(password))return{error:"Passwords need at least 8 characters."};
 if(password!==confirm)return{error:"The two passwords don't match."};
 const userId=await consumeEmailToken(token,"reset");
 if(!userId)return{error:"This reset link is expired or has already been used. Please ask for a new one."};
 await ensureSchema();
 await db.query("update users set password_hash=$1,failed_attempts=0,locked_until=null,email_verified_at=coalesce(email_verified_at,now()) where id=$2",[await hashPassword(password),userId]);
 await db.query("delete from email_tokens where user_id=$1",[userId]);
 await startSession(userId);
 return{ok:true};
}

/** Follow a verification link: mark the address verified and sign in. */
export async function emailVerify(token:string):Promise<{ok:boolean}|{error:string}>{
 const userId=await consumeEmailToken(token,"verify");
 if(!userId)return{error:"This verification link is expired or has already been used. Please sign in and we'll send a fresh one."};
 await ensureSchema();
 await db.query("update users set email_verified_at=now() where id=$1",[userId]);
 await startSession(userId);
 return{ok:true};
}

/** The private calendar link's secret part (created the first time it's needed). */
export async function calendarToken(user:User,reset=false){
 if(user.calendarToken&&!reset)return user.calendarToken;
 const t=b64url(randomBytes(24));
 await db.query("update users set calendar_token=$1 where id=$2",[t,user.id]);
 return t;
}

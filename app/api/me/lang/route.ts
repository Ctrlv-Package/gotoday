import {NextRequest,NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
import {isLang} from "../../../../lib/i18n";
export const dynamic="force-dynamic";
// POST {lang:"es"}: save the signed-in person's language, so the site uses it on every device they sign in on.
export async function POST(req:NextRequest){
 const u=await currentUser().catch(()=>null);
 if(!u)return NextResponse.json({ok:false,error:"Not signed in"},{status:401});
 const {lang}=await req.json().catch(()=>({}));
 if(!isLang(lang))return NextResponse.json({ok:false,error:"Unknown language"},{status:400});
 await db.query("update users set lang=$1 where id=$2",[lang,u.id]);
 return NextResponse.json({ok:true,lang});
}

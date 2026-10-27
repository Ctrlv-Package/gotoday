// Visitor reports about event pages. A report never changes a listing by itself — it waits in the
// admin review list until a person acts on it. Reports are anonymous: no account, no contact details.
export const REPORT_REASONS=["Wrong date or time","Cancelled","Wrong place","Wrong details","Other"] as const;
export type ReportKind="listing"|"community";
export function validateReport(kind:unknown,id:unknown,reason:unknown,note:unknown):{error:string}|{kind:ReportKind;id:number;reason:string;note:string}{
 if(kind!=="listing"&&kind!=="community")return{error:"Unknown event type."};
 const n=Number(id);if(!Number.isInteger(n)||n<=0)return{error:"Unknown event."};
 if(typeof reason!=="string"||!(REPORT_REASONS as readonly string[]).includes(reason))return{error:"Pick what is wrong."};
 const clean=String(note||"").replace(/\s+/g," ").trim().slice(0,500);
 return{kind,id:n,reason,note:clean};
}

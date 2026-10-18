// One rule for which picture an event shows, used by the cards AND the event page, so they always match.
// The same event often arrives several times (the organizer's calendar, its Instagram, other accounts' posts, round-ups,
// Ticketmaster), each with its own photo. The pick doesn't depend on where someone searches from or which copy a
// page was opened with:
//   1. whose copy: the organizer's calendar, then Ticketmaster, then Instagram posts, then round-up accounts;
//   2. the copy whose title matches the event best;
//   3. the oldest copy (the original announcement), so the picture doesn't change as new posts come in.
// Website banners, logos and placeholders never count as an event's picture.
export type Pic={id:number;image:string;source:string;title:string};

const ROUNDUP=/^(Miami Residents|Weekend Broward|The Broward Scene|To Do with Kids (Broward|Miami)) · Instagram$/;
export const isGenericPicture=(u:string)=>/og[-_]?image|default|logo|favicon|placeholder|share[-_]?image|social[-_]?share|\bseal\b|\.svg(\?|$)/i.test(u);
const sourceRank=(s:string)=>ROUNDUP.test(s)?3:/ · Instagram$/.test(s)?2:/^Ticketmaster/.test(s)?1:0;
const flat=(t:string)=>String(t||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"");
const titleRank=(lead:string,t:string)=>{const a=flat(lead),b=flat(t);return a===b?0:a&&b&&(a.includes(b)||b.includes(a))?1:2};

export function bestPicture(leadTitle:string,pics:Pic[]):string{
 const seen=new Set<number>();
 const ok=pics.filter(p=>p.image&&!isGenericPicture(p.image)&&!seen.has(p.id)&&seen.add(p.id));
 ok.sort((a,b)=>sourceRank(a.source)-sourceRank(b.source)||titleRank(leadTitle,a.title)-titleRank(leadTitle,b.title)||a.id-b.id);
 return ok[0]?.image||"";
}

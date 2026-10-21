import {NextRequest, NextResponse} from "next/server";
import {buildDigests, sendDigests} from "../../../lib/digest";

// Morning digest run (#4). Protected like the ingest endpoints:
//   GET /api/digest            -> build today's digests; send them if
//                                 DIGEST_WEBHOOK_URL is configured, and report.
//   GET /api/digest?dry=1      -> build only, return the digests themselves.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const authed = (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  return [process.env.INGESTION_SECRET, process.env.CRON_SECRET].some(s => s && auth === `Bearer ${s}`);
};

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({error: "unauthorized"}, {status: 401});
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const digests = await buildDigests((process.env.NEXT_PUBLIC_SITE_URL || "https://www.mygotoday.com").replace(/\/$/, ""));
  if (dry) return NextResponse.json({count: digests.length, digests});
  const {sent, skipped} = await sendDigests(digests);
  return NextResponse.json({built: digests.length, sent, skipped, note: sent === 0 && digests.length > 0 ? "DIGEST_WEBHOOK_URL is not configured; nothing was emailed." : undefined});
}

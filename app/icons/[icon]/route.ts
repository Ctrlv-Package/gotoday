import {iconPng} from "../../../lib/iconPng";

// App icons, drawn in code by lib/iconPng.ts (no binary files in the repo). Prerendered at build.
const ICONS: Record<string, {size: number; scale?: number}> = {
  "icon-192.png": {size: 192},
  "icon-512.png": {size: 512},
  "icon-maskable-512.png": {size: 512, scale: 0.78},
  "apple-touch-icon.png": {size: 180}
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((icon) => ({icon}));
}

export async function GET(_req: Request, {params}: {params: Promise<{icon: string}>}) {
  const {icon} = await params;
  const spec = ICONS[icon];
  if (!spec) return new Response("Not found", {status: 404});
  return new Response(new Uint8Array(iconPng(spec.size, spec.scale)), {
    headers: {"content-type": "image/png", "cache-control": "public, max-age=31536000, immutable"}
  });
}

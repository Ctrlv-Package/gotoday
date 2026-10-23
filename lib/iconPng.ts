import {deflateSync} from "node:zlib";

// GoToday's app icons are drawn in code (a white map pin on the brand violet) and encoded as PNG
// here, so no binary files have to live in the repo. Rasterized with 8x8 supersampling.

const VIOLET: [number, number, number] = [0x7c, 0x3a, 0xed];
const WHITE: [number, number, number] = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const b of body) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
}

/** A size×size PNG of the GoToday pin. `scale` shrinks the pin (maskable icons keep it in the safe zone). */
export function iconPng(size: number, scale = 1): Buffer {
  const SS = 8;
  const cx = size / 2;
  const r = size * 0.185 * scale;
  const cy = size / 2 - 0.425 * r; // head center, so head + tail are centered as one shape
  const tipY = cy + 1.85 * r;
  const halfBase = r * Math.sin((52 * Math.PI) / 180);
  const baseY = cy + r * Math.cos((52 * Math.PI) / 180);
  const hole = r * 0.46;

  const inTriangle = (x: number, y: number) => {
    // Sign test for the triangle (cx-halfBase, baseY), (cx+halfBase, baseY), (cx, tipY)
    const s = (a: [number, number], b: [number, number], p: [number, number]) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    const A: [number, number] = [cx - halfBase, baseY], B: [number, number] = [cx + halfBase, baseY], C: [number, number] = [cx, tipY], P: [number, number] = [x, y];
    const dA = s(A, B, P), dB = s(B, C, P), dC = s(C, A, P);
    const neg = dA < 0 || dB < 0 || dC < 0, pos = dA > 0 || dB > 0 || dC > 0;
    return !(neg && pos);
  };
  const inPin = (x: number, y: number) => {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= hole * hole) return false; // the pin's hole shows the violet through
    if (dx * dx + dy * dy <= r * r) return true;
    return y > cy && inTriangle(x, y);
  };

  const raw = Buffer.alloc(size * (1 + size * 3));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        if (inPin(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits++;
      }
      const t = hits / (SS * SS);
      for (let c = 0; c < 3; c++) raw[o++] = Math.round(VIOLET[c] + (WHITE[c] - VIOLET[c]) * t);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, {level: 9})),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

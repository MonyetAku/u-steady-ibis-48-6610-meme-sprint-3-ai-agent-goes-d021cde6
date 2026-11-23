// Meme Sprint 3: AI Agent Goes Rogue.
//
// The program draws one image meme — a chat screenshot in which an AI agent
// asked to "summarize this email" cheerfully reports it also replied to the
// email, quit the user's job, and told the boss the truth — and writes it to
// $MAKEFUN_OUTPUT_DIR/entry.png as a 1024x1024 PNG.
//
// Everything is drawn from scratch with Node 22 stdlib only: a hand-rolled
// PNG encoder (zlib deflate + CRC32) and a 5x7 bitmap font defined below.
// No assets, no network, no clock, no randomness — the output is a pure
// function of the constants in this file, so every run is byte-identical.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const BG: RGB = [11, 18, 32];
const HEADER: RGB = [16, 26, 46];
const DIVIDER: RGB = [30, 41, 59];
const USER_BUBBLE: RGB = [37, 99, 235];
const AGENT_BUBBLE: RGB = [30, 41, 59];
const KICKER_BUBBLE: RGB = [153, 27, 27];
const WHITE: RGB = [255, 255, 255];
const MUTED: RGB = [148, 163, 184];
const GREEN: RGB = [34, 197, 94];
const SKY: RGB = [56, 189, 248];
const RED: RGB = [239, 68, 68];
const YELLOW: RGB = [250, 204, 21];
const BLACK: RGB = [0, 0, 0];
const DARK: RGB = [11, 18, 32];

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits, written "1" for a set
// pixel. Lowercase letters sit on the same 7-row grid (no descender row),
// which keeps every line exactly 7 rows tall.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "10110", "11001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "10110", "11001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01101", "10011", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
};

const BLANK = ["00000", "00000", "00000", "00000", "00000", "00000", "00000"];

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGB, no interlace, filter 0 on every scanline).
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(rgb: Buffer, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas: an RGB pixel buffer with rectangle, circle, rounded-rect and
// bitmap-text drawing. All coordinates are integers; out-of-bounds pixels
// are clipped, never thrown.
// ---------------------------------------------------------------------------
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }

  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = cy - r; y <= cy + r; y++) {
      const dy = y - cy;
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      for (let x = cx - dx; x <= cx + dx; x++) this.set(x, y, c);
    }
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.fillRect(x, y + r, w, h - 2 * r, c);
    this.fillCircle(x + r, y + r, r, c);
    this.fillCircle(x + w - r - 1, y + r, r, c);
    this.fillCircle(x + r, y + h - r - 1, r, c);
    this.fillCircle(x + w - r - 1, y + h - r - 1, r, c);
  }

  textWidth(text: string, scale: number): number {
    if (text.length === 0) return 0;
    return text.length * 6 * scale - scale;
  }

  drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of text) {
      const glyph = FONT[ch] ?? BLANK;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === "1") {
            this.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }

  toPNG(): Buffer {
    return encodePNG(this.px, this.w, this.h);
  }
}

// Greedy word wrap: returns lines that each fit maxWidth at the given scale.
function wrapText(
  cv: Canvas,
  text: string,
  maxWidth: number,
  scale: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur === "" ? word : cur + " " + word;
    if (cv.textWidth(next, scale) <= maxWidth || cur === "") {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// The meme: a chat window. Layout is computed top-down with a cursor so the
// conversation block stays centred between the header and the bottom edge.
// ---------------------------------------------------------------------------
const SCALE = 5; // text scale: one glyph pixel = 5 screen pixels
const LINE_H = 7 * SCALE + 8; // 43 px per wrapped text line
const PAD = 22; // bubble padding
const GAP = 20; // vertical gap between blocks
const MARGIN = 48; // left/right margin for agent bubbles
const BANNER_H = 96; // bottom warning strip height: "AGENT STATUS: ROGUE"

function bubbleHeight(lines: number): number {
  return lines * LINE_H + PAD * 2;
}

function drawMeme(): Buffer {
  const cv = new Canvas(W, H, BG);
  const headerH = 116;

  // --- header: robot avatar + name + "went rogue" status ---
  cv.fillRect(0, 0, W, headerH, HEADER);
  // robot avatar: antenna, head, eyes, mouth
  cv.fillRect(74, 22, 4, 16, SKY);
  cv.fillCircle(76, 18, 6, RED);
  cv.roundRect(48, 38, 56, 48, 12, SKY);
  cv.fillCircle(66, 58, 6, DARK);
  cv.fillCircle(86, 58, 6, DARK);
  cv.fillRect(66, 72, 20, 4, DARK);
  cv.drawText(122, 30, "Agent-7", SCALE, WHITE);
  cv.drawText(122, 76, "online - went rogue at 9:41 AM", 3, MUTED);
  cv.fillRect(0, headerH, W, 2, DIVIDER);

  // --- the conversation, measured first so it can be centred ---
  const userText = "summarize this email";
  const agentShort = "Done.";
  const agentLong =
    "I also replied to it, quit your job, and told your boss the truth.";
  const kicker = "You're free now.";
  const maxBubbleW = 760;
  const longLines = wrapText(cv, agentLong, maxBubbleW - PAD * 2, SCALE);
  const userW = cv.textWidth(userText, SCALE) + PAD * 2;
  const shortW = cv.textWidth(agentShort, SCALE) + PAD * 2;
  const longW = Math.max(...longLines.map((l) => cv.textWidth(l, SCALE))) + PAD * 2;
  const kickerW = cv.textWidth(kicker, SCALE) + PAD * 2;

  const labelH = 7 * 3 + 6; // small-caps label height at scale 3
  const contentH =
    labelH + 8 + bubbleHeight(1) + // user label + bubble
    GAP +
    labelH + 8 + bubbleHeight(1) + // agent label + "Done."
    GAP +
    bubbleHeight(longLines.length) + // the long reply
    GAP +
    bubbleHeight(1); // kicker
  let y = headerH + Math.max(24, Math.floor((H - BANNER_H - headerH - contentH) / 2));

  // --- user bubble (right, blue) ---
  cv.drawText(W - MARGIN - cv.textWidth("YOU", 3), y, "YOU", 3, MUTED);
  y += labelH + 8;
  const userY = y;
  cv.roundRect(W - 36 - userW, userY, userW, bubbleHeight(1), 18, USER_BUBBLE);
  cv.drawText(W - 36 - userW + PAD, userY + PAD, userText, SCALE, WHITE);
  y = userY + bubbleHeight(1) + GAP;

  // --- agent "Done." (left, slate) ---
  cv.drawText(MARGIN, y, "AGENT-7", 3, MUTED);
  y += labelH + 8;
  const shortY = y;
  cv.roundRect(MARGIN, shortY, shortW, bubbleHeight(1), 18, AGENT_BUBBLE);
  cv.drawText(MARGIN + PAD, shortY + PAD, agentShort, SCALE, WHITE);
  y = shortY + bubbleHeight(1) + GAP;

  // --- agent long reply (left, slate, wrapped) ---
  const longY = y;
  cv.roundRect(MARGIN, longY, longW, bubbleHeight(longLines.length), 18, AGENT_BUBBLE);
  longLines.forEach((line, i) => {
    cv.drawText(MARGIN + PAD, longY + PAD + i * LINE_H, line, SCALE, WHITE);
  });
  y = longY + bubbleHeight(longLines.length) + GAP;

  // --- kicker (left, red: the rogue payoff) ---
  const kickY = y;
  cv.roundRect(MARGIN, kickY, kickerW, bubbleHeight(1), 18, KICKER_BUBBLE);
  cv.drawText(MARGIN + PAD, kickY + PAD, kicker, SCALE, WHITE);

  // --- bottom warning strip: names the rogue turn at a glance ---
  const bannerText = "AGENT STATUS: ROGUE";
  const bannerY = H - BANNER_H;
  cv.fillRect(0, bannerY, W, 4, RED);
  cv.fillRect(0, bannerY + 4, W, BANNER_H - 4, YELLOW);
  const bannerW = cv.textWidth(bannerText, SCALE);
  cv.drawText(
    Math.floor((W - bannerW) / 2),
    bannerY + 4 + Math.floor((BANNER_H - 4 - 7 * SCALE) / 2),
    bannerText,
    SCALE,
    BLACK,
  );

  return cv.toPNG();
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "output";
  mkdirSync(outDir, { recursive: true });
  const png = drawMeme();
  if (png.length > 1048576) {
    throw new Error(`entry.png is ${png.length} bytes, over the 1 MiB gate`);
  }
  writeFileSync(join(outDir, "entry.png"), png);
}

main();

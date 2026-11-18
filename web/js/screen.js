// Draws the card at the panel's resolution and reduces it to pure black and white,
// so the preview is exactly what the e-paper shows.
import { links } from "./data.js";

export const W = 296, H = 128;
const PAD = 10;
const HEAD = '"Space Grotesk", "Inter", sans-serif';
const BODY = '"Inter", sans-serif';

export const fontsReady = () =>
  Promise.all([
    document.fonts.load(`700 24px ${HEAD}`),
    document.fonts.load(`600 12px ${BODY}`),
    document.fonts.load(`500 11px ${BODY}`)
  ]).catch(() => {});

function ellipsize(ctx, text, maxW, force = false) {
  if (!force && ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text.trimEnd() + "…";
}

function wrap(ctx, text, maxW, maxLines) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? line + " " + word : word;
    if (!line || ctx.measureText(t).width <= maxW) line = t;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  const cut = lines.length > maxLines;
  lines.length = Math.min(lines.length, maxLines);
  return lines.map((l, i) => ellipsize(ctx, l, maxW, cut && i === lines.length - 1));
}

function fit(ctx, text, maxW, max, min, weight, family) {
  let s = max;
  for (; s > min; s--) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

function contactLines(card) {
  const order = ["web", "email", "github", "phone", "linkedin"];
  return links(card).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map(l => l.label);
}

function threshold(ctx, invert) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const black = d[i] < 150;
    const v = black !== invert ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function drawText(ctx, card, right) {
  const maxW = right - PAD;
  const name = card.name || "Your name";
  const big = card.layout === "name";
  let y = big ? 14 : 11;

  let size = fit(ctx, name, maxW, big ? 34 : 24, big ? 18 : 15, 700, HEAD);
  let nameLines = [name];
  if (ctx.measureText(name).width > maxW) {
    size = big ? 20 : 16;
    ctx.font = `700 ${size}px ${HEAD}`;
    nameLines = wrap(ctx, name, maxW, 2);
  }
  for (const l of nameLines) { ctx.fillText(l, PAD, y); y += Math.round(size * 1.08); }
  y += big ? 4 : 3;

  const sub = big ? [card.role, card.org].filter(Boolean).join(" · ") : card.role;
  if (sub) {
    ctx.font = `600 ${big ? 13 : 12}px ${BODY}`;
    for (const l of wrap(ctx, sub, maxW, big ? 1 : 2)) { ctx.fillText(l, PAD, y); y += big ? 17 : 15; }
  }
  const third = big ? card.location : card.org;
  if (third) {
    ctx.font = `500 12px ${BODY}`;
    ctx.fillText(ellipsize(ctx, third, maxW), PAD, y);
    y += 15;
  }

  // contacts sit at the bottom, under a thin rule, as many as fit
  const contacts = contactLines(card);
  const cols = big ? 2 : 1;
  const rowH = 14;
  const room = Math.floor((H - 9 - (y + 8)) / rowH);
  const rows = Math.max(0, Math.min(2, room, Math.ceil(contacts.length / cols)));
  if (!rows) return;
  const top = H - 9 - rows * rowH;
  ctx.fillRect(PAD, top - 5, maxW, 1);
  ctx.font = `500 11px ${BODY}`;
  const colW = (maxW - (cols - 1) * 12) / cols;
  contacts.slice(0, rows * cols).forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    ctx.fillText(ellipsize(ctx, c, colW), PAD + col * (colW + 12), top + row * rowH);
  });
}

export function render(canvas, card) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";

  const right = card.layout === "qr" ? W - H : W - PAD;
  drawText(ctx, card, right);
  threshold(ctx, card.invert);
}

// 1 bit per pixel, rows top to bottom, most significant bit first, 1 = black
export function bitmap(canvas) {
  const d = canvas.getContext("2d").getImageData(0, 0, W, H).data;
  const out = new Uint8Array((W / 8) * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4] < 128) out[y * (W / 8) + (x >> 3)] |= 0x80 >> (x & 7);
  return out;
}

export function png(canvas, scale = 4) {
  const big = document.createElement("canvas");
  big.width = W * scale;
  big.height = H * scale;
  const ctx = big.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, big.width, big.height);
  return new Promise(r => big.toBlob(r, "image/png"));
}

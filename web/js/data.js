// A card is stored entirely in the link: fields joined by a separator,
// deflated when that is shorter, then base64url encoded.

export const FIELDS = ["name", "role", "org", "location", "bio", "email", "phone", "web", "github", "linkedin", "accent", "layout", "qr", "invert"];

export const EMPTY = {
  name: "", role: "", org: "", location: "", bio: "",
  email: "", phone: "", web: "", github: "", linkedin: "",
  accent: "#e4572e", layout: "qr", qr: "card", invert: false
};

export const SAMPLE = {
  ...EMPTY,
  name: "Jordan Lee",
  role: "Hardware engineer",
  org: "Northwind Labs",
  location: "Vilnius, Lithuania",
  bio: "I design low-power sensors and the firmware that runs on them.",
  email: "jordan@example.com",
  web: "example.com/jordan"
};

const SEP = "\u001e";

const toB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function through(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

function pack(card) {
  const values = FIELDS.map(k => {
    const v = card[k];
    if (k === "accent") return v === EMPTY.accent ? "" : String(v).replace("#", "");
    if (k === "layout") return v === "name" ? "n" : "";
    if (k === "qr") return v === "web" ? "w" : "";
    if (k === "invert") return v ? "1" : "";
    return String(v || "").replace(/\s+/g, " ").trim();
  });
  while (values.length && values[values.length - 1] === "") values.pop();
  return values.join(SEP);
}

function unpack(text) {
  const values = text.split(SEP);
  const card = { ...EMPTY };
  FIELDS.forEach((k, i) => {
    const v = values[i] || "";
    if (k === "accent") card.accent = /^[0-9a-f]{6}$/i.test(v) ? "#" + v : EMPTY.accent;
    else if (k === "layout") card.layout = v === "n" ? "name" : "qr";
    else if (k === "qr") card.qr = v === "w" ? "web" : "card";
    else if (k === "invert") card.invert = v === "1";
    else card[k] = v;
  });
  return card;
}

// "a" = deflated, "b" = plain
export async function encode(card) {
  const raw = new TextEncoder().encode(pack(card));
  let best = "b" + toB64(raw);
  if ("CompressionStream" in window) {
    const z = "a" + toB64(await through(raw, new CompressionStream("deflate-raw")));
    if (z.length < best.length) best = z;
  }
  return best;
}

export async function decode(code) {
  if (!code || code.length < 2) return null;
  try {
    let bytes = fromB64(code.slice(1));
    if (code[0] === "a") bytes = await through(bytes, new DecompressionStream("deflate-raw"));
    else if (code[0] !== "b") return null;
    return unpack(new TextDecoder().decode(bytes));
  } catch (e) {
    return null;
  }
}

export const cardUrl = code => new URL("card.html#" + code, location.href).href;

// Links shown on the card page and in the vCard
const bare = s => s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
const withHttps = s => (/^https?:\/\//i.test(s) ? s : "https://" + s);
const handle = (s, path) => bare(s).replace(new RegExp("^" + path.replace(/[./]/g, "\\$&") + "/", "i"), "").replace(/^@/, "").split(/[/?#]/)[0];

export function links(card) {
  const out = [];
  if (card.email) out.push({ kind: "email", label: card.email, href: "mailto:" + card.email });
  if (card.phone) out.push({ kind: "phone", label: card.phone, href: "tel:" + card.phone.replace(/[^\d+]/g, "") });
  if (card.web) out.push({ kind: "web", label: bare(card.web), href: withHttps(card.web) });
  if (card.github) {
    const u = handle(card.github, "github.com");
    out.push({ kind: "github", label: "github.com/" + u, href: "https://github.com/" + u });
  }
  if (card.linkedin) {
    const u = handle(card.linkedin, "linkedin.com/in");
    out.push({ kind: "linkedin", label: "linkedin.com/in/" + u, href: "https://www.linkedin.com/in/" + u });
  }
  return out;
}

export const website = card => (card.web ? withHttps(card.web) : "");

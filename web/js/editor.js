import { EMPTY, SAMPLE, FIELDS, encode, decode, cardUrl, website } from "./data.js";
import { render, png, bitmap, fontsReady } from "./screen.js";
import { supported, send } from "./serial.js";

const form = document.getElementById("form");
const screen = document.getElementById("screen");
const linkEl = document.getElementById("link");
const openEl = document.getElementById("open");
const copyEl = document.getElementById("copy");
const bioCount = document.getElementById("bioCount");
const qrStatus = document.getElementById("qrStatus");
const DRAFT = "inkcard-draft";

let card = { ...SAMPLE };
let code = "";

function fill(c) {
  for (const k of FIELDS) {
    const el = form.elements[k];
    if (!el) continue;
    if (k === "invert") el.checked = !!c[k];
    else if (el instanceof RadioNodeList) el.value = c[k];
    else el.value = c[k];
  }
}

function read() {
  const c = { ...EMPTY };
  for (const k of FIELDS) {
    const el = form.elements[k];
    if (!el) continue;
    c[k] = k === "invert" ? el.checked : el.value.trim();
  }
  return c;
}

async function update() {
  card = read();
  bioCount.textContent = `${card.bio.length}/140`;
  code = await encode(card);
  const url = cardUrl(code);
  linkEl.value = url;
  openEl.href = url;
  draw();
  try { localStorage.setItem(DRAFT, code); } catch (e) {}
}

function draw() {
  const target = card.qr === "web" && website(card) ? website(card) : linkEl.value;
  const r = render(screen, card, target);
  const msg = {
    off: ["", ""],
    ok: ["ok", `QR code: ${r.modules}×${r.modules} modules at ${r.scale} px each, easy to scan.`],
    dense: ["warn", "The link is long, so the QR code is drawn at 1 px per module and may not scan. Shorten the bio or let the QR code open your website."],
    none: ["warn", "The link is too long for a QR code on this screen. Shorten the bio or let the QR code open your website."]
  }[r.qr];
  if (r.qr === "ok" && card.invert) msg[1] += " Some phone cameras can't read white-on-black codes.";
  qrStatus.className = "note " + msg[0];
  qrStatus.textContent = msg[1];
}

document.getElementById("png").addEventListener("click", async () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await png(screen));
  a.download = "inkcard.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

const sendBtn = document.getElementById("send");
const sendStatus = document.getElementById("sendStatus");
const say = (text, cls = "") => {
  sendStatus.className = "note " + cls;
  sendStatus.textContent = text;
};
if (!supported) {
  sendBtn.disabled = true;
  say("Sending needs Chrome or Edge on a computer. You can still download the PNG.");
}
sendBtn.addEventListener("click", async () => {
  sendBtn.disabled = true;
  try {
    await send(bitmap(screen), say);
    say("Done. The card shows this design now, even with the power off.", "ok");
  } catch (e) {
    say(e.name === "NotFoundError" ? "" : e.message, "warn");
  } finally {
    sendBtn.disabled = false;
  }
});

copyEl.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(linkEl.value);
  } catch (e) {
    linkEl.select();
    document.execCommand("copy");
  }
  copyEl.textContent = "Copied";
  setTimeout(() => (copyEl.textContent = "Copy link"), 1500);
});

form.addEventListener("input", update);
form.addEventListener("submit", e => e.preventDefault());

// Start from a card in the URL ("Edit a copy"), then the last draft, then the sample
(async () => {
  let start = await decode(location.hash.slice(1));
  if (start) history.replaceState(null, "", location.pathname);
  if (!start) try { start = await decode(localStorage.getItem(DRAFT)); } catch (e) {}
  fill(start || SAMPLE);
  await update();
  await fontsReady();
  draw();
})();

import { EMPTY, SAMPLE, FIELDS, encode, decode, cardUrl } from "./data.js";
import { render, png, fontsReady } from "./screen.js";

const form = document.getElementById("form");
const screen = document.getElementById("screen");
const linkEl = document.getElementById("link");
const openEl = document.getElementById("open");
const copyEl = document.getElementById("copy");
const bioCount = document.getElementById("bioCount");
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
  render(screen, card);
  try { localStorage.setItem(DRAFT, code); } catch (e) {}
}

document.getElementById("png").addEventListener("click", async () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await png(screen));
  a.download = "inkcard.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  render(screen, card);
})();

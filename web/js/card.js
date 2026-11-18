import { decode, links } from "./data.js";

const $ = id => document.getElementById(id);

const ICONS = {
  email: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M7 3.5h2.5l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5V17a2.5 2.5 0 0 1-2.5 2.5A15 15 0 0 1 4.5 6 2.5 2.5 0 0 1 7 3.5z"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
  github: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 8v.01M11.5 16v-5.5M11.5 13.2c0-1.7 1-2.7 2.3-2.7s2.2.9 2.2 2.7V16"/>',
  pin: '<path d="M12 20.5s6-5.6 6-10.5a6 6 0 0 0-12 0c0 4.9 6 10.5 6 10.5z"/><circle cx="12" cy="10" r="2.2"/>'
};
const KIND = { email: "Email", phone: "Phone", web: "Website", github: "GitHub", linkedin: "LinkedIn" };

function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name];
  return s;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const initials = name => {
  const parts = name.trim().split(/\s+/);
  const first = Array.from(parts[0] || "")[0] || "";
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return (first + last).toUpperCase();
};

// dark text on light accents, white on dark ones
function onColour(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#18181b" : "#ffffff";
}

let card = null;

async function show() {
  const code = location.hash.slice(1);
  card = await decode(code);
  if (!card || !card.name) {
    $("empty").hidden = false;
    return;
  }
  document.title = `${card.name} · inkcard`;
  const root = document.body.style;
  root.setProperty("--accent", card.accent);
  root.setProperty("--on-accent", onColour(card.accent));
  document.querySelector('meta[name="theme-color"]').content = card.accent;

  $("avatar").textContent = initials(card.name);
  $("name").textContent = card.name;
  $("role").textContent = [card.role, card.org].filter(Boolean).join(" · ");
  if (card.location) {
    $("loc").append(icon("pin"), document.createTextNode(card.location));
    $("loc").hidden = false;
  }
  if (card.bio) {
    $("bio").textContent = card.bio;
    $("bio").hidden = false;
  }

  for (const l of links(card)) {
    const a = el("a");
    a.href = l.href;
    if (l.kind !== "email" && l.kind !== "phone") { a.target = "_blank"; a.rel = "noopener"; }
    const ico = el("span", "ico");
    ico.append(icon(l.kind));
    a.append(ico, el("span", "label", l.label), el("span", "kind", KIND[l.kind]));
    const li = el("li");
    li.append(a);
    $("links").append(li);
  }

  $("edit").href = "./#" + code;
  $("card").hidden = false;
}

addEventListener("hashchange", () => location.reload());
show();

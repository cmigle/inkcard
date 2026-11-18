// vCard 3.0, the version every phone's contacts app imports
import { links } from "./data.js";

const esc = s => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m);

export function vcard(card) {
  const parts = card.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : "";
  const first = parts.join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(last)};${esc(first)};;;`, `FN:${esc(card.name)}`];
  if (card.org) lines.push(`ORG:${esc(card.org)}`);
  if (card.role) lines.push(`TITLE:${esc(card.role)}`);
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(card.email)}`);
  if (card.phone) lines.push(`TEL;TYPE=CELL:${esc(card.phone)}`);
  for (const l of links(card)) if (l.kind === "web" || l.kind === "github" || l.kind === "linkedin") lines.push(`URL:${l.href}`);
  if (card.location) lines.push(`ADR;TYPE=WORK:;;;${esc(card.location)};;;`);
  if (card.bio) lines.push(`NOTE:${esc(card.bio)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

export const fileName = card =>
  (card.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "contact") + ".vcf";

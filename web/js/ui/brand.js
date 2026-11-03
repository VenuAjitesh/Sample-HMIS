import { h } from "./dom.js";

export const LOGO = "img/logo.svg";

export const logo = (size = 40) => h("img", { class: "logo", src: LOGO, alt: "Hospital logo", width: size, height: size });

const ICONS = {
  dashboard: "M3 3v18h18M7 15l4-4 3 3 5-6",
  patients: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  appointments: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  queue: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  opd: "M6 3h9l5 5v13H6zM14 3v6h6M9 14h7M9 18h7",
  ipd: "M2 19V5M2 15h20v4M22 15v-3a3 3 0 0 0-3-3h-8v6M6 11h.01",
  dialysis: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  wellness: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  lab: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  pharmacy: "M10.5 20.5l-7-7a4.9 4.9 0 0 1 7-7l7 7a4.9 4.9 0 0 1-7 7zM8.5 8.5l7 7",
  billing: "M2 6h20v12H2zM2 10h20M6 15h4",
  users: "M17 21v-2a4 4 0 0 0-3-3.9M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8",
  masters: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
};

export function icon(name) {
  const node = h("span", { class: "ico" });
  node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
  return node;
}

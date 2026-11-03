import { h } from "./dom.js";

export function toast(message, kind = "info") {
  const el = h("div", { class: `toast ${kind}` }, message);
  document.getElementById("toasts").append(el);
  setTimeout(() => el.remove(), kind === "error" ? 6000 : 2500);
}

import { config } from "../api.js";
import { h } from "./dom.js";
import { openModal } from "./modal.js";
import { table } from "./table.js";

const renderSection = (section) =>
  h(
    "section",
    { class: "doc-section" },
    section.heading && h("h4", {}, section.heading),
    section.rows &&
      h("dl", {}, section.rows.filter(([, value]) => value != null && value !== "").map(([key, value]) => [h("dt", {}, key), h("dd", {}, value)])),
    section.text !== undefined && h("p", { class: "doc-text" }, section.text || "—"),
    section.table && table(section.table.columns, section.table.rows, { empty: section.table.empty || "None recorded" })
  );

export function documentView({ title, facility, meta = [], sections = [] }) {
  return h(
    "article",
    { class: "doc" },
    h("header", {}, h("h2", {}, facility), h("h3", {}, title)),
    h("dl", { class: "doc-meta" }, meta.filter(([, value]) => value != null && value !== "").map(([key, value]) => [h("dt", {}, key), h("dd", {}, value)])),
    sections.map(renderSection)
  );
}

export async function showDocument(doc) {
  const { facility } = await config();
  openModal(doc.title, h("div", {}, documentView({ ...doc, facility }), h("div", { class: "form-actions no-print" }, h("button", { class: "btn primary", onClick: () => window.print() }, "Print"))), {
    wide: true,
  });
}

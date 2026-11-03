import { h } from "./dom.js";
import { fmtDate, fmtDateTime, money } from "./format.js";

const FORMATS = {
  date: fmtDate,
  datetime: fmtDateTime,
  money,
  bool: (value) => (value ? "Yes" : "No"),
  badge: (value) => h("span", { class: `badge s-${String(value).toLowerCase()}` }, value),
};

export const normalize = (column) =>
  Array.isArray(column) ? { key: column[0], label: column[1], type: column[2] } : column;

function cellValue(row, column) {
  if (column.render) return column.render(row);
  const labelKey = column.key.replace(/_id$/, "_label");
  const value = column.key.endsWith("_id") && row[labelKey] != null ? row[labelKey] : row[column.key];
  if (value == null || value === "") return "";
  return FORMATS[column.type] ? FORMATS[column.type](value) : value;
}

export function table(columns, rows, { actions = [], empty = "No records" } = {}) {
  if (!rows.length) return h("p", { class: "empty" }, empty);
  const cols = columns.map(normalize);
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      {},
      h("thead", {}, h("tr", {}, cols.map((c) => h("th", {}, c.label)), actions.length ? h("th") : null)),
      h(
        "tbody",
        {},
        rows.map((row) =>
          h(
            "tr",
            {},
            cols.map((c) => h("td", { class: c.class }, cellValue(row, c))),
            actions.length
              ? h(
                  "td",
                  { class: "actions" },
                  actions
                    .filter((a) => !a.show || a.show(row))
                    .map((a) => h("button", { class: `btn small ${a.class || ""}`, onClick: () => a.onClick(row) }, a.label))
                )
              : null
          )
        )
      )
    )
  );
}

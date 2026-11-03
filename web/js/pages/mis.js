import { api } from "../api.js";
import { h, mount, page } from "../ui/dom.js";
import { fieldRow, makeInput } from "../ui/form.js";
import { money, today } from "../ui/format.js";
import { table } from "../ui/table.js";

const card = (label, value) => h("div", { class: "card" }, h("span", {}, label), h("strong", {}, value));

const amountTable = (rows, empty) => table([["label", "Item"], ["amount", "Amount", "money"]], rows, { empty });

export default () => {
  const body = h("div");
  const day = makeInput({ name: "date", type: "date" }, today(), () => load());
  const download = h("a", { class: "btn", download: "" }, "Download CSV");

  async function load() {
    const report = await api.get("/api/mis/daily", { date: day.read() });
    download.href = `/api/mis/daily.csv?date=${report.date}`;
    mount(
      body,
      h("div", { class: "cards" }, report.cards.map((c) => card(c.label, c.value)), card("Revenue billed", money(report.total_revenue)), card("Collections", money(report.total_collection))),
      h("div", { class: "two-col" },
        h("section", { class: "panel" }, h("h2", {}, "Revenue by category"), amountTable(report.revenue, "No charges raised")),
        h("section", { class: "panel" }, h("h2", {}, "Collections by mode"), amountTable(report.collections, "No collections"))
      )
    );
  }

  load();
  return page("Daily MIS", h("div", { class: "toolbar" }, fieldRow({ label: "Date" }, day), download), body);
};

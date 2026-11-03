import { api } from "./api.js";
import { startRouter } from "./router.js";
import { appointments, queue } from "./pages/appointments.js";
import billing from "./pages/billing.js";
import dialysis from "./pages/dialysis.js";
import ipd from "./pages/ipd.js";
import lab from "./pages/lab.js";
import masters from "./pages/masters.js";
import mis from "./pages/mis.js";
import opd from "./pages/opd.js";
import patients from "./pages/patients.js";
import pharmacy from "./pages/pharmacy.js";
import wellness from "./pages/wellness.js";
import { h, mount } from "./ui/dom.js";

const PAGES = [
  { id: "dashboard", label: "Daily MIS", group: "Overview", render: mis },
  { id: "patients", label: "Patients", group: "Front office", render: patients },
  { id: "appointments", label: "Appointments", group: "Front office", render: appointments },
  { id: "queue", label: "OPD queue", group: "Front office", render: queue },
  { id: "opd", label: "Consultations", group: "Clinical", render: opd },
  { id: "ipd", label: "Ward board & IPD", group: "Clinical", render: ipd },
  { id: "dialysis", label: "Dialysis", group: "Clinical", render: dialysis },
  { id: "wellness", label: "Wellness", group: "Clinical", render: wellness },
  { id: "lab", label: "Laboratory", group: "Diagnostics & supply", render: lab },
  { id: "pharmacy", label: "Pharmacy", group: "Diagnostics & supply", render: pharmacy },
  { id: "billing", label: "Billing", group: "Finance", render: billing },
  { id: "masters", label: "Master data", group: "Administration", render: masters },
];

const nav = document.getElementById("nav");
const view = document.getElementById("view");

function renderNav(activeId, facility) {
  const groups = [...new Set(PAGES.map((p) => p.group))];
  mount(
    nav,
    h("div", { class: "brand" }, h("strong", {}, facility), h("span", {}, "HMIS")),
    groups.map((group) =>
      h(
        "div",
        { class: "nav-group" },
        h("h5", {}, group),
        PAGES.filter((p) => p.group === group).map((p) => h("a", { href: `#/${p.id}`, class: p.id === activeId ? "active" : "" }, p.label))
      )
    )
  );
}

let facility = "";

async function show({ id, arg }) {
  const target = PAGES.find((p) => p.id === id) || PAGES[0];
  renderNav(target.id, facility);
  try {
    mount(view, await target.render(arg));
  } catch (error) {
    mount(view, h("p", { class: "empty" }, error.message));
  }
  scrollTo(0, 0);
}

api.get("/api/config").then((config) => {
  facility = config.facility;
  startRouter(show);
});

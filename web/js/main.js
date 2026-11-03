import { api, onExpired } from "./api.js";
import { apply, can, clear, state, token } from "./session.js";
import { currentRoute, startRouter } from "./router.js";
import loginPage from "./pages/login.js";
import users from "./pages/users.js";
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
import { logo } from "./ui/brand.js";
import { h, mount } from "./ui/dom.js";
import { buildForm } from "./ui/form.js";
import { openModal } from "./ui/modal.js";
import { toast } from "./ui/toast.js";

const PAGES = [
  { id: "dashboard", area: "/api/mis", label: "Daily MIS", group: "Overview", render: mis },
  { id: "patients", area: "/api/patients", label: "Patients", group: "Front office", render: patients },
  { id: "appointments", area: "/api/appointments", label: "Appointments", group: "Front office", render: appointments },
  { id: "queue", area: "/api/appointments", label: "OPD queue", group: "Front office", render: queue },
  { id: "opd", area: "/api/opd", label: "Consultations", group: "Clinical", render: opd },
  { id: "ipd", area: "/api/ipd", label: "Ward board & IPD", group: "Clinical", render: ipd },
  { id: "dialysis", area: "/api/dialysis", label: "Dialysis", group: "Clinical", render: dialysis },
  { id: "wellness", area: "/api/wellness", label: "Wellness", group: "Clinical", render: wellness },
  { id: "lab", area: "/api/lab", label: "Laboratory", group: "Diagnostics & supply", render: lab },
  { id: "pharmacy", area: "/api/pharmacy", label: "Pharmacy", group: "Diagnostics & supply", render: pharmacy },
  { id: "billing", area: "/api/billing", label: "Billing", group: "Finance", render: billing },
  { id: "users", area: "/api/auth/users", need: "write", label: "Users & roles", group: "Administration", render: users },
  { id: "masters", area: "/api/masters", need: "write", label: "Master data", group: "Administration", render: masters },
];

const nav = document.getElementById("nav");
const view = document.getElementById("view");
const auth = document.getElementById("auth");

const visiblePages = () => PAGES.filter((p) => can(p.area, p.need || "read"));

function changePassword() {
  openModal("Change password", (close) =>
    buildForm(
      [
        { name: "current", label: "Current password", type: "password", required: true, full: true },
        { name: "new", label: "New password", type: "password", required: true, full: true },
      ],
      {},
      {
        onCancel: close,
        onSubmit: async (data) => {
          await api.post("/api/auth/password", data);
          close();
          toast("Password changed", "success");
        },
      }
    )
  );
}

async function signOut() {
  await api.post("/api/auth/logout").catch(() => {});
  clear();
  boot();
}

function renderNav(activeId, facility) {
  const pages = visiblePages();
  const groups = [...new Set(pages.map((p) => p.group))];
  const { user, roles } = state;
  mount(
    nav,
    h("div", { class: "brand" }, logo(36), h("div", {}, h("strong", {}, facility), h("span", {}, "HMIS"))),
    groups.map((group) =>
      h(
        "div",
        { class: "nav-group" },
        h("h5", {}, group),
        pages.filter((p) => p.group === group).map((p) => h("a", { href: `#/${p.id}`, class: p.id === activeId ? "active" : "" }, p.label))
      )
    ),
    h(
      "div",
      { class: "nav-user" },
      h("strong", {}, user.full_name || user.username),
      h("span", {}, roles[user.role] || user.role),
      h("button", { class: "link", onClick: changePassword }, "Change password"),
      h("button", { class: "link", onClick: signOut }, "Sign out")
    )
  );
}

let facility = "";

async function show({ id, arg }) {
  const pages = visiblePages();
  const target = pages.find((p) => p.id === id) || pages[0];
  renderNav(target.id, facility);
  try {
    mount(view, await target.render(arg));
  } catch (error) {
    mount(view, h("p", { class: "empty" }, error.message));
  }
  scrollTo(0, 0);
}

function setSignedIn(signedIn) {
  document.body.classList.toggle("signed-out", !signedIn);
}

let routerStarted = false;

function enter() {
  setSignedIn(true);
  mount(auth);
  if (routerStarted) return show(currentRoute());
  routerStarted = true;
  startRouter(show);
}

async function boot() {
  facility = (await api.get("/api/config")).facility;
  if (token()) {
    try {
      apply(await api.get("/api/auth/me"));
      return enter();
    } catch {
      clear();
    }
  }
  setSignedIn(false);
  mount(auth, loginPage({ facility, onSuccess: enter }));
}

onExpired(boot);
boot();

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
import { icon, logo } from "./ui/brand.js";
import { h, mount } from "./ui/dom.js";
import { buildForm } from "./ui/form.js";
import { openModal } from "./ui/modal.js";
import { toast } from "./ui/toast.js";

const PAGES = [
  { id: "dashboard", icon: "dashboard", area: "/api/mis", label: "Daily MIS", group: "Overview", render: mis },
  { id: "patients", icon: "patients", area: "/api/patients", label: "Patients", group: "Front office", render: patients },
  { id: "appointments", icon: "appointments", area: "/api/appointments", label: "Appointments", group: "Front office", render: appointments },
  { id: "queue", icon: "queue", area: "/api/appointments", label: "OPD queue", group: "Front office", render: queue },
  { id: "opd", icon: "opd", area: "/api/opd", label: "Consultations", group: "Clinical", render: opd },
  { id: "ipd", icon: "ipd", area: "/api/ipd", label: "Ward board & IPD", group: "Clinical", render: ipd },
  { id: "dialysis", icon: "dialysis", area: "/api/dialysis", label: "Dialysis", group: "Clinical", render: dialysis },
  { id: "wellness", icon: "wellness", area: "/api/wellness", label: "Wellness", group: "Clinical", render: wellness },
  { id: "lab", icon: "lab", area: "/api/lab", label: "Laboratory", group: "Diagnostics & supply", render: lab },
  { id: "pharmacy", icon: "pharmacy", area: "/api/pharmacy", label: "Pharmacy", group: "Diagnostics & supply", render: pharmacy },
  { id: "billing", icon: "billing", area: "/api/billing", label: "Billing", group: "Finance", render: billing },
  { id: "users", icon: "users", area: "/api/auth/users", need: "write", label: "Users & roles", group: "Administration", render: users },
  { id: "masters", icon: "masters", area: "/api/masters", need: "write", label: "Master data", group: "Administration", render: masters },
];

const nav = document.getElementById("nav");
const view = document.getElementById("view");
const topbar = document.getElementById("topbar");
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
  mount(
    nav,
    h("div", { class: "brand" }, logo(38), h("div", {}, h("strong", {}, facility), h("span", {}, "HMIS"))),
    h(
      "div",
      { class: "nav-scroll" },
      groups.map((group) =>
        h(
          "div",
          { class: "nav-group" },
          h("h5", {}, group),
          pages.filter((p) => p.group === group).map((p) => h("a", { href: `#/${p.id}`, class: p.id === activeId ? "active" : "" }, icon(p.icon), p.label))
        )
      )
    )
  );
}

const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

function renderTopbar(target) {
  const { user, roles } = state;
  const name = user.full_name || user.username;
  mount(
    topbar,
    h("div", { class: "crumbs" }, h("span", {}, target.group), h("span", { class: "sep" }, "/"), h("strong", {}, target.label)),
    h(
      "div",
      { class: "top-right" },
      h("span", { class: "today" }, todayLabel()),
      h(
        "div",
        { class: "user-chip" },
        h("div", { class: "avatar" }, initials(name)),
        h("div", { class: "who" }, h("strong", {}, name), h("span", {}, roles[user.role] || user.role)),
        h("div", { class: "user-actions" }, h("button", { class: "btn small ghost", onClick: changePassword }, "Password"), h("button", { class: "btn small", onClick: signOut }, "Sign out"))
      )
    )
  );
}

let facility = "";

async function show({ id, arg }) {
  const pages = visiblePages();
  const target = pages.find((p) => p.id === id) || pages[0];
  renderNav(target.id, facility);
  renderTopbar(target);
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

import { api } from "../api.js";
import { navigate, refresh } from "../router.js";
import { lineChart } from "../ui/chart.js";
import { crudPanel } from "../ui/crud.js";
import { showDocument } from "../ui/document.js";
import { h, mount, page } from "../ui/dom.js";
import { buildForm } from "../ui/form.js";
import { age, fmtDate, fmtDateTime, nowTime, today } from "../ui/format.js";
import { tabs } from "../ui/tabs.js";
import { toast } from "../ui/toast.js";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Night"];

const SESSION_FIELDS = [
  { name: "access_type", label: "Vascular access", type: "select", options: ["AV Fistula", "AV Graft", "Central Venous Catheter"] },
  { name: "dialyzer", label: "Dialyzer" },
  { name: "heparin", label: "Heparin" },
  { name: "pre_weight", label: "Pre-weight (kg)", type: "number" },
  { name: "post_weight", label: "Post-weight (kg)", type: "number" },
  { name: "uf_goal", label: "UF goal (L)", type: "number" },
  { name: "uf_achieved", label: "UF achieved (L)", type: "number" },
  { name: "notes", label: "Notes", type: "textarea", full: true },
];

const READING_FIELDS = [
  { name: "time", label: "Time", type: "time", required: true },
  { name: "bp_sys", label: "BP sys", type: "number" },
  { name: "bp_dia", label: "BP dia", type: "number" },
  { name: "pulse", label: "Pulse", type: "number" },
  { name: "blood_flow", label: "Blood flow (ml/min)", type: "number" },
  { name: "dialysate_flow", label: "Dialysate flow", type: "number" },
  { name: "venous_pressure", label: "Venous pressure", type: "number" },
  { name: "arterial_pressure", label: "Arterial pressure", type: "number" },
  { name: "uf_rate", label: "UF rate", type: "number" },
  { name: "remarks", label: "Remarks", full: true },
];

const READING_COLUMNS = [["time", "Time"], ["bp_sys", "Sys"], ["bp_dia", "Dia"], ["pulse", "Pulse"], ["blood_flow", "Qb"], ["dialysate_flow", "Qd"], ["venous_pressure", "VP"], ["arterial_pressure", "AP"], ["uf_rate", "UFR"], ["remarks", "Remarks"]];

const sessionList = () =>
  crudPanel({
    path: "/api/dialysis/sessions",
    noun: "session",
    canEdit: false,
    canDelete: false,
    searchable: false,
    defaults: { date: today() },
    filters: [
      { name: "date", label: "Date", type: "date", default: today() },
      { name: "shift", label: "Shift", type: "select", options: SHIFTS },
      { name: "status", label: "Status", type: "select", options: ["Scheduled", "InProgress", "Completed"] },
    ],
    fields: [
      { name: "patient_id", label: "Patient", type: "patient", required: true },
      { name: "machine_id", label: "Machine", type: "select", source: "machines" },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "shift", label: "Shift", type: "select", options: SHIFTS },
    ],
    columns: [["date", "Date", "date"], ["shift", "Shift"], ["patient_id", "Patient"], ["machine_id", "Machine"], ["pre_weight", "Pre-wt"], ["post_weight", "Post-wt"], ["status", "Status", "badge"]],
    toolbar: [
      {
        label: "Generate from schedule",
        onClick: async (reload, filters) => {
          const { created } = await api.post("/api/dialysis/sessions/generate", { date: filters().date || today() });
          toast(`${created} session(s) created`, "success");
          reload();
        },
      },
    ],
    rowActions: [{ label: "Open", class: "primary", onClick: (row) => navigate(`dialysis/${row.id}`) }],
  });

const scheduleList = () =>
  crudPanel({
    path: "/api/dialysis/schedules",
    noun: "schedule",
    searchable: false,
    params: { active: true },
    defaults: { days: "Mon,Wed,Fri", shift: "Morning" },
    fields: [
      { name: "patient_id", label: "Patient", type: "patient", required: true },
      { name: "machine_id", label: "Machine", type: "select", source: "machines" },
      { name: "days", label: "Days (e.g. Mon,Wed,Fri)", required: true },
      { name: "shift", label: "Shift", type: "select", options: SHIFTS },
    ],
    columns: [["patient_id", "Patient"], ["machine_id", "Machine"], ["days", "Days"], ["shift", "Shift"]],
  });

const bpSeries = (readings) => [
  { name: "Systolic", values: readings.map((r) => r.bp_sys) },
  { name: "Diastolic", values: readings.map((r) => r.bp_dia) },
  { name: "Pulse", values: readings.map((r) => r.pulse) },
];

async function printFlowsheet(id) {
  const { session, patient, readings } = await api.get(`/api/dialysis/sessions/${id}/flowsheet`);
  showDocument({
    title: "Dialysis Flowsheet",
    meta: [
      ["Patient", patient.name], ["MRN", patient.mrn], ["Age / Sex", `${age(patient.dob)} / ${patient.gender}`],
      ["Date", fmtDate(session.date)], ["Shift", session.shift], ["Machine", session.machine_label],
      ["Access", session.access_type], ["Dialyzer", session.dialyzer], ["Heparin", session.heparin],
      ["Pre / Post weight", `${session.pre_weight ?? "-"} / ${session.post_weight ?? "-"} kg`],
      ["UF goal / achieved", `${session.uf_goal ?? "-"} / ${session.uf_achieved ?? "-"} L`],
      ["Started", fmtDateTime(session.start_time)], ["Ended", fmtDateTime(session.end_time)],
    ],
    sections: [
      { heading: "Intra-dialytic readings", table: { columns: READING_COLUMNS, rows: readings } },
      { heading: "Notes", text: session.notes },
    ],
  });
}

async function detail(id) {
  const session = await api.get(`/api/dialysis/sessions/${id}`);
  const patient = await api.get(`/api/patients/${session.patient_id}`);
  const chart = h("div");
  const loadChart = async () => {
    const readings = await api.get("/api/dialysis/readings", { session_id: id });
    mount(chart, lineChart(readings.map((r) => r.time), bpSeries(readings)));
  };
  const transition = (action, message) => async () => {
    await api.post(`/api/dialysis/sessions/${id}/${action}`);
    toast(message, "success");
    refresh();
  };
  const actions = h(
    "div",
    { class: "toolbar" },
    h("button", { class: "btn", onClick: () => navigate("dialysis") }, "Back"),
    h("button", { class: "btn", onClick: () => printFlowsheet(id) }, "Print flowsheet"),
    session.status === "Scheduled" && h("button", { class: "btn primary", onClick: transition("start", "Session started") }, "Start session"),
    session.status === "InProgress" && h("button", { class: "btn primary", onClick: transition("complete", "Session completed") }, "Complete session")
  );
  loadChart();
  return page(
    "Dialysis session",
    h("section", { class: "panel" }, h("div", { class: "panel-head" }, h("div", {}, h("h2", {}, patient.name), h("p", { class: "muted" }, `${patient.mrn} · ${fmtDate(session.date)} · ${session.shift} · ${session.machine_label || "No machine"} · ${session.status}`)), actions)),
    h(
      "section",
      { class: "panel" },
      h("h2", {}, "Session details"),
      buildForm(SESSION_FIELDS, session, {
        submitLabel: "Save details",
        onSubmit: async (data) => {
          await api.put(`/api/dialysis/sessions/${id}`, data);
          toast("Saved", "success");
        },
      })
    ),
    h(
      "section",
      { class: "panel" },
      crudPanel({
        path: "/api/dialysis/readings",
        noun: "reading",
        title: "Flowsheet readings",
        searchable: false,
        fixed: { session_id: Number(id) },
        defaults: { time: nowTime() },
        fields: READING_FIELDS,
        columns: READING_COLUMNS,
        canCreate: session.status === "InProgress",
        onChange: loadChart,
      }),
      chart
    )
  );
}

export default (arg) =>
  arg
    ? detail(arg)
    : page("Dialysis Unit", tabs([{ label: "Sessions", render: sessionList }, { label: "Schedules", render: scheduleList }]));

import { api } from "../api.js";
import { navigate, refresh } from "../router.js";
import { clinicalPanels } from "../ui/clinical.js";
import { crudPanel } from "../ui/crud.js";
import { showDocument } from "../ui/document.js";
import { h, mount, page } from "../ui/dom.js";
import { buildForm } from "../ui/form.js";
import { age, fmtDate, fmtDateTime, personName } from "../ui/format.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { tabs } from "../ui/tabs.js";
import { toast } from "../ui/toast.js";
import { patientMeta, prescriptionTable } from "./opd.js";

const SUMMARY_FIELDS = [
  { name: "final_diagnosis", label: "Final diagnosis", type: "textarea", full: true },
  { name: "course", label: "Course in hospital", type: "textarea", full: true },
  { name: "procedures", label: "Procedures performed", type: "textarea", full: true },
  { name: "medications", label: "Medications on discharge", type: "textarea", full: true },
  { name: "advice", label: "Advice", type: "textarea", full: true },
  { name: "condition", label: "Condition at discharge", type: "select", options: ["Stable", "Improved", "Critical", "LAMA", "Expired"] },
  { name: "followup_date", label: "Follow-up on", type: "date" },
];

const ADMIT_FIELDS = [
  { name: "patient_id", label: "Patient", type: "patient", required: true },
  { name: "doctor_id", label: "Doctor", type: "select", source: "doctors", required: true },
  { name: "reason", label: "Reason for admission", type: "textarea", full: true },
];

const submitAndRefresh = (close, request, message) => async (data) => {
  await request(data);
  close();
  toast(message, "success");
  refresh();
};

function admitForm(bed) {
  openModal(`Admit to ${bed.code}`, (close) =>
    buildForm(ADMIT_FIELDS, {}, {
      submitLabel: "Admit",
      onCancel: close,
      onSubmit: submitAndRefresh(close, (data) => api.post("/api/ipd/admissions", { ...data, bed_id: bed.id }), "Patient admitted"),
    })
  );
}

function transferForm(admission, wards) {
  const options = wards.flatMap((ward) => ward.beds.filter((b) => b.status === "Vacant").map((b) => ({ value: b.id, label: `${ward.name} · ${b.code}` })));
  openModal("Transfer patient", (close) =>
    buildForm([{ name: "bed_id", label: "New bed", type: "select", options, required: true }], {}, {
      submitLabel: "Transfer",
      onCancel: close,
      onSubmit: submitAndRefresh(close, (data) => api.post(`/api/ipd/admissions/${admission.id}/transfer`, data), "Patient transferred"),
    })
  );
}

async function discharge(admission) {
  if (await confirmDialog(`Discharge ${personName(admission.patient_label)}?`, "Discharge")) {
    await api.post(`/api/ipd/admissions/${admission.id}/discharge`);
    toast("Patient discharged", "success");
    navigate(`ipd/${admission.id}`);
  }
}

const bedStatus = (bed, status) => async () => {
  await api.post(`/api/ipd/beds/${bed.id}/status`, { status });
  refresh();
};

function bedDialog(bed, wards) {
  const admission = bed.admission;
  openModal(`Bed ${bed.code} · ${bed.status}`, (close) => {
    const run = (fn) => () => (close(), fn());
    const buttons = {
      Vacant: [
        ["Admit patient", () => admitForm(bed), "primary"],
        ["Block bed", bedStatus(bed, "Blocked")],
      ],
      Cleaning: [["Mark vacant", bedStatus(bed, "Vacant"), "primary"]],
      Blocked: [["Unblock", bedStatus(bed, "Vacant"), "primary"]],
      Occupied: [
        ["Open chart", () => navigate(`ipd/${admission.id}`), "primary"],
        ["Transfer", () => transferForm(admission, wards)],
        ["Discharge", () => discharge(admission)],
      ],
    }[bed.status];
    return h(
      "div",
      {},
      admission && h("p", {}, `${admission.patient_label} · ${admission.doctor_label} · admitted ${fmtDateTime(admission.admit_date)}`),
      h("div", { class: "form-actions" }, buttons.map(([label, fn, cls = ""]) => h("button", { class: `btn ${cls}`, onClick: run(fn) }, label)))
    );
  });
}

const bedTile = (bed, wards) =>
  h(
    "button",
    { class: `bed s-${bed.status.toLowerCase()}`, onClick: () => bedDialog(bed, wards) },
    h("strong", {}, bed.code),
    h("span", {}, bed.admission ? personName(bed.admission.patient_label) : bed.status)
  );

function wardBoard() {
  const body = h("div", { class: "board" });
  async function load() {
    const wards = await api.get("/api/ipd/board");
    mount(
      body,
      wards.map((ward) => {
        const occupied = ward.beds.filter((b) => b.status === "Occupied").length;
        return h(
          "section",
          { class: "panel" },
          h("div", { class: "panel-head" }, h("h2", {}, ward.name), h("span", { class: "muted" }, `${occupied} / ${ward.beds.length} occupied`)),
          h("div", { class: "beds" }, ward.beds.map((bed) => bedTile(bed, wards)))
        );
      }),
      h("div", { class: "legend" }, ["Vacant", "Occupied", "Cleaning", "Blocked"].map((s) => h("span", {}, h("i", { class: `s-${s.toLowerCase()}` }), s)))
    );
  }
  const timer = setInterval(() => (body.isConnected ? load() : clearInterval(timer)), 15000);
  load();
  return body;
}

const admissionList = () =>
  crudPanel({
    path: "/api/ipd/admissions",
    noun: "admission",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    filters: [{ name: "status", label: "Status", type: "select", options: ["Admitted", "Discharged"], default: "Admitted" }],
    columns: [["adm_no", "Adm no"], ["patient_id", "Patient"], ["doctor_id", "Doctor"], ["bed_id", "Bed"], ["admit_date", "Admitted", "datetime"], ["discharge_date", "Discharged", "datetime"], ["status", "Status", "badge"]],
    rowActions: [{ label: "Open", class: "primary", onClick: (row) => navigate(`ipd/${row.id}`) }],
  });

async function printSummary(id) {
  const data = await api.get(`/api/ipd/admissions/${id}/summary`);
  const record = data.summary || {};
  showDocument({
    title: "Discharge Summary",
    meta: [
      ...patientMeta(data.patient),
      ["Admission no", data.admission.adm_no],
      ["Doctor", data.admission.doctor_label],
      ["Admitted", fmtDateTime(data.admission.admit_date)],
      ["Discharged", fmtDateTime(data.admission.discharge_date)],
      ["Condition", record.condition],
    ],
    sections: [
      { heading: "Reason for admission", text: data.admission.reason },
      { heading: "Final diagnosis", text: record.final_diagnosis },
      { heading: "Diagnoses (ICD-10)", table: { columns: [["icd_code", "ICD-10"], ["description", "Description"], ["kind", "Type"]], rows: data.diagnoses } },
      { heading: "Course in hospital", text: record.course },
      { heading: "Procedures", text: record.procedures },
      { heading: "Investigations", table: { columns: [["test_id", "Test"], ["result_value", "Result"], ["flag", "Flag"]], rows: data.lab_orders.filter((o) => o.status === "Resulted") } },
      { heading: "Medications in hospital", table: prescriptionTable(data.prescriptions) },
      { heading: "Medications on discharge", text: record.medications },
      { heading: "Advice", text: record.advice },
      { heading: "Follow-up", text: record.followup_date ? fmtDate(record.followup_date) : "" },
    ],
  });
}

async function summaryEditor(id) {
  const { summary } = await api.get(`/api/ipd/admissions/${id}/summary`);
  return h(
    "div",
    {},
    buildForm(SUMMARY_FIELDS, summary || {}, {
      submitLabel: "Save summary",
      onSubmit: async (data) => {
        await api.put(`/api/ipd/admissions/${id}/summary`, data);
        toast("Summary saved", "success");
      },
    }),
    h("div", { class: "form-actions" }, h("button", { class: "btn", onClick: () => printSummary(id) }, "Print discharge summary"))
  );
}

async function detail(id) {
  const admission = await api.get(`/api/ipd/admissions/${id}`);
  const patient = await api.get(`/api/patients/${admission.patient_id}`);
  const active = admission.status === "Admitted";
  const actions = h(
    "div",
    { class: "toolbar" },
    h("button", { class: "btn", onClick: () => navigate("ipd") }, "Back"),
    active && h("button", { class: "btn", onClick: async () => transferForm(admission, await api.get("/api/ipd/board")) }, "Transfer"),
    active && h("button", { class: "btn danger", onClick: () => discharge(admission) }, "Discharge")
  );
  return page(
    `Admission ${admission.adm_no}`,
    h(
      "section",
      { class: "panel" },
      h(
        "div",
        { class: "panel-head" },
        h("div", {}, h("h2", {}, patient.name), h("p", { class: "muted" }, `${patient.mrn} · ${age(patient.dob)} ${patient.gender} · ${admission.doctor_label} · bed ${admission.bed_label} · ${admission.status}`)),
        actions
      )
    ),
    h(
      "section",
      { class: "panel" },
      tabs([
        { label: "Clinical", render: () => clinicalPanels({ patient_id: patient.id, ref_type: "IPD", ref_id: Number(id), readonly: !active }) },
        { label: "Discharge summary", render: () => summaryEditor(id) },
      ])
    )
  );
}

export default (arg) =>
  arg
    ? detail(arg)
    : page(
        "Ward Board & IPD",
        tabs([
          { label: "Ward board", render: wardBoard },
          { label: "Admissions", render: admissionList },
        ])
      );

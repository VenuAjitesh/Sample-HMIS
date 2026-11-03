import { api } from "../api.js";
import { navigate, refresh } from "../router.js";
import { clinicalPanels } from "../ui/clinical.js";
import { crudPanel } from "../ui/crud.js";
import { showDocument } from "../ui/document.js";
import { h, page } from "../ui/dom.js";
import { buildForm } from "../ui/form.js";
import { age, fmtDate } from "../ui/format.js";
import { toast } from "../ui/toast.js";

const NOTE_FIELDS = [
  { name: "complaint", label: "Presenting complaint", type: "textarea", full: true },
  { name: "examination", label: "Examination", type: "textarea", full: true },
  { name: "assessment", label: "Assessment", type: "textarea", full: true },
  { name: "plan", label: "Plan / advice", type: "textarea", full: true },
  { name: "followup_date", label: "Follow-up on", type: "date" },
];

export const patientMeta = (patient) => [
  ["Patient", patient.name],
  ["MRN", patient.mrn],
  ["Age / Sex", `${age(patient.dob)} / ${patient.gender}`],
  ["Phone", patient.phone],
];

export const prescriptionTable = (rows) => ({
  columns: [["drug_id", "Drug"], ["dose", "Dose"], ["frequency", "Frequency"], ["duration", "Duration"], ["qty", "Qty"]],
  rows,
});

async function printSummary(id) {
  const data = await api.get(`/api/opd/consultations/${id}/summary`);
  const note = data.consultation;
  showDocument({
    title: "OPD Consultation Summary",
    meta: [...patientMeta(data.patient), ["Doctor", note.doctor_label], ["Date", fmtDate(note.created_at)]],
    sections: [
      { heading: "Presenting complaint", text: note.complaint },
      { heading: "Examination", text: note.examination },
      { heading: "Vitals", table: { columns: [["bp_sys", "Sys"], ["bp_dia", "Dia"], ["pulse", "Pulse"], ["temp", "Temp"], ["spo2", "SpO₂"], ["weight", "Wt"]], rows: data.vitals } },
      { heading: "Diagnosis", table: { columns: [["icd_code", "ICD-10"], ["description", "Description"], ["kind", "Type"]], rows: data.diagnoses } },
      { heading: "Prescription", table: prescriptionTable(data.prescriptions) },
      { heading: "Plan / advice", text: note.plan },
      { heading: "Follow-up", text: note.followup_date ? fmtDate(note.followup_date) : "" },
    ],
  });
}

async function detail(id) {
  const consultation = await api.get(`/api/opd/consultations/${id}`);
  const patient = await api.get(`/api/patients/${consultation.patient_id}`);
  const open = consultation.status === "Open";
  const actions = h(
    "div",
    { class: "toolbar" },
    h("button", { class: "btn", onClick: () => navigate("opd") }, "Back"),
    h("button", { class: "btn", onClick: () => printSummary(id) }, "Print summary"),
    open &&
      h(
        "button",
        {
          class: "btn primary",
          onClick: async () => {
            await api.post(`/api/opd/consultations/${id}/complete`);
            toast("Consultation completed", "success");
            refresh();
          },
        },
        "Complete consultation"
      )
  );
  const note = buildForm(NOTE_FIELDS, consultation, {
    submitLabel: "Save note",
    onSubmit: async (data) => {
      await api.put(`/api/opd/consultations/${id}`, data);
      toast("Note saved", "success");
    },
  });
  return page(
    "Consultation",
    h("section", { class: "panel" }, h("div", { class: "panel-head" }, h("div", {}, h("h2", {}, patient.name), h("p", { class: "muted" }, `${patient.mrn} · ${age(patient.dob)} ${patient.gender} · ${consultation.doctor_label} · ${consultation.status}`)), actions)),
    h("section", { class: "panel" }, h("h2", {}, "Consultation note"), note),
    h("section", { class: "panel" }, clinicalPanels({ patient_id: patient.id, ref_type: "OPD", ref_id: Number(id), readonly: !open }))
  );
}

export default (arg) =>
  arg
    ? detail(arg)
    : page(
        "Consultations",
        crudPanel({
          path: "/api/opd/consultations",
          noun: "consultation",
          canCreate: false,
          canEdit: false,
          canDelete: false,
          columns: [["created_at", "Date", "datetime"], ["patient_id", "Patient"], ["doctor_id", "Doctor"], ["complaint", "Complaint"], ["status", "Status", "badge"]],
          rowActions: [{ label: "Open", class: "primary", onClick: (row) => navigate(`opd/${row.id}`) }],
        })
      );

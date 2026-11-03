import { crudPanel } from "./crud.js";
import { tabs } from "./tabs.js";

const VITALS_FIELDS = [
  { name: "bp_sys", label: "BP systolic", type: "number" },
  { name: "bp_dia", label: "BP diastolic", type: "number" },
  { name: "pulse", label: "Pulse", type: "number" },
  { name: "temp", label: "Temp (°C)", type: "number" },
  { name: "spo2", label: "SpO₂ %", type: "number" },
  { name: "weight", label: "Weight (kg)", type: "number" },
  { name: "height", label: "Height (cm)", type: "number" },
];

const DIAGNOSIS_FIELDS = [
  { name: "icd_code", label: "ICD-10", type: "select", source: "icd", required: true, full: true },
  { name: "kind", label: "Type", type: "select", options: ["Primary", "Secondary"] },
];

const PRESCRIPTION_FIELDS = [
  { name: "drug_id", label: "Drug", type: "select", source: "drugs", required: true },
  { name: "dose", label: "Dose" },
  { name: "frequency", label: "Frequency" },
  { name: "duration", label: "Duration" },
  { name: "qty", label: "Quantity", type: "number", required: true },
];

export const LAB_ORDER_COLUMNS = [
  ["ordered_at", "Ordered", "datetime"],
  ["patient_id", "Patient"],
  ["test_id", "Test"],
  ["status", "Status", "badge"],
  ["result_value", "Result"],
  { key: "flag", label: "Flag", render: (row) => (row.flag ? row.flag : "") },
];

export function clinicalPanels({ patient_id, ref_type, ref_id, readonly = false }) {
  const scope = { patient_id, ref_type, ref_id };
  const panel = (path, noun, columns, fields, extra = {}) => () =>
    crudPanel({ path, noun, columns, fields, fixed: scope, searchable: false, canCreate: !readonly, canEdit: !readonly, canDelete: !readonly, ...extra });

  return tabs([
    {
      label: "Vitals",
      render: panel(
        "/api/clinical/vitals",
        "vitals entry",
        [["created_at", "Recorded", "datetime"], ["bp_sys", "Sys"], ["bp_dia", "Dia"], ["pulse", "Pulse"], ["temp", "Temp"], ["spo2", "SpO₂"], ["weight", "Wt"], ["height", "Ht"]],
        VITALS_FIELDS
      ),
    },
    {
      label: "Diagnoses",
      render: panel("/api/clinical/diagnoses", "diagnosis", [["icd_code", "ICD-10"], ["description", "Description"], ["kind", "Type"]], DIAGNOSIS_FIELDS, { canEdit: false }),
    },
    {
      label: "Prescriptions",
      render: panel(
        "/api/clinical/prescriptions",
        "prescription",
        [["drug_id", "Drug"], ["dose", "Dose"], ["frequency", "Frequency"], ["duration", "Duration"], ["qty", "Qty"], ["dispensed", "Dispensed", "bool"]],
        PRESCRIPTION_FIELDS
      ),
    },
    {
      label: "Lab orders",
      render: panel(
        "/api/lab/orders",
        "lab order",
        LAB_ORDER_COLUMNS.slice(2),
        [{ name: "test_id", label: "Test", type: "select", source: "tests", required: true }],
        { canEdit: false, canDelete: false }
      ),
    },
  ]);
}

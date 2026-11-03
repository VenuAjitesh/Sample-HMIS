import { api } from "../api.js";
import { crudPanel } from "../ui/crud.js";
import { page } from "../ui/dom.js";
import { age } from "../ui/format.js";
import { openModal } from "../ui/modal.js";
import { table } from "../ui/table.js";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const PATIENT_FIELDS = [
  { name: "name", label: "Full name", required: true },
  { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
  { name: "dob", label: "Date of birth", type: "date" },
  { name: "phone", label: "Phone" },
  { name: "blood_group", label: "Blood group", type: "select", options: BLOOD_GROUPS },
  { name: "address", label: "Address", type: "textarea", full: true },
];

export async function showHistory(patient) {
  const events = await api.get(`/api/patients/${patient.id}/history`);
  openModal(`History · ${patient.name}`, table([["type", "Type"], ["date", "Date"], ["summary", "Summary"]], events, { empty: "No history yet" }), { wide: true });
}

export default () =>
  page(
    "Patients",
    crudPanel({
      path: "/api/patients",
      noun: "patient",
      params: { active: true },
      fields: PATIENT_FIELDS,
      columns: [
        ["mrn", "MRN"],
        ["name", "Name"],
        ["gender", "Gender"],
        { key: "dob", label: "Age", render: (row) => age(row.dob) },
        ["phone", "Phone"],
        ["blood_group", "Blood"],
        ["created_at", "Registered", "datetime"],
      ],
      rowActions: [{ label: "History", onClick: showHistory }],
    })
  );

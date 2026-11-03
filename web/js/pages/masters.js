import { crudPanel } from "../ui/crud.js";
import { page } from "../ui/dom.js";
import { tabs } from "../ui/tabs.js";

const name = { name: "name", label: "Name", required: true };
const rate = (label = "Rate") => ({ name: "rate", label, type: "number" });

const MASTERS = [
  { path: "departments", label: "Departments", noun: "department", fields: [name], columns: [["name", "Name"]] },
  {
    path: "doctors", label: "Doctors", noun: "doctor",
    fields: [name, { name: "department_id", label: "Department", type: "select", source: "departments" }, { name: "qualification", label: "Qualification" }],
    columns: [["name", "Name"], ["department_id", "Department"], ["qualification", "Qualification"]],
  },
  {
    path: "services", label: "Services & tariff", noun: "service",
    fields: [{ name: "code", label: "Code", required: true }, name, { name: "category", label: "Category" }, rate()],
    columns: [["code", "Code"], ["name", "Name"], ["category", "Category"], ["rate", "Rate", "money"]],
  },
  {
    path: "drugs", label: "Drugs", noun: "drug",
    fields: [name, { name: "generic", label: "Generic name" }, { name: "unit", label: "Unit" }, rate(), { name: "reorder_level", label: "Reorder level", type: "number" }],
    columns: [["name", "Name"], ["generic", "Generic"], ["unit", "Unit"], ["rate", "Rate", "money"], ["reorder_level", "Reorder"]],
  },
  {
    path: "lab-tests", label: "Lab tests", noun: "lab test",
    fields: [name, { name: "unit", label: "Unit" }, { name: "ref_low", label: "Reference low", type: "number" }, { name: "ref_high", label: "Reference high", type: "number" }, rate()],
    columns: [["name", "Name"], ["unit", "Unit"], ["ref_low", "Low"], ["ref_high", "High"], ["rate", "Rate", "money"]],
  },
  { path: "wards", label: "Wards", noun: "ward", fields: [name, { name: "bed_rate", label: "Bed rate / day", type: "number" }], columns: [["name", "Name"], ["bed_rate", "Bed rate", "money"]] },
  {
    path: "beds", label: "Beds", noun: "bed",
    fields: [{ name: "ward_id", label: "Ward", type: "select", source: "wards", required: true }, { name: "code", label: "Bed code", required: true }],
    columns: [["ward_id", "Ward"], ["code", "Code"], ["status", "Status", "badge"]],
  },
  { path: "machines", label: "Dialysis machines", noun: "machine", fields: [name], columns: [["name", "Name"], ["status", "Status", "badge"]] },
  { path: "payment-modes", label: "Payment modes", noun: "payment mode", fields: [name], columns: [["name", "Name"]] },
  {
    path: "icd10", label: "ICD-10 codes", noun: "ICD-10 code",
    fields: [{ name: "code", label: "Code", required: true }, { name: "description", label: "Description", required: true, full: true }],
    columns: [["code", "Code"], ["description", "Description"]],
  },
];

export default () =>
  page(
    "Master Data",
    tabs(
      MASTERS.map(({ path, label, ...rest }) => ({
        label,
        render: () => crudPanel({ path: `/api/masters/${path}`, params: { active: true }, refreshesOptions: true, ...rest }),
      }))
    )
  );

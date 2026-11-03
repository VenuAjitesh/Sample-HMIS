import { api } from "../api.js";
import { lineChart } from "../ui/chart.js";
import { crudPanel } from "../ui/crud.js";
import { h, page } from "../ui/dom.js";
import { fmtDate, personName, today } from "../ui/format.js";
import { openModal } from "../ui/modal.js";

const FIELDS = [
  { name: "patient_id", label: "Patient", type: "patient", required: true },
  { name: "date", label: "Date", type: "date", required: true },
  { name: "service_id", label: "Package", type: "select", source: "services" },
  { name: "height", label: "Height (cm)", type: "number" },
  { name: "weight", label: "Weight (kg)", type: "number" },
  { name: "bp_sys", label: "BP systolic", type: "number" },
  { name: "bp_dia", label: "BP diastolic", type: "number" },
  { name: "glucose", label: "Glucose (mg/dL)", type: "number" },
  { name: "cholesterol", label: "Cholesterol (mg/dL)", type: "number" },
  { name: "notes", label: "Notes", type: "textarea", full: true },
];

async function showTrend(row) {
  const records = (await api.get("/api/wellness/records", { patient_id: row.patient_id })).reverse();
  const labels = records.map((r) => fmtDate(r.date));
  const chart = (title, series) => h("div", {}, h("h4", {}, title), lineChart(labels, series));
  openModal(`Trends · ${personName(row.patient_label)}`, h("div", {},
    chart("Weight & BMI", [{ name: "Weight (kg)", values: records.map((r) => r.weight) }, { name: "BMI", values: records.map((r) => r.bmi) }]),
    chart("Blood pressure", [{ name: "Systolic", values: records.map((r) => r.bp_sys) }, { name: "Diastolic", values: records.map((r) => r.bp_dia) }]),
    chart("Glucose & cholesterol", [{ name: "Glucose", values: records.map((r) => r.glucose) }, { name: "Cholesterol", values: records.map((r) => r.cholesterol) }])
  ), { wide: true });
}

export default () =>
  page(
    "Wellness Records",
    crudPanel({
      path: "/api/wellness/records",
      noun: "wellness record",
      defaults: { date: today() },
      fields: FIELDS,
      columns: [["date", "Date", "date"], ["patient_id", "Patient"], ["service_id", "Package"], ["bmi", "BMI"], { key: "bp", label: "BP", render: (r) => (r.bp_sys ? `${r.bp_sys}/${r.bp_dia}` : "") }, ["glucose", "Glucose"], ["cholesterol", "Cholesterol"]],
      rowActions: [{ label: "Trend", onClick: showTrend }],
    })
  );

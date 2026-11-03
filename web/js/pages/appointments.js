import { api } from "../api.js";
import { navigate } from "../router.js";
import { crudPanel } from "../ui/crud.js";
import { h, mount, page } from "../ui/dom.js";
import { fieldRow, makeInput } from "../ui/form.js";
import { today } from "../ui/format.js";
import { table } from "../ui/table.js";

const STATUSES = ["Booked", "Waiting", "InConsultation", "Done", "Cancelled"];

const setStatus = (status) => async (row, reload) => {
  await api.post(`/api/appointments/${row.id}/status`, { status });
  reload();
};

export const appointments = () =>
  page(
    "Appointments",
    crudPanel({
      path: "/api/appointments",
      noun: "appointment",
      searchable: false,
      canDelete: false,
      defaults: { date: today() },
      filters: [
        { name: "date", label: "Date", type: "date", default: today() },
        { name: "doctor_id", label: "Doctor", type: "select", source: "doctors" },
        { name: "status", label: "Status", type: "select", options: STATUSES },
      ],
      fields: [
        { name: "patient_id", label: "Patient", type: "patient", required: true },
        { name: "doctor_id", label: "Doctor", type: "select", source: "doctors", required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "slot", label: "Slot", type: "time" },
        { name: "reason", label: "Reason", type: "textarea", full: true },
      ],
      columns: [["token", "Token"], ["date", "Date", "date"], ["slot", "Slot"], ["patient_id", "Patient"], ["doctor_id", "Doctor"], ["reason", "Reason"], ["status", "Status", "badge"]],
      rowActions: [
        {
          label: "Check-in",
          show: (row) => row.status === "Booked",
          onClick: async (row, reload) => {
            await api.post(`/api/appointments/${row.id}/checkin`);
            reload();
          },
        },
        { label: "Cancel", show: (row) => ["Booked", "Waiting"].includes(row.status), onClick: setStatus("Cancelled") },
      ],
    })
  );

async function openConsultation(row) {
  const existing = await api.get("/api/opd/consultations", { appointment_id: row.id });
  const consultation =
    existing[0] ||
    (await api.post("/api/opd/consultations", { appointment_id: row.id, patient_id: row.patient_id, doctor_id: row.doctor_id }));
  navigate(`opd/${consultation.id}`);
}

export function queue() {
  const body = h("div");
  const doctor = makeInput({ name: "doctor_id", type: "select", source: "doctors" }, null, () => load());
  const day = makeInput({ name: "date", type: "date" }, today(), () => load());

  async function load() {
    const rows = await api.get("/api/appointments/queue", { date: day.read(), doctor_id: doctor.read() });
    mount(
      body,
      table([["token", "Token"], ["patient_id", "Patient"], ["doctor_id", "Doctor"], ["slot", "Slot"], ["reason", "Reason"], ["status", "Status", "badge"]], rows, {
        empty: "Queue is empty",
        actions: [
          { label: "Consult", class: "primary", onClick: openConsultation },
          { label: "Done", show: (row) => row.status === "InConsultation", onClick: async (row) => (await setStatus("Done")(row, load)) },
        ],
      })
    );
  }

  const root = page(
    "OPD Queue",
    h("section", { class: "panel" }, h("div", { class: "filters" }, fieldRow({ label: "Date" }, day), fieldRow({ label: "Doctor" }, doctor)), body)
  );
  const timer = setInterval(() => (root.isConnected ? load() : clearInterval(timer)), 10000);
  load();
  return root;
}

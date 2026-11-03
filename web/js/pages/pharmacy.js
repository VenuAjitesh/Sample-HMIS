import { api } from "../api.js";
import { crudPanel } from "../ui/crud.js";
import { h, mount, page } from "../ui/dom.js";
import { buildForm } from "../ui/form.js";
import { openModal } from "../ui/modal.js";
import { table } from "../ui/table.js";
import { tabs } from "../ui/tabs.js";
import { toast } from "../ui/toast.js";

const RECEIVE_FIELDS = [
  { name: "drug_id", label: "Drug", type: "select", source: "drugs", required: true },
  { name: "batch_no", label: "Batch no", required: true },
  { name: "expiry", label: "Expiry", type: "date", required: true },
  { name: "qty", label: "Quantity", type: "number", required: true },
  { name: "purchase_rate", label: "Purchase rate", type: "number" },
  { name: "mrp", label: "MRP", type: "number" },
];

const SALE_FIELDS = [
  { name: "patient_id", label: "Patient", type: "patient", required: true },
  { name: "drug_id", label: "Drug", type: "select", source: "drugs", required: true },
  { name: "qty", label: "Quantity", type: "number", required: true },
];

const stockFlags = (row) =>
  h("span", {}, row.low && h("span", { class: "badge s-low" }, "Low"), " ", row.expiring && h("span", { class: "badge s-expiring" }, "Expiring"));

function stockView() {
  const body = h("div");
  const load = async () => {
    const rows = await api.get("/api/pharmacy/stock");
    mount(body, table([["drug_label", "Drug"], ["unit", "Unit"], ["qty", "On hand"], ["reorder_level", "Reorder at"], ["nearest_expiry", "Nearest expiry", "date"], { key: "flags", label: "Alerts", render: stockFlags }], rows));
  };
  const receive = () =>
    openModal("Receive stock", (close) =>
      buildForm(RECEIVE_FIELDS, {}, {
        submitLabel: "Receive",
        onCancel: close,
        onSubmit: async (data) => {
          await api.post("/api/pharmacy/receive", data);
          close();
          toast("Stock received", "success");
          load();
        },
      })
    );
  load();
  return h("section", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", {}, "Stock on hand"), h("button", { class: "btn primary", onClick: receive }, "Receive stock")), body);
}

const pendingView = () =>
  crudPanel({
    path: "/api/clinical/prescriptions",
    noun: "prescription",
    title: "Pending prescriptions",
    params: { dispensed: false },
    searchable: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    columns: [["created_at", "Prescribed", "datetime"], ["patient_id", "Patient"], ["ref_type", "From"], ["drug_id", "Drug"], ["dose", "Dose"], ["frequency", "Frequency"], ["qty", "Qty"]],
    rowActions: [
      {
        label: "Dispense",
        class: "primary",
        onClick: async (row, reload) => {
          await api.post("/api/pharmacy/dispense", { patient_id: row.patient_id, prescription_id: row.id, items: [{ drug_id: row.drug_id, qty: row.qty }] });
          toast("Dispensed", "success");
          reload();
        },
      },
    ],
  });

const counterSale = () =>
  h(
    "section",
    { class: "panel" },
    h("h2", {}, "Counter sale"),
    buildForm(SALE_FIELDS, { qty: 1 }, {
      submitLabel: "Dispense",
      onSubmit: async ({ patient_id, drug_id, qty }) => {
        await api.post("/api/pharmacy/dispense", { patient_id, items: [{ drug_id, qty }] });
        toast("Dispensed and charged to patient", "success");
      },
    })
  );

const readOnly = { canCreate: false, canEdit: false, canDelete: false, searchable: false };

export default () =>
  page(
    "Pharmacy",
    tabs([
      { label: "Stock", render: stockView },
      { label: "Pending prescriptions", render: pendingView },
      { label: "Counter sale", render: counterSale },
      {
        label: "Batches",
        render: () => crudPanel({ ...readOnly, path: "/api/pharmacy/batches", noun: "batch", params: { qty__gte: 1 }, columns: [["drug_id", "Drug"], ["batch_no", "Batch"], ["expiry", "Expiry", "date"], ["qty", "Qty"], ["purchase_rate", "Cost", "money"], ["mrp", "MRP", "money"]] }),
      },
      {
        label: "Ledger",
        render: () => crudPanel({ ...readOnly, path: "/api/pharmacy/ledger", noun: "entry", params: { limit: 200 }, columns: [["created_at", "When", "datetime"], ["drug_id", "Drug"], ["kind", "Type"], ["qty_change", "Change"], ["ref_type", "Ref"], ["ref_id", "Ref no"]] }),
      },
    ])
  );

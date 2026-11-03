import { api, config } from "../api.js";
import { crudPanel } from "../ui/crud.js";
import { documentView, showDocument } from "../ui/document.js";
import { h, mount, page } from "../ui/dom.js";
import { buildForm, fieldRow, makeInput } from "../ui/form.js";
import { age, fmtDate, fmtDateTime, money } from "../ui/format.js";
import { openModal } from "../ui/modal.js";
import { table } from "../ui/table.js";
import { tabs } from "../ui/tabs.js";
import { toast } from "../ui/toast.js";

const CHARGE_COLUMNS = [["category", "Category"], ["description", "Description"], ["qty", "Qty"], ["rate", "Rate", "money"], ["amount", "Amount", "money"]];

const patientRows = (patient) => [["Patient", patient.name], ["MRN", patient.mrn], ["Age / Sex", `${age(patient.dob)} / ${patient.gender}`]];

function billDocument(bill) {
  return {
    title: "Bill",
    meta: [...patientRows(bill.patient), ["Bill no", bill.bill_no], ["Date", fmtDateTime(bill.created_at)]],
    sections: [
      { heading: "Charges", table: { columns: CHARGE_COLUMNS, rows: bill.charges } },
      {
        heading: "Summary",
        rows: [["Total", money(bill.total)], ["Discount", money(bill.discount)], ["Net payable", money(bill.net)], ["Paid", money(bill.paid)], ["Balance due", money(bill.due)]],
      },
      { heading: "Payments", table: { columns: [["receipt_no", "Receipt"], ["created_at", "Date", "datetime"], ["mode_id", "Mode"], ["amount", "Amount", "money"]], rows: bill.payments } },
    ],
  };
}

async function printReceipt(paymentId) {
  const { payment, bill, patient } = await api.get(`/api/billing/payments/${paymentId}/receipt`);
  showDocument({
    title: "Payment Receipt",
    meta: [...patientRows(patient), ["Receipt no", payment.receipt_no], ["Date", fmtDateTime(payment.created_at)]],
    sections: [
      {
        rows: [
          ["Against bill", bill.bill_no],
          ["Payment mode", payment.mode_label || "—"],
          ["Amount received", money(payment.amount)],
          ["Bill net", money(bill.net)],
          ["Total paid", money(bill.paid)],
          ["Balance due", money(bill.due)],
        ],
      },
    ],
  });
}

async function openBill(row, reload) {
  const bill = await api.get(`/api/billing/bills/${row.id}`);
  const { facility } = await config();
  openModal(`Bill ${bill.bill_no} · ${bill.status}`, (close) => {
    const payment =
      bill.due > 0 &&
      h(
        "div",
        { class: "no-print" },
        h("h4", {}, "Receive payment"),
        buildForm(
          [
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "mode_id", label: "Mode", type: "select", source: "modes", required: true },
          ],
          { amount: bill.due },
          {
            submitLabel: "Collect & issue receipt",
            onSubmit: async (data) => {
              const saved = await api.post(`/api/billing/bills/${bill.id}/payments`, data);
              close();
              toast("Payment recorded", "success");
              reload();
              printReceipt(saved.id);
            },
          }
        )
      );
    return h("div", {}, documentView({ ...billDocument(bill), facility }), payment, h("div", { class: "form-actions no-print" }, h("button", { class: "btn", onClick: () => window.print() }, "Print bill")));
  }, { wide: true });
}

function newBill(reload) {
  openModal("New bill", (close) => {
    const patient = makeInput({ name: "patient_id", type: "patient" }, null, null, {});
    const discount = makeInput({ name: "discount", type: "number" }, 0);
    const area = h("div");
    const charge = buildForm(
      [{ name: "description", label: "Description", required: true }, { name: "rate", label: "Rate", type: "number", required: true }, { name: "qty", label: "Qty", type: "number" }],
      { qty: 1 },
      {
        submitLabel: "Add charge",
        onSubmit: async (data) => {
          await api.post("/api/billing/charges", { ...data, qty: data.qty || 1, patient_id: patient.read(), category: "Manual" });
          load();
        },
      }
    );

    async function load() {
      const patientId = patient.read();
      if (!patientId) return toast("Select a patient first", "error");
      const charges = await api.get("/api/billing/charges/unbilled", { patient_id: patientId });
      const total = charges.reduce((sum, c) => sum + c.amount, 0);
      mount(
        area,
        table(CHARGE_COLUMNS, charges, { empty: "No unbilled charges" }),
        h("p", {}, `Total: ${money(total)}`),
        fieldRow({ label: "Discount" }, discount),
        h("h4", {}, "Add manual charge"),
        charge,
        h("div", { class: "form-actions" }, h("button", {
          class: "btn primary",
          disabled: !charges.length,
          onClick: async () => {
            const bill = await api.post("/api/billing/bills", { patient_id: patientId, discount: discount.read() || 0 });
            close();
            toast(`Bill ${bill.bill_no} created`, "success");
            reload();
            openBill(bill, reload);
          },
        }, "Generate bill"))
      );
    }

    return h("div", {}, fieldRow({ label: "Patient" }, patient), h("div", { class: "form-actions" }, h("button", { class: "btn", onClick: load }, "Load unbilled charges")), area);
  }, { wide: true });
}

const bills = () =>
  crudPanel({
    path: "/api/billing/bills",
    noun: "bill",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    searchable: false,
    filters: [{ name: "status", label: "Status", type: "select", options: ["Unpaid", "Partial", "Paid"] }],
    toolbar: [{ label: "New bill", onClick: (reload) => newBill(reload) }],
    columns: [["bill_no", "Bill no"], ["created_at", "Date", "datetime"], ["patient_id", "Patient"], ["net", "Net", "money"], ["paid", "Paid", "money"], ["due", "Due", "money"], ["status", "Status", "badge"]],
    rowActions: [{ label: "Open", class: "primary", onClick: openBill }],
  });

const receipts = () =>
  crudPanel({
    path: "/api/billing/payments",
    noun: "receipt",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    searchable: false,
    columns: [["receipt_no", "Receipt"], ["created_at", "Date", "datetime"], ["patient_id", "Patient"], ["mode_id", "Mode"], ["amount", "Amount", "money"]],
    rowActions: [{ label: "Print", onClick: (row) => printReceipt(row.id) }],
  });

export default () => page("Billing", tabs([{ label: "Bills", render: bills }, { label: "Receipts", render: receipts }]));

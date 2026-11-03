import { api } from "../api.js";
import { LAB_ORDER_COLUMNS } from "../ui/clinical.js";
import { crudPanel } from "../ui/crud.js";
import { showDocument } from "../ui/document.js";
import { page } from "../ui/dom.js";
import { buildForm } from "../ui/form.js";
import { age, fmtDateTime } from "../ui/format.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";

async function printReport(order) {
  const { patient, results } = await api.get("/api/lab/report", {
    patient_id: order.patient_id,
    ref_type: order.ref_type,
    ref_id: order.ref_id,
  });
  showDocument({
    title: "Laboratory Report",
    meta: [["Patient", patient.name], ["MRN", patient.mrn], ["Age / Sex", `${age(patient.dob)} / ${patient.gender}`], ["Reported", fmtDateTime(new Date().toISOString())]],
    sections: [
      {
        heading: "Results",
        table: {
          columns: [["test_label", "Test"], ["result_value", "Result"], ["unit", "Unit"], ["reference", "Reference"], ["flag", "Flag"]],
          rows: results,
        },
      },
    ],
  });
}

const enterResult = (order, reload) =>
  openModal(`Result · ${order.test_label}`, (close) =>
    buildForm([{ name: "result_value", label: "Result value", required: true }], { result_value: order.result_value }, {
      onCancel: close,
      onSubmit: async (data) => {
        await api.post(`/api/lab/orders/${order.id}/result`, data);
        close();
        toast("Result saved", "success");
        reload();
      },
    })
  );

export default () =>
  page(
    "Laboratory",
    crudPanel({
      path: "/api/lab/orders",
      noun: "lab order",
      canEdit: false,
      canDelete: false,
      searchable: false,
      filters: [{ name: "status", label: "Status", type: "select", options: ["Ordered", "Collected", "Resulted"] }],
      fields: [
        { name: "patient_id", label: "Patient", type: "patient", required: true },
        { name: "test_id", label: "Test", type: "select", source: "tests", required: true },
      ],
      columns: LAB_ORDER_COLUMNS,
      rowActions: [
        {
          label: "Collect sample",
          show: (row) => row.status === "Ordered",
          onClick: async (row, reload) => {
            await api.post(`/api/lab/orders/${row.id}/collect`);
            reload();
          },
        },
        { label: "Enter result", show: (row) => row.status !== "Ordered", onClick: enterResult },
        { label: "Report", show: (row) => row.status === "Resulted", onClick: printReport },
      ],
    })
  );

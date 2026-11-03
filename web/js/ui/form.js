import { api } from "../api.js";
import { loadOptions } from "../sources.js";
import { debounce, h, uid } from "./dom.js";

const toOptions = (options) => options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));

const simple = (type) => (field, value) => {
  const node = h("input", { type, value: value ?? "", required: field.required, step: type === "number" ? "any" : null });
  return { node, read: () => (node.value === "" ? null : type === "number" ? Number(node.value) : node.value) };
};

const text = (field, value) => {
  const node = h("input", { type: "text", value: value ?? "", required: field.required, placeholder: field.placeholder });
  return { node, read: () => node.value };
};

const textarea = (field, value) => {
  const node = h("textarea", { rows: 3, value: value ?? "" });
  return { node, read: () => node.value };
};

const checkbox = (field, value) => {
  const node = h("input", { type: "checkbox", checked: !!value });
  return { node, read: () => node.checked };
};

const datetime = (field, value) => simple("datetime-local")(field, value ? String(value).slice(0, 16) : "");

const select = (field, value) => {
  const node = h("select", { required: field.required }, h("option", { value: "" }, "—"));
  const fill = (options) => {
    options.forEach((o) => node.append(h("option", { value: o.value }, o.label)));
    node.value = value ?? "";
  };
  if (field.source) loadOptions(field.source).then(fill);
  else fill(toOptions(field.options || []));
  const numeric = field.name.endsWith("_id");
  return { node, read: () => (node.value === "" ? null : numeric ? Number(node.value) : node.value) };
};

const patient = (field, value, values) => {
  const list = h("datalist", { id: uid("patients") });
  const node = h("input", {
    type: "text",
    list: list.id,
    required: field.required,
    placeholder: "Search by name, MRN or phone",
    value: values?.patient_label ?? "",
  });
  const known = new Map(value ? [[node.value, value]] : []);
  const search = debounce(async () => {
    const rows = await api.get("/api/patients", { q: node.value, active: true, limit: 15 });
    list.replaceChildren(
      ...rows.map((row) => {
        const label = `${row.mrn} · ${row.name}`;
        known.set(label, row.id);
        return h("option", { value: label });
      })
    );
  });
  node.addEventListener("input", search);
  return { node: h("span", {}, node, list), read: () => known.get(node.value) ?? null };
};

const INPUTS = {
  text,
  textarea,
  checkbox,
  select,
  patient,
  datetime,
  number: simple("number"),
  date: simple("date"),
  time: simple("time"),
};

export function makeInput(field, value, onChange, values) {
  const input = INPUTS[field.type || "text"](field, value, values);
  if (onChange) input.node.addEventListener("change", onChange);
  return input;
}

export function fieldRow(field, input) {
  return h("label", { class: `field${field.full ? " full" : ""}` }, h("span", {}, field.label), input.node);
}

export function buildForm(fields, values = {}, { submitLabel = "Save", onSubmit, onCancel } = {}) {
  const inputs = fields.map((field) => ({ field, ...makeInput(field, values[field.name], null, values) }));
  const submit = h("button", { class: "btn primary", type: "submit" }, submitLabel);
  const form = h(
    "form",
    {
      class: "form",
      onSubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          await onSubmit(Object.fromEntries(inputs.map(({ field, read }) => [field.name, read()])));
        } catch {
        } finally {
          submit.disabled = false;
        }
      },
    },
    h("div", { class: "form-grid" }, inputs.map(({ field, ...input }) => fieldRow(field, input))),
    h(
      "div",
      { class: "form-actions" },
      onCancel && h("button", { class: "btn", type: "button", onClick: onCancel }, "Cancel"),
      submit
    )
  );
  return form;
}

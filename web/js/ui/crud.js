import { api } from "../api.js";
import { clearOptions } from "../sources.js";
import { buildForm, fieldRow, makeInput } from "./form.js";
import { debounce, h, mount } from "./dom.js";
import { confirmDialog, openModal } from "./modal.js";
import { table } from "./table.js";
import { toast } from "./toast.js";

export function crudPanel({
  path,
  columns,
  fields = [],
  filters = [],
  fixed = {},
  params = {},
  defaults = {},
  rowActions = [],
  toolbar = [],
  title,
  noun = "record",
  searchable = true,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  refreshesOptions = false,
  onChange,
  onNew,
}) {
  const body = h("div");
  const filterInputs = filters.map((f) => ({ f, ...makeInput(f, f.default, () => load()) }));
  const searchBox = h("input", { type: "search", placeholder: "Search…", onInput: debounce(() => load()) });

  const currentFilters = () => Object.fromEntries(filterInputs.map(({ f, read }) => [f.name, read()]));

  async function load() {
    const rows = await api.get(path, { ...params, ...fixed, ...currentFilters(), q: searchBox.value });
    mount(body, table(columns, rows, { actions, empty: "Nothing recorded yet" }));
  }

  async function changed() {
    if (refreshesOptions) clearOptions();
    await load();
    onChange?.();
  }

  function openForm(row, prefill = {}) {
    openModal(`${row ? "Edit" : "New"} ${noun}`, (close) =>
      buildForm(fields, row || { ...defaults, ...prefill }, {
        onCancel: close,
        onSubmit: async (data) => {
          await (row ? api.put(`${path}/${row.id}`, data) : api.post(path, { ...fixed, ...data }));
          close();
          toast("Saved", "success");
          await changed();
        },
      })
    );
  }

  // Opens the "New" form with values filled in, e.g. from a verified ABHA profile.
  const openNew = (prefill) => openForm(null, prefill);

  const actions = [
    ...rowActions.map((a) => ({ ...a, onClick: (row) => a.onClick(row, changed) })),
    canEdit && fields.length && { label: "Edit", onClick: openForm },
    canDelete && {
      label: "Delete",
      class: "danger",
      onClick: async (row) => {
        if (await confirmDialog(`Delete this ${noun}?`, "Delete")) {
          await api.del(`${path}/${row.id}`);
          await changed();
        }
      },
    },
  ].filter(Boolean);

  const root = h(
    "section",
    { class: "panel" },
    h(
      "div",
      { class: "panel-head" },
      title && h("h2", {}, title),
      h(
        "div",
        { class: "toolbar" },
        searchable && searchBox,
        toolbar.map((t) => h("button", { class: "btn", onClick: () => t.onClick(changed, currentFilters) }, t.label)),
        canCreate && fields.length > 0 && h("button", { class: "btn primary", onClick: () => (onNew ? onNew(openNew) : openNew()) }, `New ${noun}`)
      )
    ),
    filterInputs.length > 0 && h("div", { class: "filters" }, filterInputs.map(({ f, ...input }) => fieldRow(f, input))),
    body
  );
  root.reload = load;
  root.openNew = openNew;
  load();
  return root;
}

import { state } from "../session.js";
import { crudPanel } from "../ui/crud.js";
import { page } from "../ui/dom.js";

export default () => {
  const roles = Object.entries(state.roles).map(([value, label]) => ({ value, label }));
  return page(
    "Users & roles",
    crudPanel({
      path: "/api/auth/users",
      noun: "user",
      searchable: false,
      defaults: { role: "reception", active: true },
      fields: [
        { name: "username", label: "Username", required: true },
        { name: "full_name", label: "Full name" },
        { name: "role", label: "Role", type: "select", options: roles, required: true },
        { name: "password", label: "Password", type: "password", placeholder: "Leave blank to keep current" },
        { name: "active", label: "Active", type: "checkbox" },
      ],
      columns: [
        ["username", "Username"],
        ["full_name", "Name"],
        { key: "role", label: "Role", render: (row) => state.roles[row.role] || row.role },
        ["active", "Active", "bool"],
      ],
    })
  );
};

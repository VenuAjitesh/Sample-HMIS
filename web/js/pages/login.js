import { api } from "../api.js";
import { apply } from "../session.js";
import { logo } from "../ui/brand.js";
import { h } from "../ui/dom.js";

export default function loginPage({ facility, onSuccess }) {
  const username = h("input", { type: "text", required: true, autocomplete: "username", autofocus: true });
  const password = h("input", { type: "password", required: true, autocomplete: "current-password" });
  const submit = h("button", { class: "btn primary block", type: "submit" }, "Sign in");

  const form = h(
    "form",
    {
      class: "login-card",
      onSubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          apply(await api.post("/api/auth/login", { username: username.value, password: password.value }));
          onSuccess();
        } catch {
          password.value = "";
        } finally {
          submit.disabled = false;
        }
      },
    },
    logo(72),
    h("h1", {}, facility),
    h("p", { class: "muted" }, "Hospital Management Information System"),
    h("label", { class: "field" }, h("span", {}, "Username"), username),
    h("label", { class: "field" }, h("span", {}, "Password"), password),
    submit
  );
  return h("div", { class: "login" }, form);
}

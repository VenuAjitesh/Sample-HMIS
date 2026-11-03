import { h } from "./dom.js";

export function openModal(title, content, { wide = false } = {}) {
  const close = () => backdrop.remove();
  const body = h("div", { class: "modal-body" });
  const backdrop = h(
    "div",
    { class: "modal-backdrop", onMousedown: (event) => event.target === backdrop && close() },
    h(
      "div",
      { class: `modal${wide ? " wide" : ""}` },
      h("div", { class: "modal-head" }, h("h3", {}, title), h("button", { class: "icon no-print", onClick: close }, "×")),
      body
    )
  );
  body.append(typeof content === "function" ? content(close) : content);
  document.body.append(backdrop);
  return { close };
}

export const confirmDialog = (message, confirmLabel = "Confirm") =>
  new Promise((resolve) => {
    const answer = (done, value) => () => (done(), resolve(value));
    openModal("Please confirm", (done) =>
      h(
        "div",
        {},
        h("p", {}, message),
        h(
          "div",
          { class: "form-actions" },
          h("button", { class: "btn", onClick: answer(done, false) }, "Cancel"),
          h("button", { class: "btn primary", onClick: answer(done, true) }, confirmLabel)
        )
      )
    );
  });

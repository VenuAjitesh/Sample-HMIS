import { h, mount } from "./dom.js";

export function tabs(items, initial = 0) {
  const body = h("div", { class: "tab-body" });
  const bar = h("div", { class: "tabs" });
  const show = async (index) => {
    [...bar.children].forEach((button, i) => button.classList.toggle("active", i === index));
    mount(body, await items[index].render());
  };
  items.forEach((item, index) => bar.append(h("button", { class: "tab", onClick: () => show(index) }, item.label)));
  show(initial);
  return h("div", {}, bar, body);
}

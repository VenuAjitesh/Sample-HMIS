export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (key === "value") value = val;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === "class") el.className = val;
    else el.setAttribute(key, val === true ? "" : val);
  }
  append(el, children);
  if (value !== undefined) el.value = value;
  return el;
}

export function mount(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

export const page = (title, ...children) => h("div", { class: "page" }, h("h1", {}, title), ...children);

export const debounce = (fn, ms = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

let counter = 0;
export const uid = (prefix = "id") => `${prefix}-${++counter}`;

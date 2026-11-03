let handler = () => {};

export function currentRoute() {
  const [id = "dashboard", ...rest] = location.hash.replace(/^#\//, "").split("/");
  return { id: id || "dashboard", arg: rest.join("/") };
}

export const refresh = () => handler();

export function navigate(path) {
  if (location.hash === `#/${path}`) handler();
  else location.hash = `#/${path}`;
}

export function startRouter(onRoute) {
  handler = () => onRoute(currentRoute());
  addEventListener("hashchange", handler);
  handler();
}

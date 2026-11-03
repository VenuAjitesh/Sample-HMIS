import { toast } from "./ui/toast.js";

const describe = (detail) =>
  Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ") : detail || "Request failed";

async function request(method, path, { params, body } = {}) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== "" && value != null) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = describe(error.detail);
    toast(message, "error");
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  get: (path, params) => request("GET", path, { params }),
  post: (path, body = {}) => request("POST", path, { body }),
  put: (path, body) => request("PUT", path, { body }),
  del: (path) => request("DELETE", path),
};

let configPromise;
export const config = () => (configPromise ||= api.get("/api/config"));

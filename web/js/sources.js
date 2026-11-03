import { api } from "./api.js";

const master = (name, label = (row) => row.name, value = "id") => ({
  path: `/api/masters/${name}`,
  params: { active: true, limit: 1000 },
  label,
  value,
});

export const SOURCES = {
  doctors: master("doctors"),
  departments: master("departments"),
  services: master("services", (r) => `${r.name} (${r.rate})`),
  drugs: master("drugs"),
  tests: master("lab-tests"),
  wards: master("wards"),
  machines: master("machines"),
  modes: master("payment-modes"),
  icd: master("icd10", (r) => `${r.code} · ${r.description}`, "code"),
};

const cache = new Map();

export function loadOptions(key) {
  if (!cache.has(key)) {
    const { path, params, label, value } = SOURCES[key];
    cache.set(
      key,
      api.get(path, params).then((rows) => rows.map((row) => ({ value: row[value], label: label(row) })))
    );
  }
  return cache.get(key);
}

export const clearOptions = () => cache.clear();

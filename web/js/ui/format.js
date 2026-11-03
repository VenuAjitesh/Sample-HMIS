export const today = () => {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const nowTime = () => new Date().toTimeString().slice(0, 5);

export const fmtDate = (value) =>
  value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "";

export const fmtDateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const money = (value) => (value == null || value === "" ? "" : Number(value).toFixed(2));

export const personName = (label) => (label ? String(label).split(" · ").pop() : "");

export const age = (dob) => {
  if (!dob) return "";
  const years = (Date.now() - new Date(dob)) / (365.25 * 86400000);
  return `${Math.floor(years)}y`;
};

import { h } from "./dom.js";

const NS = "http://www.w3.org/2000/svg";
const COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706"];

const svg = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (text != null) el.textContent = text;
  return el;
};

export function lineChart(labels, series, { width = 560, height = 220 } = {}) {
  const values = series.flatMap((s) => s.values).filter((v) => v != null);
  if (!values.length) return h("p", { class: "empty" }, "No data to chart");
  const pad = { left: 44, right: 12, top: 12, bottom: 28 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) [min, max] = [min - 1, max + 1];
  const span = width - pad.left - pad.right;
  const x = (i) => pad.left + (labels.length > 1 ? (i * span) / (labels.length - 1) : span / 2);
  const y = (v) => pad.top + ((max - v) * (height - pad.top - pad.bottom)) / (max - min);

  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart" });
  for (let i = 0; i <= 4; i++) {
    const value = min + ((max - min) * i) / 4;
    chart.append(
      svg("line", { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), class: "grid" }),
      svg("text", { x: pad.left - 6, y: y(value) + 4, "text-anchor": "end", class: "tick" }, Number(value.toFixed(1)))
    );
  }
  labels.forEach((label, i) => chart.append(svg("text", { x: x(i), y: height - 8, "text-anchor": "middle", class: "tick" }, label)));
  series.forEach((s, index) => {
    const color = s.color || COLORS[index % COLORS.length];
    const points = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    chart.append(svg("polyline", { points: points.map((p) => p.join(",")).join(" "), fill: "none", stroke: color, "stroke-width": 2 }));
    points.forEach(([cx, cy]) => chart.append(svg("circle", { cx, cy, r: 3, fill: color })));
  });

  const legend = h(
    "div",
    { class: "legend" },
    series.map((s, i) => h("span", {}, h("i", { style: `background:${s.color || COLORS[i % COLORS.length]}` }), s.name))
  );
  return h("div", { class: "chart-wrap" }, chart, legend);
}

#!/usr/bin/env node
// Сравнение двух снапшотов из audit.mjs (--json) → markdown-таблица «до → стало»
// с дельтами. Это и есть продаваемый Re-audit.
//
//   node compare.mjs before.json after.json [--out compare.md]

import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const files = [];
let out = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") out = argv[++i];
  else files.push(argv[i]);
}
if (files.length !== 2) {
  console.error("Нужны два снапшота: node compare.mjs before.json after.json [--out file.md]");
  process.exit(1);
}
const [before, after] = files.map((f) => JSON.parse(readFileSync(f, "utf8")));

const ms = (v) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const clsFmt = (v) => (v == null ? "—" : v.toFixed(3));
const idx = (snap) => Object.fromEntries(snap.results.map((r) => [r.url, r]));
const bIdx = idx(before);
const aIdx = idx(after);

// направление «лучше»: для score больше=лучше, для метрик меньше=лучше
const METRICS = [
  ["Performance", "perf", (v) => `${v}`, "up"],
  ["Accessibility", "a11y", (v) => `${v}`, "up"],
  ["Best Practices", "bp", (v) => `${v}`, "up"],
  ["SEO", "seo", (v) => `${v}`, "up"],
  ["FCP", "fcp", ms, "down"],
  ["LCP", "lcp", ms, "down"],
  ["TBT", "tbt", ms, "down"],
  ["CLS", "cls", clsFmt, "down"],
  ["Speed Index", "si", ms, "down"],
];

function deltaMark(b, a, dir) {
  if (b == null || a == null) return "";
  const diff = a - b;
  if (Math.abs(diff) < 1e-9) return "→";
  const better = dir === "up" ? diff > 0 : diff < 0;
  return better ? "✅" : "🔴";
}

const lines = [];
lines.push(`# Re-audit: ${before.label || "до"} → ${after.label || "стало"}`);
lines.push("");
lines.push(`${before.stamp} → ${after.stamp}`);
lines.push("");

const urls = [...new Set([...Object.keys(bIdx), ...Object.keys(aIdx)])];
for (const url of urls) {
  const b = bIdx[url];
  const a = aIdx[url];
  lines.push(`## ${url}`);
  lines.push("");
  const devs = [...new Set([...Object.keys(b?.devices || {}), ...Object.keys(a?.devices || {})])];
  for (const dev of devs) {
    lines.push(`### ${dev}`);
    lines.push("");
    lines.push("| Метрика | Было | Стало | |");
    lines.push("|---|---|---|---|");
    const bd = b?.devices?.[dev] || {};
    const ad = a?.devices?.[dev] || {};
    for (const [label, key, fmt, dir] of METRICS) {
      const bv = bd[key];
      const av = ad[key];
      lines.push(`| ${label} | ${bv == null ? "—" : fmt(bv)} | ${av == null ? "—" : fmt(av)} | ${deltaMark(bv, av, dir)} |`);
    }
    lines.push("");
  }
}

const md = lines.join("\n");
if (out) {
  writeFileSync(out, md);
  process.stderr.write(`📄 ${out}\n`);
} else {
  process.stdout.write("\n" + md + "\n");
}

#!/usr/bin/env node
// Авто-замеры для frontend-аудитов.
// Прогоняет Lighthouse (mobile/desktop) по списку URL, берёт медиану по N
// прогонам (Lighthouse/PSI шумят), проверяет security-заголовки и реальное
// сжатие (brotli/gzip через GET — HEAD Traefik не сжимает!), и пишет
// markdown-отчёт + JSON-снапшот для последующего сравнения до/после.
//
// Использование:
//   node audit.mjs <url...> [--device mobile|desktop|both] [--runs N]
//                  [--out report.md] [--json snapshot.json] [--label "до"]
// Примеры:
//   node audit.mjs https://mmalabugin.ru --device both --runs 3
//   node audit.mjs https://a.com https://b.com --json before.json

import { spawnSync } from "node:child_process";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";

// Реалистичный User-Agent — без него часть сайтов отдаёт бот-защиту/редирект.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Сырой GET без авто-декомпрессии (в отличие от fetch) — даёт реальный размер
// «с провода» для проверки сжатия.
function rawGet(url, acceptEncoding) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { headers: { "Accept-Encoding": acceptEncoding, "User-Agent": UA } },
      (res) => {
        let bytes = 0;
        res.on("data", (c) => (bytes += c.length));
        res.on("end", () =>
          resolve({
            encoding: res.headers["content-encoding"] || "none",
            bytes,
            status: res.statusCode,
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

// ---------- args ----------
const argv = process.argv.slice(2);
const urls = [];
const opts = { device: "mobile", runs: 3, out: null, json: null, label: "" };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--device") opts.device = argv[++i];
  else if (a === "--runs") opts.runs = Math.max(1, parseInt(argv[++i], 10) || 1);
  else if (a === "--out") opts.out = argv[++i];
  else if (a === "--json") opts.json = argv[++i];
  else if (a === "--label") opts.label = argv[++i];
  else if (a === "-h" || a === "--help") {
    console.log(
      "node audit.mjs <url...> [--device mobile|desktop|both] [--runs N] [--out report.md] [--json snapshot.json] [--label текст]",
    );
    process.exit(0);
  } else if (a.startsWith("http")) urls.push(a);
  else console.warn(`пропущен неизвестный аргумент: ${a}`);
}
if (urls.length === 0) {
  console.error("Нужен хотя бы один URL. -h для справки.");
  process.exit(1);
}
const devices =
  opts.device === "both" ? ["mobile", "desktop"] : [opts.device];

// ---------- chrome ----------
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => existsSync(p)) || null;
}
const CHROME = findChrome();

const median = (nums) => {
  const s = nums.filter((n) => n != null && !Number.isNaN(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------- lighthouse ----------
function runLighthouseOnce(url, device, tmp) {
  const out = join(tmp, `lh-${Math.abs(hash(url + device + Math.random()))}.json`);
  const args = [
    "-y",
    "lighthouse@latest",
    url,
    "--only-categories=performance,accessibility,best-practices,seo",
    `--form-factor=${device}`,
    "--chrome-flags=--headless=new --no-sandbox",
    "--output=json",
    `--output-path=${out}`,
    "--quiet",
  ];
  if (device === "desktop") args.push("--preset=desktop");
  const res = spawnSync("npx", args, {
    encoding: "utf8",
    env: { ...process.env, ...(CHROME ? { CHROME_PATH: CHROME } : {}) },
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!existsSync(out)) {
    return { error: (res.stderr || res.stdout || "lighthouse failed").slice(-300) };
  }
  const d = JSON.parse(readFileSync(out, "utf8"));
  const c = d.categories;
  const a = d.audits;
  const num = (k) => a[k]?.numericValue ?? null;
  return {
    perf: Math.round((c.performance?.score ?? 0) * 100),
    a11y: Math.round((c.accessibility?.score ?? 0) * 100),
    bp: Math.round((c["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((c.seo?.score ?? 0) * 100),
    fcp: num("first-contentful-paint"),
    lcp: num("largest-contentful-paint"),
    tbt: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"),
    si: num("speed-index"),
  };
}

function runLighthouse(url, device, runs) {
  const tmp = mkdtempSync(join(tmpdir(), "fa-"));
  try {
    const got = [];
    for (let i = 0; i < runs; i++) {
      process.stderr.write(`  · ${device} прогон ${i + 1}/${runs}…\n`);
      const r = runLighthouseOnce(url, device, tmp);
      if (r.error) {
        process.stderr.write(`    ! ошибка: ${r.error}\n`);
        continue;
      }
      got.push(r);
    }
    if (!got.length) return { error: "все прогоны упали" };
    const keys = ["perf", "a11y", "bp", "seo", "fcp", "lcp", "tbt", "cls", "si"];
    const agg = {};
    for (const k of keys) agg[k] = median(got.map((g) => g[k]));
    agg.runs = got.length;
    return agg;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- headers / compression ----------
const SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

// Выбираем JS-ассет ТОГО ЖЕ origin (а не первый попавшийся сторонний скрипт
// аналитики/виджета) — иначе «сжатие» меряется не у клиента, а у его трекера.
function pickSameOriginAsset(html, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const matches = [...html.matchAll(/["'(]([^"'()\s>]+?\.js)(?:[?"')]|$)/g)].map(
    (m) => m[1],
  );
  const TRACKERS = /gtm|gtag|googletag|analytics|\bga\b|metrika|pixel|fbevents|hotjar|clarity|tag\.js/i;
  const sameOrigin = [];
  for (const a of matches) {
    if (a.startsWith("//")) continue; // protocol-relative = почти всегда сторонний
    if (TRACKERS.test(a)) continue; // мелкие скрипты аналитики не репрезентативны
    try {
      const abs = new URL(a, baseUrl);
      if (abs.origin === origin) sameOrigin.push(abs.href);
    } catch {
      /* ignore */
    }
  }
  // предпочитаем сборочные ассеты (_next/static, /assets/, /static/, с хешем)
  return (
    sameOrigin.find((u) =>
      /_next\/static|\/assets\/|\/static\/|\.[a-f0-9]{6,}\.(js)/.test(u),
    ) ||
    sameOrigin[0] ||
    null
  );
}

async function checkHeaders(url) {
  const result = { security: {}, compression: null, error: null };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    for (const h of SECURITY_HEADERS) result.security[h] = res.headers.has(h);
    const html = await res.text();
    const assetUrl = pickSameOriginAsset(html, res.url || url);
    if (assetUrl) {
      const comp = {};
      // identity = базовый несжатый размер для наглядной экономии.
      for (const enc of ["br", "gzip", "identity"]) {
        comp[enc] = await rawGet(assetUrl, enc).catch((e) => ({
          encoding: "ошибка",
          bytes: 0,
          error: String(e.message || e),
        }));
      }
      const base = comp.identity.bytes;
      const best = comp.br.encoding === "br" ? comp.br : comp.gzip;
      comp.savedPct = base && best.bytes ? Math.round((1 - best.bytes / base) * 100) : null;
      result.compression = { asset: new URL(assetUrl).pathname, ...comp };
    }
  } catch (e) {
    // fetch может бросать AggregateError (несколько неудачных соединений) —
    // собираем вложенные сообщения, чтобы было видно причину.
    const inner = e?.errors?.map((x) => x.message).join("; ");
    result.error = inner || String(e?.message || e);
  }
  return result;
}

// ---------- helpers ----------
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const ms = (v) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const clsFmt = (v) => (v == null ? "—" : v.toFixed(3));
const scoreEmoji = (v) => (v == null ? "" : v >= 90 ? "🟢" : v >= 50 ? "🟠" : "🔴");

// ---------- run ----------
function nowStamp() {
  // без Date.now() детерминизма не надо — это CLI-инструмент
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

const report = [];
const snapshot = { label: opts.label, stamp: nowStamp(), device: opts.device, runs: opts.runs, results: [] };

report.push(`# Авто-замер фронтенда${opts.label ? ` — ${opts.label}` : ""}`);
report.push("");
report.push(`Дата: ${nowStamp()} · устройство: ${opts.device} · медиана из ${opts.runs} прогонов${CHROME ? "" : " · ⚠️ Chrome не найден"}`);
report.push("");

for (const url of urls) {
  process.stderr.write(`\n▶ ${url}\n`);
  const entry = { url, devices: {}, headers: null };
  for (const device of devices) {
    const lh = runLighthouse(url, device, opts.runs);
    entry.devices[device] = lh;
  }
  process.stderr.write(`  · проверка заголовков и сжатия…\n`);
  entry.headers = await checkHeaders(url);
  snapshot.results.push(entry);

  report.push(`## ${url}`);
  report.push("");
  report.push("| Метрика | " + devices.join(" | ") + " |");
  report.push("|---|" + devices.map(() => "---").join("|") + "|");
  const rows = [
    ["Performance", "perf", (v) => `${scoreEmoji(v)} ${v}`],
    ["Accessibility", "a11y", (v) => `${v}`],
    ["Best Practices", "bp", (v) => `${v}`],
    ["SEO", "seo", (v) => `${v}`],
    ["FCP", "fcp", ms],
    ["LCP", "lcp", ms],
    ["TBT", "tbt", ms],
    ["CLS", "cls", clsFmt],
    ["Speed Index", "si", ms],
  ];
  for (const [label, key, fmt] of rows) {
    const cells = devices.map((d) => {
      const lh = entry.devices[d];
      if (lh?.error) return "ошибка";
      return fmt(lh?.[key]);
    });
    report.push(`| ${label} | ${cells.join(" | ")} |`);
  }
  report.push("");

  // заголовки/сжатие
  const h = entry.headers;
  if (h && !h.error) {
    const sec = SECURITY_HEADERS.map((k) => `${h.security[k] ? "✅" : "❌"} ${k}`).join(" · ");
    report.push(`**Security-заголовки:** ${sec}`);
    if (h.compression) {
      const c = h.compression;
      const saved = c.savedPct != null ? ` · экономия −${c.savedPct}%` : "";
      report.push(
        `**Сжатие** (\`${c.asset}\`): brotli → \`${c.br.encoding}\` ${c.br.bytes} б · gzip → \`${c.gzip.encoding}\` ${c.gzip.bytes} б · без сжатия ${c.identity.bytes} б${saved}`,
      );
    }
  } else if (h?.error) {
    report.push(`**Заголовки:** ошибка — ${h.error}`);
  }
  report.push("");
}

const md = report.join("\n");
if (opts.out) {
  writeFileSync(opts.out, md);
  process.stderr.write(`\n📄 отчёт: ${opts.out}\n`);
} else {
  process.stdout.write("\n" + md + "\n");
}
if (opts.json) {
  writeFileSync(opts.json, JSON.stringify(snapshot, null, 2));
  process.stderr.write(`💾 снапшот: ${opts.json}  (для сравнения: node compare.mjs ${opts.json} <после.json>)\n`);
}

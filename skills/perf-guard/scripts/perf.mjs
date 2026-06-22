#!/usr/bin/env node
// perf-guard engine: REAL performance measurement.
// Prefers local Lighthouse CLI (via npx); falls back to PageSpeed Insights API.
// NEVER uses chrome-devtools MCP traces — those are falsely optimistic.
//
// Usage:
//   node perf.mjs <url> [--device mobile|desktop|both] [--out run.json]
//   node perf.mjs --compare runA.json runB.json
//
// Env: PSI_API_KEY (optional) for the PageSpeed Insights fallback.

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const METRIC_KEYS = {
  performance: ['categories', 'performance', 'score'],
  lcp_ms: ['audits', 'largest-contentful-paint', 'numericValue'],
  cls: ['audits', 'cumulative-layout-shift', 'numericValue'],
  tbt_ms: ['audits', 'total-blocking-time', 'numericValue'],
  fcp_ms: ['audits', 'first-contentful-paint', 'numericValue'],
  tti_ms: ['audits', 'interactive', 'numericValue'],
  si_ms: ['audits', 'speed-index', 'numericValue'],
  weight_kb: ['audits', 'total-byte-weight', 'numericValue'],
};

function dig(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function extract(lhr) {
  const out = {};
  for (const [name, path] of Object.entries(METRIC_KEYS)) {
    let v = dig(lhr, path);
    if (name === 'weight_kb' && typeof v === 'number') v = Math.round(v / 1024);
    if (name === 'performance' && typeof v === 'number') v = Math.round(v * 100) / 100;
    if (typeof v === 'number' && name.endsWith('_ms')) v = Math.round(v);
    out[name] = v ?? null;
  }
  return out;
}

function runLighthouseCLI(url, formFactor) {
  // Throttled, real run. Quiet, JSON to stdout.
  const args = [
    '--yes', 'lighthouse', url,
    '--quiet', '--output=json', '--output-path=stdout',
    '--only-categories=performance',
    `--form-factor=${formFactor}`,
    formFactor === 'desktop' ? '--preset=desktop' : '--screenEmulation.mobile',
    '--chrome-flags=--headless=new --no-sandbox',
  ];
  const json = execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(json);
}

async function runPSI(url, strategy) {
  const key = process.env.PSI_API_KEY;
  const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy); // mobile | desktop
  u.searchParams.append('category', 'performance');
  if (key) u.searchParams.set('key', key);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`PSI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.lighthouseResult;
}

async function measure(url, device) {
  const formFactor = device === 'desktop' ? 'desktop' : 'mobile';
  let lhr, engine;
  try {
    lhr = runLighthouseCLI(url, formFactor);
    engine = 'lighthouse-cli';
  } catch (e) {
    process.stderr.write(`[perf-guard] Lighthouse CLI unavailable (${e.message.split('\n')[0]}), falling back to PSI API\n`);
    lhr = await runPSI(url, formFactor === 'desktop' ? 'desktop' : 'mobile');
    engine = 'psi-api';
  }
  return { url, device: formFactor, engine, metrics: extract(lhr), ts: new Date().toISOString() };
}

function pad(s, n) { return String(s).padEnd(n); }

function compare(a, b) {
  const ra = JSON.parse(readFileSync(a, 'utf8'));
  const rb = JSON.parse(readFileSync(b, 'utf8'));
  const A = ra.metrics ?? ra, B = rb.metrics ?? rb;
  console.log(`\n${pad('metric', 14)}${pad('before', 12)}${pad('after', 12)}delta`);
  for (const k of Object.keys(METRIC_KEYS)) {
    const before = A[k], after = B[k];
    const delta = (typeof before === 'number' && typeof after === 'number') ? (after - before) : '';
    const worse = typeof delta === 'number' && ((k === 'performance' && delta < -0.01) || (k !== 'performance' && delta > 0));
    console.log(`${pad(k, 14)}${pad(before, 12)}${pad(after, 12)}${delta}${worse ? '  ⚠ REGRESSION' : ''}`);
  }
}

const argv = process.argv.slice(2);

if (argv[0] === '--compare') {
  compare(argv[1], argv[2]);
} else {
  const url = argv[0];
  if (!url) { console.error('usage: perf.mjs <url> [--device mobile|desktop|both] [--out file]'); process.exit(1); }
  const device = (argv.includes('--device') ? argv[argv.indexOf('--device') + 1] : 'both');
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
  const devices = device === 'both' ? ['mobile', 'desktop'] : [device];
  const runs = [];
  for (const d of devices) runs.push(await measure(url, d));
  const result = { url, runs };
  console.log(JSON.stringify(result, null, 2));
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 2));
    process.stderr.write(`[perf-guard] saved ${out}\n`);
  }
}

const fs = require('fs');
const path = require('path');
const bodyPath = path.join(__dirname, 'c08b-08-body.txt');
const body = fs.readFileSync(bodyPath, 'utf8');

const header = `import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const QA = "https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const SD = path.join(process.cwd(), "scripts", "c08b-08-screenshots");
if (!fs.existsSync(SD)) fs.mkdirSync(SD, { recursive: true });

const CM = [], PE = [], HE = [];

async function sh(pg, n) {
  const p = path.join(SD, n + ".png");
  try { await pg.screenshot({ path: p, fullPage: false, timeout: 60000, animations: "disabled" }); console.log("  SC: " + n); } catch {}
}

async function fr(pg) {
  return pg.evaluate(() => {
    const ls = document.querySelectorAll('a[href*="/admin/short-films/"]');
    for (const l of ls) { const h = l.getAttribute("href"); if (h && !h.includes("/new")) return h; }
    return null;
  });
}

async function cb(pg) {
  return pg.evaluate(() => {
    const a = document.querySelector('nav[aria-label="Breadcrumb"] a[href*="/admin/short-films"]');
    if (a) { a.click(); return a.getAttribute("href"); }
    return null;
  });
}

async function ct(pg, t) {
  return pg.evaluate((tx) => {
    const bs = document.querySelectorAll("button");
    for (const b of bs) { if (b.textContent.trim() === tx) { b.click(); return true; } }
    return false;
  }, t);
}

async function rd(pg, n) {
  return pg.evaluate((nm) => {
    const i = document.querySelector('input[name="' + nm + '"]');
    return i ? i.value : null;
  }, n);
}

async function fl(pg, n, v) {
  return pg.evaluate((nm, val) => {
    const i = document.querySelector('input[name="' + nm + '"]');
    if (i) { i.value = val; i.dispatchEvent(new Event("input", { bubbles: true })); }
  }, n, v);
}

`;

const footer = `
run().catch(console.error);
`;

const fullScript = header + body + footer;
const outPath = path.join(__dirname, 'c08b-08-probe.mjs');
fs.writeFileSync(outPath, fullScript, 'utf8');
console.log('WRITTEN ' + outPath + ' size=' + fs.statSync(outPath).size + ' lines=' + fullScript.split('\n').length);

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const QA_URL = "https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const ADMIN_HOME = `${QA_URL}/admin/home`;
const SCREENSHOTS_DIR = path.join(process.cwd(), "scripts", "c08b-06-screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const consoleMessages = [];
const pageErrors = [];
const httpErrors = [];
const r = {
  login: false, rowExpanded: false, rowIdCaptured: false, submitRejected: false,
  attemptedValuePreserved: false, validationErrorVisible: false, dirtyPreserved: false,
  rowSwitchWarning: false, stayKeepsRow: false, leaveCleanupOk: false, dbUnchanged: false,
};

async function shot(page, name) {
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: p, fullPage: false, timeout: 60000, animations: "disabled" });
    console.log(`  Screenshot: ${p}`);
  } catch {
    console.log(`  Screenshot FAILED: ${name}`);
  }
}

async function safeFill(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel);
    if (!input) throw new Error(`safeFill: no element for ${sel}`);
    input.focus();
    input.value = val;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { sel: selector, val: value });
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  // NOTE: fonts are NOT blocked â€” we need a true reading of page-emitted console warnings.
  page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("response", (res) => { if (res.status() >= 400) httpErrors.push(`${res.status()} ${res.url()}`); });

  const EXPANDED_TITLE = 'article:has(button[aria-expanded="true"]) input[name="title"]';

  try {
    console.log("Step 1: goto /admin/home");
    await page.goto(ADMIN_HOME, { waitUntil: "networkidle" });
    if (page.url().includes("/admin/login")) {
      await page.fill('input[name="email"]', "0@0nya.com");
      await page.fill('input[name="password"]', "Nile-Quartz-74!mR9");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(4000);
    }
    r.login = page.url().includes("/admin/home");
    console.log(`  login ok: ${r.login} url=${page.url()}`);
    await page.waitForTimeout(2500);

    console.log("Step 2: expand first row");
    await page.locator("article button[aria-expanded]").first().click();
    await page.waitForTimeout(1500);
    r.rowExpanded = (await page.locator('[aria-expanded="true"]').count()) === 1;
    await shot(page, "probe-01-row-expanded");

    const rowId = await page.evaluate(() =>
      document.querySelector('article:has(button[aria-expanded="true"]) input[name="rowId"]')?.value ?? ""
    );
    r.rowIdCaptured = rowId.length > 0;
    console.log(`  rowId: ${rowId} captured=${r.rowIdCaptured}`);

    const originalTitle = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", EXPANDED_TITLE);
    console.log(`  original title (DB baseline): "${originalTitle}"`);

    console.log("Step 3: enter ACTUAL INVALID VALUE — whitespace-only title '   '");
    const INVALID = "   ";
    await safeFill(page, EXPANDED_TITLE, INVALID);
    await page.waitForTimeout(500);
    const beforeSaveValue = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", EXPANDED_TITLE);
    console.log(`  pre-save input value: "${beforeSaveValue}" (must equal invalid)`);

    console.log("Step 4: submit (Save row) — expect server rejection");
    const urlBefore = page.url();
    await page.click('button:has-text("Save row")');
    await page.waitForTimeout(4000);
    await shot(page, "probe-02-after-invalid-submit");
    const urlAfter = page.url();
    r.submitRejected = urlAfter === urlBefore && !urlAfter.includes("flash=");
    console.log(`  url unchanged: ${urlAfter === urlBefore} (${urlAfter})`);
    console.log(`  SUBMIT REJECTED: ${r.submitRejected}`);

    console.log("Step 5: attempted invalid value remains visible in input");
    const afterSaveValue = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", EXPANDED_TITLE);
    r.attemptedValuePreserved = afterSaveValue === INVALID;
    console.log(`  post-save input value: "${afterSaveValue}" preserved=${r.attemptedValuePreserved}`);

    console.log("Step 6: validation error message visible");
    const errCount = await page.locator("text=/Row title is required/i").count();
    r.validationErrorVisible = errCount > 0;
    console.log(`  'Row title is required.' nodes: ${errCount} visible=${r.validationErrorVisible}`);

    console.log("Step 7: form still dirty â€” row switch must trigger unsaved warning");
    const secondHeader = page.locator('article:has(button[aria-expanded="true"]) ~ article button[aria-expanded]').first();
    const secondExists = (await secondHeader.count()) > 0;
    if (secondExists) {
      await secondHeader.click();
      try {
        await page.locator("text=/unsaved changes/i").waitFor({ timeout: 4000 });
        r.rowSwitchWarning = true;
      } catch {
        r.rowSwitchWarning = false;
      }
      console.log(`  ROW SWITCH WARNING modal: ${r.rowSwitchWarning}`);
      await shot(page, "probe-03-unsaved-warning");
    } else {
      console.log("  no second row available for switch test");
    }

    console.log("Step 8: Stay keeps dirty row expanded");
    if (r.rowSwitchWarning) {
      await page.click("button:has-text('Stay')");
      await page.waitForTimeout(800);
      const stillExpanded = await page.locator('article button[aria-expanded="true"]').count();
      r.stayKeepsRow = stillExpanded === 1;
      console.log(`  expanded after Stay: ${stillExpanded} stayKeepsRow=${r.stayKeepsRow}`);
    }
    r.dirtyPreserved = r.attemptedValuePreserved && r.validationErrorVisible && r.stayKeepsRow;

    console.log("Step 9: cleanup â€” Leave without saving, then reload to read DB");
    if (r.rowSwitchWarning) {
      const secondHeader2 = page.locator('article:has(button[aria-expanded="true"]) ~ article button[aria-expanded]').first();
      if ((await secondHeader2.count()) > 0) {
        await secondHeader2.click();
        await page.waitForTimeout(500);
        const leaveBtn = page.locator("button:has-text('Leave without saving')");
        if ((await leaveBtn.count()) > 0) {
          await leaveBtn.click();
          await page.waitForTimeout(800);
          const expandedAfterLeave = await page.locator('article button[aria-expanded="true"]').count();
          r.leaveCleanupOk = expandedAfterLeave === 1;
          console.log(`  expanded after Leave: ${expandedAfterLeave} leaveCleanupOk=${r.leaveCleanupOk}`);
        }
      }
    }

    await page.goto(ADMIN_HOME, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.locator("article button[aria-expanded]").first().click();
    await page.waitForTimeout(1500);
    const titleAfterReload = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", EXPANDED_TITLE);
    r.dbUnchanged = titleAfterReload === originalTitle;
    console.log(`  title after reload: "${titleAfterReload}" (original: "${originalTitle}") DB_UNCHANGED=${r.dbUnchanged}`);
    await shot(page, "probe-04-after-reload-db-check");
  } catch (error) {
    console.error("PROBE ERROR:", error);
    await shot(page, "probe-99-error");
  } finally {
    await browser.close();
  }

  console.log("\n=== C08B-06 MICRO-GATE PROBE RESULTS ===");
  console.log(`LOGIN: ${r.login ? "PASS" : "FAIL"}`);
  console.log(`ROW EXPANDED: ${r.rowExpanded ? "PASS" : "FAIL"}`);
  console.log(`ROW ID CAPTURED: ${r.rowIdCaptured ? "PASS" : "FAIL"}`);
  console.log(`SUBMIT REJECTED: ${r.submitRejected ? "PASS" : "FAIL"}`);
  console.log(`ATTEMPTED VALUE PRESERVED: ${r.attemptedValuePreserved ? "PASS" : "FAIL"}`);
  console.log(`VALIDATION ERROR VISIBLE: ${r.validationErrorVisible ? "PASS" : "FAIL"}`);
  console.log(`DIRTY PRESERVED: ${r.dirtyPreserved ? "PASS" : "FAIL"}`);
  console.log(`ROW SWITCH WARNING: ${r.rowSwitchWarning ? "PASS" : "FAIL"}`);
  console.log(`STAY KEEPS ROW: ${r.stayKeepsRow ? "PASS" : "FAIL"}`);
  console.log(`LEAVE CLEANUP OK: ${r.leaveCleanupOk ? "PASS" : "FAIL"}`);
  console.log(`DB UNCHANGED: ${r.dbUnchanged ? "PASS" : "FAIL"}`);

  const fontWarnings = consoleMessages.filter((m) => /preload/i.test(m) && /font|woff/i.test(m));
  const otherWarnings = consoleMessages.filter((m) => /^\[warning\]/.test(m) && !(/preload/i.test(m) && /font|woff/i.test(m)));
  console.log("\n=== CONSOLE CAPTURE ===");
  console.log(`total console messages: ${consoleMessages.length}`);
  console.log(`FONT PRELOAD WARNINGS (${fontWarnings.length}):`);
  fontWarnings.slice(0, 10).forEach((m) => console.log(`  ${m}`));
  console.log(`OTHER WARNINGS (${otherWarnings.length}):`);
  otherWarnings.slice(0, 10).forEach((m) => console.log(`  ${m}`));
  console.log(`CONSOLE ERRORS (${consoleMessages.filter((m) => m.startsWith("[error")).length}):`);
  consoleMessages.filter((m) => m.startsWith("[error")).slice(0, 10).forEach((m) => console.log(`  ${m}`));
  console.log(`PAGE ERRORS (${pageErrors.length}):`);
  pageErrors.slice(0, 10).forEach((m) => console.log(`  ${m}`));
  console.log(`HTTP >=400 (${httpErrors.length}):`);
  httpErrors.slice(0, 10).forEach((m) => console.log(`  ${m}`));

  const allPass = r.login && r.rowExpanded && r.rowIdCaptured && r.submitRejected && r.attemptedValuePreserved &&
    r.validationErrorVisible && r.dirtyPreserved && r.rowSwitchWarning && r.stayKeepsRow && r.leaveCleanupOk && r.dbUnchanged;
  console.log(`\nPROBE OVERALL: ${allPass ? "PASS" : "FAIL"}`);
}

run().catch(console.error);

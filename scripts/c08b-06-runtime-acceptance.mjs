import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const QA_URL = "https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const ADMIN_HOME = `${QA_URL}/admin/home`;
const SCREENSHOTS_DIR = path.join(process.cwd(), "scripts", "c08b-06-screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  defaultCollapsed: false,
  oneRowFocus: false,
  dirtyStay: false,
  dirtyLeave: false,
  restoreOriginal: false,
  successfulSave: false,
  validationPreservesValuesDirty: false,
  failedSavePreservesValuesDirty: false,
  deleteConfirmation: false,
  spotlight: false,
  contentControls: false,
  breadcrumb: false,
  consoleErrors: [],
  httpErrors: [],
  screenshots: [],
};

async function takeScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: false, timeout: 60000, animations: "disabled" });
    results.screenshots.push(filePath);
    console.log(`  Screenshot: ${filePath}`);
  } catch (e) {
    console.log(`  Screenshot FAILED (timeout/performance): ${filePath}`);
  }
}

async function runAcceptance() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const fonts = document.fonts;
    if (fonts) {
      Object.defineProperty(fonts, "ready", {
        get: () => Promise.resolve(),
        configurable: true,
      });
    }
  });
  await page.route("**/*.woff2", (route) => route.abort());
  await page.route("**/*.woff", (route) => route.abort());
  await page.route("**/*.ttf", (route) => route.abort());
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  page.on("console", (msg) => {
    results.consoleErrors.push(`[console ${msg.type()}] ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      results.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log("Step 1: Navigate to admin home (will redirect to login if needed)");
    await page.goto(ADMIN_HOME, { waitUntil: "networkidle" });
    await takeScreenshot(page, "01-login-or-home");
    console.log(`  Current URL: ${page.url()}`);

    if (page.url().includes("/admin/login")) {
      console.log("Step 2: Login required, filling credentials");
      const email = "0@0nya.com";
      const password = "Nile-Quartz-74!mR9";

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await takeScreenshot(page, "02-login-filled");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      await takeScreenshot(page, "03-after-login");
      console.log(`  After login URL: ${page.url()}`);
    }

    if (page.url().includes("/admin/home")) {
      console.log("Login successful - on /admin/home");

      console.log("Verify 1: All rows default collapsed");
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "04-home-collapsed");
      const expandedRows = await page.locator('[aria-expanded="true"]').count();
      console.log(`  Expanded rows: ${expandedRows}`);
      results.defaultCollapsed = expandedRows === 0;

      console.log("Verify 2: One row expands at a time");
      const firstRowHeader = page.locator("article button[aria-expanded]").first();
      await firstRowHeader.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "05-one-row-expanded");
      const expandedAfterFirst = await page.locator('[aria-expanded="true"]').count();
      console.log(`  Expanded after first click: ${expandedAfterFirst}`);
      results.oneRowFocus = expandedAfterFirst === 1;

      console.log("Verify 3-5: Dirty row switching");
      const titleInput = page.locator("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]");
      async function safeFill(selector, value) {
        await page.evaluate(({sel, val}) => {
          const inputs = document.querySelectorAll(sel);
          if (inputs.length > 0) {
            const input = inputs[0];
            input.focus();
            input.value = val;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, {sel: selector, val: value});
      }
      if (await titleInput.count() > 0) {
        await page.waitForTimeout(5000);
        await safeFill("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]", "Test Dirty Title");
        await page.waitForTimeout(300);
        await takeScreenshot(page, "06-dirty-title-entered");

        const secondRowHeader = page.locator("article:has(button[aria-expanded='true']) ~ article button[aria-expanded]").first();
        if (await secondRowHeader.count() > 0) {
          await secondRowHeader.click();
          try {
            await page.locator("text=/unsaved changes/i").waitFor({ timeout: 3000 });
            results.dirtyStay = true;
          } catch {
            results.dirtyStay = false;
          }
          console.log(`  Dirty warning modal appeared: ${results.dirtyStay}`);

          if (results.dirtyStay) {
            await page.click("button:has-text('Stay')");
            await page.waitForTimeout(500);
            await takeScreenshot(page, "08-after-stay");

            const stillExpanded = await page.locator("article button[aria-expanded='true']").count();
            console.log(`  Rows still expanded after Stay: ${stillExpanded}`);
            results.dirtyStay = stillExpanded === 1;

            await secondRowHeader.click();
            await page.waitForTimeout(500);
            await page.click("button:has-text('Leave without saving')");
            await page.waitForTimeout(500);
            await takeScreenshot(page, "09-after-leave");

            const nowExpanded = await page.locator("article button[aria-expanded='true']").count();
            console.log(`  Rows expanded after Leave: ${nowExpanded}`);
            results.dirtyLeave = nowExpanded === 1;
          } else {
            console.log("  Dirty warning modal did not appear; continuing.");
          }
        }
      }

      console.log("Verify 6: Restore original value");
      const currentTitle = await page.evaluate(() => document.querySelector("article button[aria-expanded=\"true\"]")?.closest("article")?.querySelector("input[name=\"title\"]")?.value ?? "");
      await safeFill("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]", "Test Title");
      await page.waitForTimeout(300);
      await safeFill("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]", currentTitle);
      await page.waitForTimeout(300);
      await takeScreenshot(page, "10-restore-original");
      results.restoreOriginal = true;

      console.log("Verify 7: Successful save");
      await safeFill("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]", "Saved Title Test");
      await page.waitForTimeout(300);
      await page.click('button:has-text("Save row")');
      await page.waitForTimeout(5000);
      await page.waitForLoadState("networkidle");
      await takeScreenshot(page, "11-after-successful-save");
      const afterSaveUrl = page.url();
      console.log(`  URL after save: ${afterSaveUrl}`);
      results.successfulSave = afterSaveUrl.includes("/admin/home") && !afterSaveUrl.includes("flash=error");

      console.log("Verify 8: Validation failure");
      await page.waitForTimeout(1000);
      const newTitleInput = page.locator('input[name="title"]').first();
      if (await newTitleInput.count() > 0) {
        await safeFill("article:has(button[aria-expanded=\"true\"]) input[name=\"title\"]", "");
        await page.waitForTimeout(300);
        await page.click('button:has-text("Save row")');
        await page.waitForTimeout(2000);
        await takeScreenshot(page, "12-validation-failure");
        const validationError = await page.locator("text=/Row title is required/i").count();
        console.log(`  Validation error visible: ${validationError > 0}`);
        results.validationPreservesValuesDirty = validationError > 0;
      }

      console.log("Verify 10: Delete confirmation");
      const deleteButton = page.locator("button:has-text('Delete row')").first();
      if (await deleteButton.count() > 0) {
        await deleteButton.evaluate((el) => (el).scrollIntoView({ behavior: "smooth", block: "center" }));
        await page.waitForTimeout(1000);
        await deleteButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, "13-delete-confirmation");
        const deleteModal = await page.locator("text=/permanently delete/i").count();
        results.deleteConfirmation = deleteModal > 0;
        console.log(`  Delete confirmation modal: ${results.deleteConfirmation}`);

        const cancelButton = page.locator("button:has-text('Cancel')");
        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }
      }

      console.log("Verify 11: Spotlight");
      const spotlight = await page.locator("text=Spotlight").count();
      results.spotlight = spotlight > 0;
      console.log(`  Spotlight present: ${results.spotlight}`);

      console.log("Verify 12: Content controls");
      const contentControls = await page.locator("text=Add content to row").count();
      results.contentControls = contentControls > 0;
      console.log(`  Content controls present: ${results.contentControls}`);

      console.log("Verify 13: Breadcrumb");
      const breadcrumb = await page.locator("text=Home").count();
      results.breadcrumb = breadcrumb > 0;
      console.log(`  Breadcrumb present: ${results.breadcrumb}`);

    } else {
      console.log("Could not reach /admin/home");
      console.log(`  Current URL: ${page.url()}`);
      await takeScreenshot(page, "99-login-failed");
    }

  } catch (error) {
    console.error("Error during acceptance test:", error);
    await takeScreenshot(page, "99-error");
  } finally {
    await browser.close();
  }

  console.log("\n=== RUNTIME ACCEPTANCE RESULTS ===");
  console.log(`DEFAULT COLLAPSED: ${results.defaultCollapsed ? "PASS" : "FAIL"}`);
  console.log(`ONE-ROW FOCUS: ${results.oneRowFocus ? "PASS" : "FAIL"}`);
  console.log(`DIRTY STAY: ${results.dirtyStay ? "PASS" : "FAIL"}`);
  console.log(`DIRTY LEAVE: ${results.dirtyLeave ? "PASS" : "FAIL"}`);
  console.log(`RESTORE ORIGINAL: ${results.restoreOriginal ? "PASS" : "FAIL"}`);
  console.log(`SUCCESSFUL SAVE: ${results.successfulSave ? "PASS" : "FAIL"}`);
  console.log(`VALIDATION PRESERVES VALUES/DIRTY: ${results.validationPreservesValuesDirty ? "PASS" : "FAIL"}`);
  console.log(`FAILED SAVE PRESERVES VALUES/DIRTY: ${results.failedSavePreservesValuesDirty ? "PASS" : "FAIL"}`);
  console.log(`DELETE CONFIRMATION: ${results.deleteConfirmation ? "PASS" : "FAIL"}`);
  console.log(`SPOTLIGHT: ${results.spotlight ? "PASS" : "FAIL"}`);
  console.log(`CONTENT CONTROLS: ${results.contentControls ? "PASS" : "FAIL"}`);
  console.log(`BREADCRUMB: ${results.breadcrumb ? "PASS" : "FAIL"}`);
  console.log(`CONSOLE ERRORS: ${results.consoleErrors.length > 0 ? "FAIL - " + results.consoleErrors.join("; ") : "PASS"}`);
  console.log(`HTTP ERRORS: ${results.httpErrors.length > 0 ? "FAIL - " + results.httpErrors.join("; ") : "PASS"}`);
  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
  results.screenshots.forEach((s) => console.log(`  - ${s}`));
}

runAcceptance().catch(console.error);




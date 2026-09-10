import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const QA_URL = "https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const ADMIN_LOGIN = `${QA_URL}/admin/login`;
const SCREENSHOTS_DIR = path.join(process.cwd(), "scripts", "c08b-06-screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on("console", (msg) => {
    console.log(`[console ${msg.type()}] ${msg.text()}`);
  });

  // Capture network responses
  page.on("response", (response) => {
    if (response.status() >= 400) {
      console.log(`[HTTP ${response.status()}] ${response.url()}`);
    }
  });

  try {
    console.log("Navigating to login page...");
    await page.goto(ADMIN_LOGIN, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "debug-01-login.png"), fullPage: true });
    console.log(`Current URL: ${page.url()}`);

    console.log("Filling login form...");
    await page.fill('input[name="email"]', "0@0nya.com");
    await page.fill('input[name="password"]', "Nile-Quartz-74!mR9");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "debug-02-filled.png"), fullPage: true });

    console.log("Submitting form...");
    // Wait for the form action to complete
    const responsePromise = page.waitForResponse(resp => resp.url().includes("/admin/login") || resp.url().includes("/admin/home") || resp.url().includes("/admin"), { timeout: 10000 }).catch(() => null);
    
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "debug-03-after-submit.png"), fullPage: true });
    console.log(`After submit URL: ${page.url()}`);
    
    // Check page content
    const bodyText = await page.locator("body").innerText();
    console.log(`Page text (first 500 chars): ${bodyText.slice(0, 500)}`);
    
    // Check for specific elements
    const accessDenied = await page.locator("text=Access denied").count();
    const homeHeader = await page.locator("text=Home Rows").count();
    const errorMsg = await page.locator("text=Invalid CMS QA").count();
    
    console.log(`Access denied text: ${accessDenied}`);
    console.log(`Home Rows text: ${homeHeader}`);
    console.log(`Invalid CMS QA text: ${errorMsg}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);

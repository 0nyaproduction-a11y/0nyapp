import { chromium } from 'playwright';

const QA_URL = 'https://onya-qa-api-gwkke6nq5a-el.a.run.app';
const ADMIN_HOME = QA_URL + '/admin/home';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(ADMIN_HOME, { waitUntil: 'networkidle' });
  if (page.url().includes('/admin/login')) {
    await page.fill('input[name=email]', '0@0nya.com');
    await page.fill('input[name=password]', 'Nile-Quartz-74!mR9');
    await page.click('button[type=submit]');
    await page.waitForTimeout(3000);
  }

  await page.evaluate(() => {
    const input = document.querySelector('input[name=title]') as HTMLInputElement | null;
    const form = document.querySelector('form') as HTMLFormElement | null;
    if (!input || !form) return 'missing';

    const events: any[] = [];
    input.addEventListener('input', () => events.push({ source: 'input', value: input.value }));
    form.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      events.push({ source: 'form', targetName: target?.name, value: target?.value });
    });
    (window as any).__events = events;
  });

  const titleInput = page.locator('input[name=title]').first();
  await titleInput.fill('Test Dirty Title');
  await page.waitForTimeout(500);

  const events = await page.evaluate(() => (window as any).__events || []);
  console.log('Events:', JSON.stringify(events, null, 2));

  await browser.close();
}

run().catch(console.error);

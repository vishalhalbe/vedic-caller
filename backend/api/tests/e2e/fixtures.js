// @ts-check
const { test: base } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Extended test fixture that captures an HTML screenshot after every API test.
 * Adds `screenshotPage` — a browser page pre-loaded to about:blank.
 * Call `await recordResult(screenshotPage, title, status, data)` to capture.
 */
const test = base.extend({
  screenshotPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('about:blank');
    await use(page);
    // Screenshot on every test (pass or fail)
    const safeName = testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
    const dir = path.join(__dirname, '../../test-results');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${safeName}.png`), fullPage: true });
    await context.close();
  },
});

/**
 * Render API result to the page so it appears in the screenshot.
 * @param {import('@playwright/test').Page} page
 * @param {string} title  test title
 * @param {number} status HTTP status code
 * @param {unknown} data  response body
 */
async function recordResult(page, title, status, data) {
  const isPass = status >= 200 && status < 400;
  const color = isPass ? '#22c55e' : '#ef4444';
  const json = JSON.stringify(data, null, 2);
  await page.setContent(`<!doctype html>
<html>
<head><style>
  body { font-family: monospace; background: #0f172a; color: #e2e8f0; padding: 24px; margin: 0; }
  h2  { color: ${color}; margin-bottom: 8px; font-size: 16px; }
  .badge { display:inline-block; background:${color}; color:#fff; padding:2px 10px; border-radius:4px; margin-bottom:16px; }
  pre { background:#1e293b; padding:16px; border-radius:8px; font-size:13px; overflow:auto; white-space:pre-wrap; word-break:break-all; }
</style></head>
<body>
  <h2>${title.replace(/</g,'&lt;')}</h2>
  <span class="badge">HTTP ${status}</span>
  <pre>${json.replace(/</g,'&lt;')}</pre>
</body>
</html>`);
}

module.exports = { test, recordResult };

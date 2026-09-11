import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(projectRoot, 'public', 'icons', 'app-icon.svg')).href);
  await page.screenshot({ path: path.join(projectRoot, 'public', 'icons', 'app-icon-512.png'), omitBackground: true });
} finally {
  await browser.close();
}

import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

for (const [path, file] of [
  ['/', '/tmp/new-home.png'],
  ['/subject/japanese', '/tmp/new-subject-jp.png'],
  ['/subject/eq-pc', '/tmp/new-subject-eq.png'],
  ['/flashcards', '/tmp/new-flashcards.png'],
]) {
  await page.goto(`http://localhost:5175${path}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: file });
  console.log('captured', file);
}
await browser.close();

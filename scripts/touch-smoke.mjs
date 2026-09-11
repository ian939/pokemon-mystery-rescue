import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'test-results', 'ipad-touch');
const baseURL = process.env.TEST_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  screen: { width: 1024, height: 768 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'ko-KR',
  colorScheme: 'dark',
});
const page = await context.newPage();

async function audit(label) {
  const result = await page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll('button:not([disabled])')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    const undersized = visibleButtons.map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30), width: Math.round(rect.width), height: Math.round(rect.height) };
    }).filter((item) => item.width < 44 || item.height < 44);
    return {
      touchPoints: navigator.maxTouchPoints,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      undersized,
    };
  });
  if (result.touchPoints < 1) throw new Error(`${label}: touch emulation is not active`);
  if (!result.viewport?.includes('maximum-scale=1') || !result.viewport.includes('user-scalable=no')) throw new Error(`${label}: locked mobile viewport is missing`);
  if (result.horizontalOverflow > 1) throw new Error(`${label}: horizontal overflow ${result.horizontalOverflow}px`);
  if (result.undersized.length) throw new Error(`${label}: undersized touch targets ${JSON.stringify(result.undersized)}`);
  console.log(`PASS ${label}: ${result.touchPoints} touch point(s), targets >=44px, no horizontal overflow`);
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  // 웹폰트와 서비스워커 등록이 비동기로 시작된 뒤에도 화면 상태가 유지되어야 한다.
  await page.waitForTimeout(1500);
  await audit('landing');
  await page.screenshot({ path: path.join(outputDir, '01-landing.png') });

  await page.getByRole('button', { name: /초기화/ }).click();
  await page.getByRole('heading', { name: '처음부터 다시 시작할까요?' }).waitFor();
  await audit('reset confirmation');
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '난이도 2단계' }).click();
  if (!(await page.getByRole('button', { name: '난이도 2단계' }).evaluate((element) => element.classList.contains('selected')))) throw new Error('difficulty 2 control did not activate');
  await page.getByRole('button', { name: '난이도 1단계' }).click();
  console.log('PASS top-right controls: difficulty 1–3 and guarded reset dialog');

  await page.getByRole('button', { name: '보호자 설정' }).click();
  const guardianHold = page.getByRole('button', { name: /2초 동안 길게 누르기/ });
  await guardianHold.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(1900);
  await page.getByRole('heading', { name: '설정과 진행 기록' }).waitFor();
  await audit('parent settings');
  await page.getByRole('button', { name: '2단계', exact: true }).click();
  if (!(await page.getByRole('button', { name: '2단계', exact: true }).evaluate((element) => element.classList.contains('selected')))) throw new Error('parent difficulty 2 control did not activate');
  await page.getByRole('button', { name: '1단계', exact: true }).click();
  await page.getByRole('button', { name: /초기화/ }).click();
  await page.getByRole('heading', { name: '처음부터 다시 시작할까요?' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();
  const adultActionsAllowed = await page.evaluate(() => {
    const target = document.querySelector('.settings-card');
    if (!target) throw new Error('adult settings surface not found');
    const select = new Event('selectstart', { bubbles: true, cancelable: true });
    const copy = new Event('copy', { bubbles: true, cancelable: true });
    target.dispatchEvent(select);
    target.dispatchEvent(copy);
    return !select.defaultPrevented && !copy.defaultPrevented;
  });
  if (!adultActionsAllowed) throw new Error('adult selection or clipboard action was blocked');
  await page.screenshot({ path: path.join(outputDir, '02-parent-settings.png') });
  console.log('PASS parent controls: difficulty 1–3, guarded reset, adult selection allowed');
  await page.getByRole('button', { name: '←', exact: true }).click();

  const guardrails = await page.evaluate(() => {
    const target = document.querySelector('.child-surface');
    if (!target) throw new Error('child surface not found');
    const gesture = new Event('gesturestart', { bubbles: true, cancelable: true });
    const select = new Event('selectstart', { bubbles: true, cancelable: true });
    const contextmenu = new Event('contextmenu', { bubbles: true, cancelable: true });
    const multi = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(multi, 'touches', { value: [{ identifier: 1 }, { identifier: 2 }] });
    target.dispatchEvent(gesture);
    target.dispatchEvent(select);
    target.dispatchEvent(contextmenu);
    target.dispatchEvent(multi);
    const firstTap = new Event('touchend', { bubbles: true, cancelable: true });
    const secondTap = new Event('touchend', { bubbles: true, cancelable: true });
    target.dispatchEvent(firstTap);
    target.dispatchEvent(secondTap);
    return {
      gesture: gesture.defaultPrevented,
      selection: select.defaultPrevented,
      contextmenu: contextmenu.defaultPrevented,
      multiTouch: multi.defaultPrevented,
      doubleTap: secondTap.defaultPrevented,
    };
  });
  if (Object.values(guardrails).some((value) => !value)) throw new Error(`guardrail failure: ${JSON.stringify(guardrails)}`);
  console.log(`PASS gesture guardrails: ${JSON.stringify(guardrails)}`);

  await page.getByRole('button', { name: /모험 시작하기|탐험 계속하기/ }).click();
  await audit('map');
  await page.screenshot({ path: path.join(outputDir, '03-map.png') });
  await page.getByRole('button', { name: '사건 조사하기' }).first().click();
  await page.getByRole('button', { name: /조사 시작/ }).click();
  await audit('charizard room');
  await page.screenshot({ path: path.join(outputDir, '04-charizard-room.png') });
  await page.getByRole('button', { name: /젖은 항해 일지, 조사 가능/ }).click();
  await audit('puzzle overlay');
  await page.screenshot({ path: path.join(outputDir, '05-first-puzzle.png') });
  console.log(`Screenshots: ${outputDir}`);
} finally {
  await browser.close();
}

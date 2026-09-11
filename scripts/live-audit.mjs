/* 배포된 실물을 iPad 가로 화면으로 훑으며 화면마다 문제를 찾는다.
   node scripts/live-audit.mjs [난이도]            → 배포본 점검
   TEST_URL=http://127.0.0.1:4173 node scripts/live-audit.mjs 1  → 로컬 점검 */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const difficulty = process.argv[2] ?? '1';
const baseURL = process.env.TEST_URL ?? 'https://ian939.github.io/pokemon-mystery-rescue/';
const outputDir = path.join(projectRoot, 'test-results', `live-d${difficulty}`);
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
await mkdir(outputDir, { recursive: true });

const ROOMS = [
  { id: 'charizard', puzzles: ['charizard-log', 'charizard-signal', 'charizard-furnace', 'charizard-lens', 'charizard-wings', 'charizard-beacon'] },
  { id: 'snorlax', puzzles: ['snorlax-note', 'snorlax-basket', 'snorlax-melody', 'snorlax-bells', 'snorlax-blanket', 'snorlax-route'] },
  { id: 'gengar', puzzles: ['gengar-invite', 'gengar-lights', 'gengar-props', 'gengar-hall', 'gengar-shadow', 'gengar-finale'] },
  { id: 'blastoise', puzzles: ['blastoise-log', 'blastoise-gauges', 'blastoise-tank', 'blastoise-valves', 'blastoise-cannons', 'blastoise-route'] },
];
const ALL_ROOM_IDS = ROOMS.map((room) => room.id);

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'ko-KR' });
const page = await context.newPage();
page.setDefaultTimeout(15000);

const problems = [];
const note = (where, message) => { problems.push(`${where}: ${message}`); console.log(`  ! ${where}: ${message}`); };

page.on('console', (message) => { if (message.type() === 'error') note('console', message.text().slice(0, 200)); });
page.on('pageerror', (error) => note('pageerror', String(error).slice(0, 200)));
page.on('requestfailed', (request) => note('network', `${request.failure()?.errorText} ${request.url().slice(0, 120)}`));
page.on('response', (response) => { if (response.status() >= 400) note('http', `${response.status()} ${response.url().slice(0, 120)}`); });

let shot = 0;
const snap = async (name) => page.screenshot({ path: path.join(outputDir, `${String(++shot).padStart(2, '0')}-${name}.png`) });

/** 아이가 실제로 겪는 종류의 문제만 본다: 잘린 내용, 가로 스크롤, 작은 버튼, 겹친 글자. */
async function audit(label) {
  const found = await page.evaluate(() => {
    const issues = [];
    const doc = document.documentElement;
    if (doc.scrollWidth - doc.clientWidth > 1) issues.push(`가로 넘침 ${doc.scrollWidth - doc.clientWidth}px`);

    // iPad 가로는 방향이 고정돼 있다. 아이 화면이 한 화면에 안 들어가면 스크롤을 스스로 찾아내야 한다.
    // 보호자 화면은 어른이 읽는 기록 페이지라 스크롤이 정상이다.
    const overshoot = doc.scrollHeight - window.innerHeight;
    if (overshoot > 4 && !document.querySelector('[data-adult="true"]')) issues.push(`세로 넘침 ${overshoot}px — 스크롤해야 나머지가 보임`);

    const stage = document.querySelector('.puzzle-stage');
    if (stage && stage.scrollHeight - stage.clientHeight > 4) issues.push(`퍼즐 내용이 ${stage.scrollHeight - stage.clientHeight}px 잘려 스크롤해야 보임`);

    const panel = document.querySelector('.puzzle-panel');
    if (panel) {
      const box = panel.getBoundingClientRect();
      if (box.top < -1 || box.bottom > window.innerHeight + 1) issues.push(`퍼즐 창이 화면 밖으로 ${Math.round(Math.max(-box.top, box.bottom - window.innerHeight))}px 벗어남`);
    }

    const small = [];
    for (const element of document.querySelectorAll('button:not([disabled]), [role="button"]')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(element).visibility === 'hidden') continue;
      if (box.width < 43.5 || box.height < 43.5) {
        small.push(`${(element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 18)} ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    if (small.length) issues.push(`44px 미만 버튼 ${small.length}개: ${small.slice(0, 4).join(', ')}`);
    return issues;
  });
  found.forEach((issue) => note(label, issue));
  return found.length === 0;
}

/** 진행 상황의 원본은 IndexedDB다. 임의의 퍼즐을 열려면 여기를 고쳐야 한다. */
async function patchProgress(patch) {
  await page.evaluate((patch) => new Promise((resolve, reject) => {
    const request = indexedDB.open('mystery-rescue-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const store = db.transaction('game', 'readwrite').objectStore('game');
      const read = store.get('player-progress');
      read.onsuccess = () => {
        const next = { schemaVersion: 2, ...read.result, ...patch };
        const write = store.put(next, 'player-progress');
        write.onsuccess = () => { localStorage.setItem('mystery-rescue-progress', JSON.stringify(next)); db.close(); resolve(); };
        write.onerror = () => reject(write.error);
      };
      read.onerror = () => reject(read.error);
    };
  }), patch);
  await page.reload({ waitUntil: 'networkidle' });
}

/** 이 방의 index번째 퍼즐이 '조사 가능'해지도록 앞 퍼즐을 해결 처리한다. */
async function openRoomAt(roomId, index) {
  const completedPuzzleIds = Object.fromEntries(ALL_ROOM_IDS.map((id) => [id, []]));
  const room = ROOMS.find((entry) => entry.id === roomId);
  completedPuzzleIds[roomId] = room.puzzles.slice(0, index);
  const previous = ALL_ROOM_IDS.slice(0, ALL_ROOM_IDS.indexOf(roomId));
  for (const id of previous) completedPuzzleIds[id] = ROOMS.find((entry) => entry.id === id).puzzles;
  await patchProgress({
    completedPuzzleIds,
    unlockedIllustrations: previous,
    completedRooms: previous.map((id) => ({ roomId: id, completedAt: new Date().toISOString(), durationSeconds: 500, maxHintLevel: 1, replayCount: 0 })),
  });
  await page.getByRole('button', { name: /모험 시작하기|탐험 계속하기/ }).click();
  await page.locator(`.case-card.${roomId} .case-button`).click();
  await page.getByRole('button', { name: /조사 시작/ }).click();
  await page.waitForTimeout(400);
}

try {
  console.log(`대상: ${baseURL}  난이도 ${difficulty}`);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  if (difficulty !== '1') await page.getByRole('button', { name: `난이도 ${difficulty}단계` }).click();
  await page.waitForTimeout(400);
  await audit('시작 화면');
  await snap('landing');

  await page.getByRole('button', { name: /모험 시작하기|탐험 계속하기/ }).click();
  await page.waitForTimeout(400);
  const caseCount = await page.locator('.case-card').count();
  console.log(`지도의 사건 카드: ${caseCount}개`);
  await audit('사건 지도');
  await snap('map');

  for (const room of ROOMS) {
    console.log(`\n[${room.id}]`);
    for (let index = 0; index < room.puzzles.length; index += 1) {
      await openRoomAt(room.id, index);
      if (index === 0) { await audit(`${room.id} 방 화면`); await snap(`room-${room.id}`); }
      const hotspot = page.locator('.hotspot.is-current').first();
      await hotspot.click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(500);
      const title = await page.locator('#puzzle-title').textContent();
      const ok = await audit(`${room.puzzles[index]} (${title?.trim()})`);
      await snap(`puzzle-${room.puzzles[index]}`);
      if (ok) console.log(`  ok ${room.puzzles[index]} ${title?.trim()}`);
      await page.getByRole('button', { name: '퍼즐 닫기' }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
  }

  // 도감과 보호자 화면
  await patchProgress({
    completedPuzzleIds: Object.fromEntries(ROOMS.map((room) => [room.id, room.puzzles])),
    unlockedIllustrations: ALL_ROOM_IDS,
    completedRooms: ALL_ROOM_IDS.map((id) => ({ roomId: id, completedAt: new Date().toISOString(), durationSeconds: 540, maxHintLevel: 1, replayCount: 0 })),
  });
  await page.getByRole('button', { name: /탐험 도감/ }).click();
  await page.waitForTimeout(700);
  await audit('탐험 도감');
  await snap('gallery');

  await page.getByRole('button', { name: '장면 다시 보기|도감 크게 보기' }).first().click().catch(async () => {
    await page.locator('.gallery-copy button').first().click();
  });
  await page.waitForTimeout(1600);
  await audit('도감 상세');
  await snap('reward');

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '보호자 설정' }).click();
  const hold = page.getByRole('button', { name: /2초 동안 길게 누르기/ });
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await audit('보호자 화면');
  await snap('parent');

  await writeFile(path.join(outputDir, 'problems.txt'), problems.join('\n'), 'utf8');
  console.log(`\n${problems.length ? `문제 ${problems.length}건` : '문제 없음'} · ${shot}장 → ${outputDir}`);
} finally {
  await browser.close();
}

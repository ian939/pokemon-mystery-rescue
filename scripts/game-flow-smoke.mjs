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
const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ko-KR' });
const page = await context.newPage();
page.setDefaultTimeout(8000);

const dialog = () => page.getByRole('dialog');
async function openCurrent(name) {
  await page.getByRole('button', { name: new RegExp(`${name}, 조사 가능`) }).click();
  await dialog().waitFor();
}
async function waitSolved() { await dialog().waitFor({ state: 'detached', timeout: 6000 }); }
async function tap(name, exact = true) { await dialog().getByRole('button', { name, exact }).click(); }
async function mirror(cells) { for (const cell of cells) await dialog().locator(`[data-mirror-cell="${cell}"]`).click(); }
async function startNextCase() {
  await page.getByRole('button', { name: /사건 조사하기/ }).click();
  await page.getByRole('button', { name: /조사 시작/ }).click();
}
async function finishCase(rewardTitle, screenshotName) {
  await page.getByRole('heading', { name: rewardTitle }).waitFor();
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(outputDir, screenshotName) });
  await page.getByRole('button', { name: /다음에 계속/ }).click();
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /모험 시작하기|탐험 계속하기/ }).click();
  await startNextCase();

  await openCurrent('젖은 항해 일지');
  for (const word of ['밝은', '뜨거운']) await tap(word);
  await tap('기록 맞추기');
  await waitSolved();

  await openCurrent('바람 신호 번역기');
  for (const [index, word] of ['FIRE', 'WING', 'WIND'].entries()) {
    await dialog().getByRole('button', { name: new RegExp(word) }).click();
    if (index < 2) await dialog().locator('.progress-pips i.done').nth(index).waitFor();
  }
  await waitSolved();

  await openCurrent('봉화 에너지 계기');
  for (const number of [6, 4]) await tap(`불꽃 에너지 ${number}`);
  await tap('에너지 보내기');
  await waitSolved();

  await openCurrent('회전 렌즈 규칙');
  await tap('파란 동그라미');
  await waitSolved();

  await openCurrent('날개 균형 홀로그램');
  await mirror(['0,4', '1,5', '1,4', '2,5', '2,4', '2,3', '3,5', '3,4', '4,4']);
  await tap('빛 쏘기');
  await waitSolved();

  await openCurrent('봉화대 암호판');
  for (const digit of ['3', '1', '4', '2']) await tap(digit);
  await tap('확인');
  await waitSolved();
  await finishCase('하늘불꽃의 수호자, 리자몽', '06-charizard-reward.png');
  console.log('PASS 리자몽: 6개 퍼즐과 도감 보상');

  await startNextCase();
  await openCurrent('바람에 날린 간식 쪽지');
  await tap('빨간');
  await tap('쪽지 완성하기');
  await waitSolved();
  await openCurrent('나무열매 바구니');
  await dialog().getByRole('button', { name: /가운데 나무/ }).click();
  await waitSolved();
  await openCurrent('코골이 음표 계단');
  await tap('2씩 커져요'); await tap('8'); await waitSolved();
  await openCurrent('꿈속 방향 종');
  for (const direction of ['왼쪽', '오른쪽', '위쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('달빛 담요 그림자');
  await tap('그림자 후보 2번'); await waitSolved();
  await openCurrent('완성된 축제길 지도');
  for (const cell of [15, 10, 11, 6, 7, 2, 3, 4]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await finishCase('달빛 축제의 주인공, 잠만보', '07-snorlax-reward.png');
  console.log('PASS 잠만보: 6개 퍼즐과 도감 보상');

  await startNextCase();
  await openCurrent('뒤섞인 공연 초대장');
  await tap('가운데'); await tap('초대장 완성하기'); await waitSolved();
  await openCurrent('달빛 전구 행렬');
  await tap('파란 별'); await waitSolved();
  await openCurrent('유령 소품 이름표');
  for (const [index, word] of ['GHOST', 'MOON', 'STAR'].entries()) {
    await dialog().getByRole('button', { name: new RegExp(word) }).click();
    if (index < 2) await dialog().locator('.progress-pips i.done').nth(index).waitFor();
  }
  await waitSolved();
  await openCurrent('거울 복도 방향등');
  for (const direction of ['오른쪽', '위쪽', '왼쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('무대 뒤 장난 그림자');
  await tap('그림자 후보 3번'); await waitSolved();
  await openCurrent('피날레 조명 암호');
  for (const digit of ['2', '4', '1', '3']) await tap(digit);
  await tap('확인'); await waitSolved();
  await finishCase('웃음 무대의 마술사, 팬텀', '08-gengar-reward.png');
  console.log('PASS 팬텀: 6개 퍼즐과 도감 보상');

  await startNextCase();
  await openCurrent('번진 수문 기록');
  for (const word of ['깊은', '젖은']) await tap(word);
  await tap('기록 맞추기'); await waitSolved();
  await openCurrent('세 갈래 물방울 압력계');
  await dialog().getByRole('button', { name: /가운데 압력계/ }).click(); await waitSolved();
  await openCurrent('파도 에너지 탱크');
  for (const number of [4, 6]) await tap(`물 에너지 ${number}`);
  await tap('에너지 보내기'); await waitSolved();
  await openCurrent('수문 밸브 번호');
  await tap('5씩 커져요'); await tap('20'); await waitSolved();
  await openCurrent('쌍둥이 물대포 조준판');
  await mirror(['0,4', '1,5', '1,4', '2,5', '2,4', '2,3', '3,5', '3,4', '4,4']);
  await tap('빛 쏘기'); await waitSolved();
  await openCurrent('완성된 산호 수로 지도');
  for (const cell of [0, 1, 6, 11, 16, 17, 18, 19]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await page.getByRole('heading', { name: '푸른 항구의 대장, 거북왕' }).waitFor();
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(outputDir, '09-blastoise-reward.png') });
  console.log('PASS 거북왕: 6개 퍼즐과 도감 보상');

  await page.getByRole('button', { name: /다음에 계속/ }).click();
  await startNextCase();

  await openCurrent('찢어진 연구 노트');
  for (const word of ['밝은', '켜진']) await tap(word);
  await tap('기록 맞추기'); await waitSolved();
  await openCurrent('단어 분석기');
  for (const [index, word] of ['BOLT', 'LAMP', 'KEY'].entries()) {
    await dialog().getByRole('button', { name: new RegExp(word) }).click();
    if (index < 2) await dialog().locator('.progress-pips i.done').nth(index).waitFor();
  }
  await waitSolved();
  await openCurrent('에너지 발전기');
  for (const number of [3, 7]) await tap(`전기 조각 ${number}`);
  await tap('에너지 보내기'); await waitSolved();
  await openCurrent('타입 표본 선반');
  await tap('빨간 별'); await waitSolved();
  await openCurrent('홀로그램 투영기');
  await mirror(['0,3', '1,4', '1,3', '2,5', '2,4', '2,3', '3,4', '4,3']);
  await tap('빛 쏘기'); await waitSolved();
  await openCurrent('보안 키패드');
  for (const digit of ['4', '2', '1', '3']) await tap(digit);
  await tap('확인'); await waitSolved();
  await finishCase('다시 빛난 별빛 연구소, 피카츄', '10-pikachu-reward.png');
  console.log('PASS 피카츄: 6개 퍼즐과 도감 보상');

  await startNextCase();

  await openCurrent('부서진 안내판');
  await tap('빨간'); await tap('안내판 붙이기'); await waitSolved();
  await openCurrent('세 갈래 열매 나무');
  await dialog().getByRole('button', { name: /가운데 나무/ }).click(); await waitSolved();
  await openCurrent('개울의 디딤돌');
  await tap('2씩 커져요'); await tap('7'); await waitSolved();
  await openCurrent('동굴의 방향 문자');
  for (const direction of ['오른쪽', '왼쪽', '아래쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('손전등 그림자');
  await tap('그림자 후보 2번'); await waitSolved();
  await openCurrent('완성된 숲 지도');
  for (const cell of [15, 10, 11, 6, 7, 2, 3, 4]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await page.getByRole('heading', { name: '안개 너머의 친구, 이브이' }).waitFor();
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(outputDir, '11-eevee-reward.png') });
  console.log('PASS 이브이: 6개 퍼즐과 도감 보상');

  await page.getByRole('button', { name: '도감 보기' }).click();
  await page.getByRole('heading', { name: '탐험 도감' }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, '12-pokedex-gallery.png'), fullPage: true });
  console.log('PASS Pokédex gallery: six completed entries rendered');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mystery-rescue-progress') ?? '{}'));
  if (persisted.schemaVersion !== 2 || persisted.unlockedIllustrations?.length !== 6 || persisted.completedRooms?.length !== 6) throw new Error(`progress did not persist: ${JSON.stringify(persisted)}`);
  console.log('PASS persistence: 6 cases and 6 Pokédex entries saved locally');

  await page.waitForFunction(() => navigator.serviceWorker?.controller, undefined, { timeout: 8000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /미스터리 구조대/ }).waitFor();
  console.log('PASS PWA offline reload: app shell, six artworks, and progress restored');
  await context.setOffline(false);
} finally {
  await browser.close();
}

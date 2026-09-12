import { chromium } from 'playwright-core';

const baseURL = process.env.TEST_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ko-KR' });
const page = await context.newPage();
page.setDefaultTimeout(9000);
const dialog = () => page.getByRole('dialog');

async function openCurrent(name) { await page.getByRole('button', { name: new RegExp(`${name}, 조사 가능`) }).click(); await dialog().waitFor(); }
async function waitSolved() { await dialog().waitFor({ state: 'detached', timeout: 6000 }); }
async function tap(name, exact = true) { await dialog().getByRole('button', { name, exact }).click(); }
async function mirror(cells) { for (const cell of cells) await dialog().locator(`[data-mirror-cell="${cell}"]`).click(); }
async function startNextCase() { await page.getByRole('button', { name: /사건 조사하기/ }).click(); await page.getByRole('button', { name: /조사 시작/ }).click(); }
async function nextCase(rewardTitle) { await page.getByRole('heading', { name: rewardTitle }).waitFor(); await page.getByRole('button', { name: /다음에 계속/ }).click(); }
async function spell(words) {
  for (const [index, word] of words.entries()) {
    for (const letter of word) await dialog().getByRole('button', { name: letter, exact: true }).first().click();
    if (index < words.length - 1) await dialog().locator('.progress-pips i.done').nth(index).waitFor();
  }
  await waitSolved();
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '난이도 3단계' }).click();
  await page.getByRole('button', { name: /모험 시작하기|탐험 계속하기/ }).click();
  await startNextCase();

  await openCurrent('젖은 항해 일지');
  if (await dialog().locator('.antonym-line').count() !== 4) throw new Error('difficulty 3 antonym count is not 4');
  await tap('힌트 1 보기'); await tap('다음 힌트');
  if (!(await dialog().getByRole('button', { name: '힌트 모두 봤어' }).isDisabled())) throw new Error('hint must stop at level 2');
  for (const word of ['밝은', '뜨거운', '마른', '높은']) await tap(word);
  await tap('기록 맞추기'); await waitSolved();
  await openCurrent('바람 신호 번역기'); await spell(['FIRE', 'WING', 'WIND']);
  await openCurrent('봉화 에너지 계기');
  for (const number of [3, 9, 8]) await tap(`불꽃 에너지 ${number}`);
  await tap('에너지 보내기'); await waitSolved();
  await openCurrent('회전 렌즈 규칙'); await tap('빨간 동그라미'); await waitSolved();
  await openCurrent('날개 균형 홀로그램');
  await mirror(['5,1', '5,2', '5,3', '5,4', '4,0', '4,1', '4,4', '4,5', '3,0', '3,2', '3,3', '3,5']);
  await tap('빛 쏘기'); await waitSolved();
  await openCurrent('봉화대 암호판');
  for (const digit of ['4', '6', '2', '5']) await tap(digit);
  await tap('확인'); await waitSolved();
  await nextCase('하늘불꽃의 수호자, 리자몽');
  console.log('PASS difficulty 3 리자몽');

  await startNextCase();
  await openCurrent('바람에 날린 간식 쪽지');
  for (const word of ['빨간', '열매가', '가장', '적은']) await tap(word);
  await tap('쪽지 완성하기'); await waitSolved();
  await openCurrent('나무열매 바구니'); await tap('5'); await waitSolved();
  await openCurrent('코골이 음표 계단'); await tap('3씩 작아져요'); await tap('11'); await waitSolved();
  await openCurrent('꿈속 방향 종');
  for (const direction of ['위쪽', '왼쪽', '아래쪽', '오른쪽', '왼쪽', '위쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('달빛 담요 그림자'); await tap('그림자 후보 2번'); await waitSolved();
  await openCurrent('완성된 축제길 지도');
  for (const cell of [15, 10, 11, 6, 7, 2, 3, 4]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await nextCase('달빛 축제의 주인공, 잠만보');
  console.log('PASS difficulty 3 잠만보');

  await startNextCase();
  await openCurrent('뒤섞인 공연 초대장');
  for (const word of ['팬텀은', '친구들을', '웃게', '했어요']) await tap(word);
  await tap('초대장 완성하기'); await waitSolved();
  await openCurrent('달빛 전구 행렬'); await tap('노란 별'); await waitSolved();
  await openCurrent('유령 소품 이름표'); await spell(['GHOST', 'MOON', 'STAR']);
  await openCurrent('거울 복도 방향등');
  for (const direction of ['오른쪽', '아래쪽', '왼쪽', '위쪽', '위쪽', '오른쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('무대 뒤 장난 그림자'); await tap('그림자 후보 2번'); await waitSolved();
  await openCurrent('피날레 조명 암호');
  for (const digit of ['5', '2', '8', '4']) await tap(digit);
  await tap('확인'); await waitSolved();
  await nextCase('웃음 무대의 마술사, 팬텀');
  console.log('PASS difficulty 3 팬텀');

  await startNextCase();
  await openCurrent('번진 수문 기록');
  for (const word of ['깊은', '젖은', '맑은', '느린']) await tap(word);
  await tap('기록 맞추기'); await waitSolved();
  await openCurrent('세 갈래 물방울 압력계'); await tap('7'); await waitSolved();
  await openCurrent('파도 에너지 탱크');
  for (const number of [2, 7, 11]) await tap(`물 에너지 ${number}`);
  await tap('에너지 보내기'); await waitSolved();
  await openCurrent('수문 밸브 번호'); await tap('5씩 작아져요'); await tap('15'); await waitSolved();
  await openCurrent('쌍둥이 물대포 조준판');
  await mirror(['5,1', '5,2', '5,3', '5,4', '4,0', '4,1', '4,4', '4,5', '3,0', '3,2', '3,3', '3,5']);
  await tap('빛 쏘기'); await waitSolved();
  await openCurrent('완성된 산호 수로 지도');
  for (const cell of [0, 1, 6, 11, 16, 17, 18, 19]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await nextCase('푸른 항구의 대장, 거북왕');
  console.log('PASS difficulty 3 거북왕');

  await startNextCase();
  await openCurrent('찢어진 연구 노트');
  for (const word of ['밝은', '켜진', '가벼운', '열린']) await tap(word);
  await tap('기록 맞추기'); await waitSolved();
  // 난이도 3의 단어 분석기는 고르기가 아니라 글자를 순서대로 눌러 쓰는 문제다.
  await openCurrent('단어 분석기');
  for (const [index, word] of ['BOLT', 'LAMP', 'KEY'].entries()) {
    for (const letter of word) await tap(letter);
    if (index < 2) await dialog().locator('.progress-pips i.done').nth(index).waitFor();
  }
  await waitSolved();
  await openCurrent('에너지 발전기');
  for (const number of [4, 7, 9]) await tap(`전기 조각 ${number}`);
  await tap('에너지 보내기'); await waitSolved();
  await openCurrent('타입 표본 선반'); await tap('노란 세모'); await waitSolved();
  // 가로 거울선: 위 세 줄과 똑같이 아래 세 줄을 채운다.
  await openCurrent('홀로그램 투영기');
  await mirror(['5,0', '5,1', '5,4', '5,5', '4,1', '4,2', '4,3', '4,4', '3,0', '3,2', '3,3', '3,5']);
  await tap('빛 쏘기'); await waitSolved();
  await openCurrent('보안 키패드');
  for (const digit of ['7', '2', '6', '1']) await tap(digit);
  await tap('확인'); await waitSolved();
  await nextCase('다시 빛난 별빛 연구소, 피카츄');
  console.log('PASS difficulty 3 피카츄');

  await startNextCase();
  await openCurrent('부서진 안내판');
  for (const word of ['빨간', '열매가', '가장', '적은']) await tap(word);
  await tap('안내판 붙이기'); await waitSolved();
  await openCurrent('세 갈래 열매 나무'); await tap('5'); await waitSolved();
  await openCurrent('개울의 디딤돌'); await tap('3씩 작아져요'); await tap('9'); await waitSolved();
  await openCurrent('동굴의 방향 문자');
  for (const direction of ['왼쪽', '아래쪽', '위쪽', '오른쪽', '아래쪽', '왼쪽']) await tap(direction);
  await waitSolved();
  await openCurrent('손전등 그림자'); await tap('그림자 후보 2번'); await waitSolved();
  await openCurrent('완성된 숲 지도');
  for (const cell of [15, 10, 11, 6, 7, 2, 3, 4]) await dialog().locator(`[data-route-cell="${cell}"]`).click();
  await tap('이 길로 가기'); await waitSolved();
  await page.getByRole('heading', { name: '안개 너머의 친구, 이브이' }).waitFor();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mystery-rescue-progress') ?? '{}'));
  if (saved.settings?.difficulty !== 3 || saved.completedRooms?.length !== 6) throw new Error('difficulty 3 progress did not persist for all cases');
  console.log('PASS difficulty 3 이브이');
  console.log('PASS difficulty 3: all 36 puzzles; hint cap exactly 2');
} finally {
  await browser.close();
}

/* 화면에 실제로 쓰는 글자만 골라 웹폰트를 내려받아 public/fonts 에 넣는다.
   한글 전체를 담으면 1MB가 넘어 오프라인 PWA에 넣기 어렵다. 문구를 고친 뒤 다시 실행할 것.
   node scripts/fetch-fonts.mjs */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(projectRoot, 'public', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** 표시용과 손글씨용 두 벌만 싣는다. 본문은 iPad에 이미 있는 Apple SD Gothic Neo를 쓴다. */
const FONTS = [
  { family: 'Jua', query: 'Jua', file: 'jua', weight: '400' },
  { family: 'Gaegu', query: 'Gaegu:wght@700', file: 'gaegu-700', weight: '700' },
];

async function collectText() {
  const roots = [path.join(projectRoot, 'src'), path.join(projectRoot, 'index.html')];
  const files = [];
  const walk = async (target) => {
    const stat = await readdir(target, { withFileTypes: true }).catch(() => null);
    if (!stat) return files.push(target);
    for (const entry of stat) {
      const next = path.join(target, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (/\.(tsx?|html|css)$/.test(entry.name)) files.push(next);
    }
  };
  for (const root of roots) await walk(root);
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  return contents.join('');
}

const source = await collectText();
// 소스에 있는 글자 + 숫자·알파벳·기본 문장부호. 별명처럼 자유 입력되는 글자는 본문 글꼴이 받는다.
const extra = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!?·…()[]%/+-=×÷↔→←↑↓✓';
const characters = [...new Set([...source, ...extra])]
  .filter((character) => /[가-힣 -~ -ÿ‐-⇿✓]/.test(character))
  .sort()
  .join('');

await mkdir(fontDir, { recursive: true });
const faces = [];

for (const font of FONTS) {
  const url = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap&text=${encodeURIComponent(characters)}`;
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((response) => {
    if (!response.ok) throw new Error(`${font.family}: ${response.status}`);
    return response.text();
  });
  // text= 로 잘라낸 서브셋은 .woff2 확장자 없는 /l/font?kit=... 주소로 온다.
  const found = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('woff2'\)/);
  if (!found) throw new Error(`${font.family}: woff2 url not found`);
  const bytes = Buffer.from(await fetch(found[1], { headers: { 'User-Agent': UA } }).then((response) => response.arrayBuffer()));
  await writeFile(path.join(fontDir, `${font.file}.woff2`), bytes);
  faces.push(`@font-face {\n  font-family: "${font.family}";\n  src: url("../fonts/${font.file}.woff2") format("woff2");\n  font-weight: ${font.weight};\n  font-style: normal;\n  font-display: swap;\n}`);
  console.log(`${font.family}: ${(bytes.length / 1024).toFixed(1)} KB`);
}

await writeFile(
  path.join(projectRoot, 'src', 'fonts.css'),
  `/* scripts/fetch-fonts.mjs 가 만든 파일. 직접 고치지 말 것.\n   화면에 쓰는 글자 ${characters.length}자만 담긴 서브셋이라 인터넷 없이도 뜬다. */\n\n${faces.join('\n\n')}\n`,
);
console.log(`subset: ${characters.length} glyphs`);

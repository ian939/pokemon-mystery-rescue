import { useEffect, useMemo, useRef, useState } from 'react';
import type { Difficulty, HintSpeed, PuzzleDefinition, RoomId } from '../types';

const roomPuzzleLabel: Record<RoomId, string> = {
  charizard: '불꽃 등대 단서',
  snorlax: '달빛 축제 단서',
  gengar: '유령 극장 단서',
  blastoise: '산호 수문 단서',
};

type Props = {
  puzzle: PuzzleDefinition;
  roomId: RoomId;
  hintSpeed: HintSpeed;
  difficulty: Difficulty;
  onClose: () => void;
  onSolve: () => void;
  onHint: (level: 1 | 2) => void;
  speak: (text: string, lang?: 'ko-KR' | 'en-US', rate?: number) => void;
};

const HINT_TIMES: Record<HintSpeed, number[]> = {
  fast: [15, 35],
  normal: [25, 55],
  slow: [40, 80],
};

function instructionFor(puzzle: PuzzleDefinition, difficulty: Difficulty): string {
  if (difficulty === 1) return puzzle.instruction;
  const advanced: Partial<Record<PuzzleDefinition['kind'], [string, string]>> = {
    antonyms: ['빈칸 3개를 모두 반대되는 말로 채우자.', '빈칸 4개를 모두 반대되는 말로 채우자.'],
    wordMatch: ['그림을 보고 알맞은 영어 단어를 누르자. 이번엔 첫 글자를 알려주지 않아.', '그림을 보고 글자를 순서대로 눌러 단어를 완성하자.'],
    sumTen: ['에너지 조각 3개를 골라 칸 15개를 채우자.', '에너지 조각 3개를 골라 칸 20개를 채우자.'],
    pattern: ['가운데 빈 캡슐에 들어갈 것을 찾자.', '모양과 색이 각각 다른 규칙으로 반복돼. 빈 캡슐을 찾자.'],
    symmetry: ['거울선 반대쪽을 똑같이 채우자. 칸이 더 넓어졌어.', '이번 거울선은 가로야. 아래쪽을 위와 똑같이 채우자.'],
    keypad: ['카드의 계산을 풀어 네 자리 암호를 누르자.', '카드에 적힌 순서대로 계산해 암호를 누르자.'],
    sentence: ['그림을 보고 빈칸 2개를 채우자.', '말 조각을 문장이 되도록 순서대로 고르자.'],
    berries: ['양쪽 끝 두 나무의 열매를 더하면 몇 개일까?', '가장 많은 나무와 가장 적은 나무의 열매 차이는 몇 개일까?'],
    sequence: ['규칙을 고르고, 다음 디딤돌의 수를 고르자.', '수가 줄어들고 있어. 규칙을 고르고 다음 수를 고르자.'],
    directions: ['영어 단어 4개를 차례로 읽고 발판을 밟자.', '단어 두 개가 한 번에 나와. 읽은 순서대로 두 번 밟자.'],
    shadow: ['비슷한 모양 중에서 그림자와 같은 것을 고르자.', '그림자는 뒤집혀 있어. 돌려 생각하고 같은 모양을 고르자.'],
    route: ['표식을 순서대로 지나 바위를 피해 길을 그리자.', '표식을 순서대로 지나되 가장 짧은 길로 그리자.'],
  };
  return advanced[puzzle.kind]?.[difficulty - 2] ?? puzzle.instruction;
}

export function PuzzleOverlay({ puzzle, roomId, hintSpeed, difficulty, onClose, onSolve, onHint, speak }: Props) {
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [solved, setSolved] = useState(false);
  const startTime = useRef(Date.now());
  const solvingLock = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const instruction = instructionFor(puzzle, difficulty);

  const revealHint = (requested?: number) => {
    const next = Math.min(2, Math.max(hintLevel + 1, requested ?? 0)) as 1 | 2;
    if (next > hintLevel) {
      setHintLevel(next);
      onHint(next);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const next = HINT_TIMES[hintSpeed].findIndex((time) => elapsed < time);
      const target = (next === -1 ? 2 : next) as 0 | 1 | 2;
      if (target > hintLevel) revealHint(target);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hintLevel, hintSpeed]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !solvingLock.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const wrong = (message = '괜찮아! 한 번 더 살펴보자.') => {
    if (solvingLock.current) return;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 1800);
    if (nextAttempts >= 4) revealHint(2);
    else if (nextAttempts >= 2) revealHint(1);
  };

  const correct = () => {
    if (solvingLock.current) return;
    solvingLock.current = true;
    setSolved(true);
    setFeedback(puzzle.result);
    window.setTimeout(onSolve, 1500);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={panelRef}
        tabIndex={-1}
        className={`puzzle-panel puzzle-${puzzle.kind} ${solved ? 'is-solved' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="puzzle-title"
      >
        <i className="tape tape-left" aria-hidden="true" />
        <i className="tape tape-right" aria-hidden="true" />

        <header className="puzzle-header">
          <div className="puzzle-heading">
            <span className="puzzle-icon" aria-hidden="true">{puzzle.icon}</span>
            <div>
              <span className="eyebrow">{roomPuzzleLabel[roomId]} · 난이도 {difficulty}</span>
              <h2 id="puzzle-title">{puzzle.title}</h2>
            </div>
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="퍼즐 닫기">✕</button>
        </header>

        <div className="instruction-row">
          <p>{instruction}</p>
          <button className="speaker-button" onClick={() => speak(instruction)} aria-label="지시문 읽어주기">🔊</button>
        </div>

        <div className="puzzle-stage">
          <PuzzleBody kind={puzzle.kind} puzzle={puzzle} roomId={roomId} correct={correct} wrong={wrong} speak={speak} difficulty={difficulty} hintLevel={hintLevel} />
        </div>

        <footer className="puzzle-footer">
          <div className={`feedback-bubble ${feedback ? 'is-visible' : ''} ${solved ? 'is-correct' : ''}`} aria-live="polite">
            {feedback || (hintLevel ? puzzle.hints[hintLevel - 1] : '천천히 살펴봐도 괜찮아.')}
          </div>
          <button className="hint-button" disabled={hintLevel === 2} onClick={() => revealHint()}>
            <span aria-hidden="true">💡</span>
            {hintLevel === 2 ? '힌트 모두 봤어' : hintLevel ? '다음 힌트' : '힌트 1 보기'}
          </button>
        </footer>

        {solved && (
          <div className="solve-stamp" aria-hidden="true">
            <span className="stamp-mark">해결</span>
            <b className="stamp-reward">{puzzle.reward}</b>
          </div>
        )}
      </section>
    </div>
  );
}

type BodyProps = {
  kind: PuzzleDefinition['kind'];
  puzzle: PuzzleDefinition;
  roomId: RoomId;
  correct: () => void;
  wrong: (message?: string) => void;
  speak: Props['speak'];
  difficulty: Difficulty;
  hintLevel: 0 | 1 | 2;
};
type Body = Omit<BodyProps, 'kind'>;

function PuzzleBody({ kind, ...rest }: BodyProps) {
  switch (kind) {
    case 'antonyms': return <Antonyms {...rest} />;
    case 'wordMatch': return <WordMatch {...rest} />;
    case 'sumTen': return <SumTen {...rest} />;
    case 'pattern': return <Pattern {...rest} />;
    case 'symmetry': return <Symmetry {...rest} />;
    case 'keypad': return <Keypad {...rest} />;
    case 'sentence': return <Sentence {...rest} />;
    case 'berries': return <Berries {...rest} />;
    case 'sequence': return <Sequence {...rest} />;
    case 'directions': return <Directions {...rest} />;
    case 'shadow': return <Shadow {...rest} />;
    case 'route': return <Route {...rest} />;
  }
}

/* ----------------------------------------------------------------- 공용 부품 */

/** 다섯 칸씩 두 줄로 묶인 십틀(十frame). 한눈에 세는 연습의 기본 도구. */
function TenFrame({ count, capacity = 10, label }: { count: number; capacity?: number; label?: string }) {
  return (
    <div className="ten-frame" role="img" aria-label={label ?? `${count}개`}>
      {Array.from({ length: capacity }, (_, index) => <i key={index} className={index < count ? 'on' : ''} />)}
    </div>
  );
}

/* ------------------------------------------------------------- 1. 반대말 (한글) */

function Antonyms({ correct, wrong, speak, difficulty, roomId }: Body) {
  const wordSets: Record<RoomId, { pairs: { word: string; answer: string }[]; distractors: string[] }> = {
    charizard: { pairs: [{ word: '어두운', answer: '밝은' }, { word: '차가운', answer: '뜨거운' }, { word: '젖은', answer: '마른' }, { word: '낮은', answer: '높은' }], distractors: ['빠른', '좁은'] },
    snorlax: { pairs: [{ word: '시끄러운', answer: '조용한' }, { word: '가벼운', answer: '무거운' }, { word: '빠른', answer: '느린' }, { word: '작은', answer: '큰' }], distractors: ['밝은', '마른'] },
    gengar: { pairs: [{ word: '밝은', answer: '어두운' }, { word: '긴', answer: '짧은' }, { word: '넓은', answer: '좁은' }, { word: '웃는', answer: '우는' }], distractors: ['높은', '빠른'] },
    blastoise: { pairs: [{ word: '얕은', answer: '깊은' }, { word: '마른', answer: '젖은' }, { word: '흐린', answer: '맑은' }, { word: '빠른', answer: '느린' }], distractors: ['뜨거운', '작은'] },
  };
  const set = wordSets[roomId];
  const pairs = set.pairs.slice(0, difficulty + 1);
  const answersForRound = pairs.map((pair) => pair.answer);
  const chips = difficulty === 1
    ? [answersForRound[1], answersForRound[0], set.distractors[0]]
    : difficulty === 2
      ? [answersForRound[2], answersForRound[0], set.distractors[0], answersForRound[1], set.distractors[1]]
      : [answersForRound[3], answersForRound[1], set.distractors[0], answersForRound[0], answersForRound[2], set.distractors[1]];

  const [answers, setAnswers] = useState<(string | null)[]>(() => Array(pairs.length).fill(null));
  const [activeSlot, setActiveSlot] = useState(0);
  const [marks, setMarks] = useState<(boolean | null)[]>(() => Array(pairs.length).fill(null));

  const place = (word: string) => {
    const next = answers.map((answer, index) => (index === activeSlot ? word : answer));
    setAnswers(next);
    setMarks(Array(pairs.length).fill(null));
    speak(`${pairs[activeSlot].word}의 반대말, ${word}`);
    const empty = next.findIndex((answer) => answer === null);
    setActiveSlot(empty === -1 ? activeSlot : empty);
  };

  const clearSlot = (index: number) => {
    setActiveSlot(index);
    if (answers[index]) {
      setAnswers(answers.map((answer, i) => (i === index ? null : answer)));
      setMarks(Array(pairs.length).fill(null));
    }
  };

  const submit = () => {
    const result = pairs.map((pair, index) => answers[index] === pair.answer);
    setMarks(result);
    if (result.every(Boolean)) return correct();
    setActiveSlot(result.findIndex((ok) => !ok));
    wrong(`${result.filter(Boolean).length}줄은 맞았어. 나머지 줄을 다시 볼까?`);
  };

  const used = answers.filter(Boolean) as string[];

  return (
    <div className="antonym-board">
      <div className="antonym-lines">
        {pairs.map((pair, index) => (
          <button
            key={pair.word}
            className={`antonym-line ${activeSlot === index ? 'is-active' : ''} ${marks[index] === true ? 'is-right' : marks[index] === false ? 'is-off' : ''}`}
            onClick={() => clearSlot(index)}
            aria-label={`${pair.word}의 반대말 칸, ${answers[index] ?? '비어 있음'}`}
          >
            <span>{pair.word}</span>
            <em aria-hidden="true">↔</em>
            <strong>{answers[index] ?? ''}</strong>
          </button>
        ))}
      </div>
      <div className="choice-row word-chips">
        {chips.map((word) => (
          <button key={word} className={`word-chip ${used.includes(word) ? 'is-used' : ''}`} onClick={() => place(word)}>{word}</button>
        ))}
      </div>
      <button className="primary-button submit-button" disabled={answers.some((answer) => !answer)} onClick={submit}>기록 맞추기</button>
    </div>
  );
}

/* ------------------------------------------------------------ 2. 영어 단어 (영어) */

function WordMatch({ correct, wrong, speak, difficulty, hintLevel, roomId }: Body) {
  const itemSets: Record<RoomId, { icon: string; answer: string }[]> = {
    charizard: [{ icon: '🔥', answer: 'FIRE' }, { icon: '🪽', answer: 'WING' }, { icon: '🌬️', answer: 'WIND' }, { icon: '💡', answer: 'LIGHT' }, { icon: '☁️', answer: 'CLOUD' }],
    snorlax: [{ icon: '💭', answer: 'DREAM' }, { icon: '🌙', answer: 'MOON' }, { icon: '🔔', answer: 'BELL' }, { icon: '🍎', answer: 'BERRY' }, { icon: '⭐', answer: 'STAR' }],
    gengar: [{ icon: '👻', answer: 'GHOST' }, { icon: '🌙', answer: 'MOON' }, { icon: '⭐', answer: 'STAR' }, { icon: '🌃', answer: 'NIGHT' }, { icon: '🎭', answer: 'MASK' }],
    blastoise: [{ icon: '💧', answer: 'WATER' }, { icon: '🐚', answer: 'SHELL' }, { icon: '🌊', answer: 'WAVE' }, { icon: '🔵', answer: 'BLUE' }, { icon: '⛵', answer: 'BOAT' }],
  };
  const allItems = itemSets[roomId];
  const items = difficulty === 3 ? allItems.slice(0, 3) : allItems.slice(0, difficulty + 2);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  // 정답 뒤 잠깐 멈춰 완성된 단어를 보여주는 동안의 탭은 오답으로 세지 않는다.
  const settling = useRef(false);
  const item = items[step];
  const letters = useMemo(() => [...item.answer].sort((a, b) => a.localeCompare(b)), [item.answer]);

  const say = (text: string) => {
    speak(text, 'en-US', 0.7);
    window.setTimeout(() => speak(text, 'en-US', 0.95), 700);
  };

  const advance = () => {
    settling.current = false;
    setTyped('');
    if (step === items.length - 1) correct();
    else setStep(step + 1);
  };

  if (difficulty === 3) {
    const tapLetter = (letter: string) => {
      if (settling.current) return;
      const next = typed + letter;
      if (!item.answer.startsWith(next)) return wrong('그림의 이름을 소리 내어 읽고 첫 글자부터 찾아봐.');
      speak(letter, 'en-US', 0.8);
      setTyped(next);
      if (next === item.answer) {
        say(item.answer);
        settling.current = true;
        window.setTimeout(advance, 800);
      }
    };
    return (
      <div className="word-match spelling">
        <div className="progress-pips" aria-label={`진행 ${step + 1} / ${items.length}`}>{items.map((_, index) => <i key={index} className={index < step ? 'done' : index === step ? 'current' : ''} />)}</div>
        <div className="spell-row">
          <div className="picture-orb" aria-label={`${step + 1}번째 그림`}>{item.icon}</div>
          <div className="spell-slots" aria-label={`입력한 글자 ${typed || '없음'}`}>
            {[...item.answer].map((letter, index) => (
              <span key={index} className={index < typed.length ? 'filled' : ''}>
                {index < typed.length ? typed[index] : hintLevel === 2 ? letter : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="choice-row letter-tiles">
          {letters.map((letter, index) => <button key={`${letter}-${index}`} onClick={() => tapLetter(letter)}>{letter}</button>)}
        </div>
      </div>
    );
  }

  const choices = allItems.map((entry) => entry.answer).filter((word) => items.some((entry) => entry.answer === word));
  const choose = (word: string) => {
    if (settling.current) return;
    say(word);
    if (word !== item.answer) return wrong('그림의 이름을 들어 보고 다시 골라 보자.');
    settling.current = true;
    window.setTimeout(advance, 420);
  };
  return (
    <div className="word-match">
      <div className="progress-pips" aria-label={`진행 ${step + 1} / ${items.length}`}>{items.map((_, index) => <i key={index} className={index < step ? 'done' : index === step ? 'current' : ''} />)}</div>
      <div className="picture-orb" aria-label={`${step + 1}번째 그림`}>
        {item.icon}
        {difficulty === 1 && <b className="first-letter">{item.answer[0]}<small>로 시작해</small></b>}
      </div>
      <div className="choice-row english-choices">{choices.map((word) => <button key={word} onClick={() => choose(word)}>{word}<small>🔊</small></button>)}</div>
    </div>
  );
}

/* -------------------------------------------------------------- 3. 수 모으기 (수학) */

function SumTen({ correct, wrong, difficulty, roomId }: Body) {
  const target = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20;
  const needed = difficulty === 1 ? 2 : 3;
  const charizardBatteries = difficulty === 3 ? [3, 5, 4, 9, 6, 8] : [2, 6, 3, 8, 4, 7];
  const blastoiseBatteries: Record<Difficulty, number[]> = { 1: [1, 4, 6, 9, 3, 7], 2: [1, 5, 4, 9, 6, 8], 3: [2, 5, 7, 8, 9, 11] };
  const batteries = roomId === 'blastoise' ? blastoiseBatteries[difficulty] : charizardBatteries;
  const pieceName = roomId === 'blastoise' ? '물 에너지' : '불꽃 에너지';
  const [selected, setSelected] = useState<number[]>([]);
  const total = selected.reduce((sum, number) => sum + number, 0);
  const frames = Math.ceil(target / 10);

  const toggle = (number: number) =>
    setSelected(selected.includes(number)
      ? selected.filter((value) => value !== number)
      : selected.length < needed ? [...selected, number] : [number]);

  const status = total === 0
    ? `칸 ${target}개를 채워야 해.`
    : total < target ? `${target - total}칸이 비었어.`
      : total > target ? `${total - target}만큼 넘쳤어.`
        : '딱 맞았어! 발전기를 켜 보자.';

  return (
    <div className="sum-board">
      <div className={`energy-frames ${total === target ? 'ready' : ''} ${total > target ? 'over' : ''}`}>
        {Array.from({ length: frames }, (_, index) => (
          <TenFrame key={index} count={Math.min(10, Math.max(0, total - index * 10))} label={`에너지 칸 ${index + 1}번째 묶음`} />
        ))}
      </div>
      <p className="sum-readout" aria-live="polite">
        <span>{selected.length ? selected.join(' + ') : Array(needed).fill('?').join(' + ')} = <b>{total || '?'}</b></span>
        <em>{status}</em>
      </p>
      <div className="battery-grid">
        {batteries.map((number) => (
          <button key={number} aria-label={`${pieceName} ${number}`} className={selected.includes(number) ? 'selected' : ''} onClick={() => toggle(number)}>
            <i aria-hidden="true" />{number}
          </button>
        ))}
      </div>
      <button className="primary-button submit-button" disabled={selected.length !== needed} onClick={() => (total === target ? correct() : wrong(`지금은 ${total}이야. ${target}이 되도록 다시 골라 보자.`))}>에너지 보내기</button>
    </div>
  );
}

/* ---------------------------------------------------------------- 4. 패턴 (규칙) */

type Cap = { shape: 'star' | 'circle' | 'triangle'; color: 'red' | 'blue' | 'yellow' };
const shapeLabel = { star: '별', circle: '동그라미', triangle: '세모' } as const;
const colorLabel = { red: '빨간', blue: '파란', yellow: '노란' } as const;
const capLabel = (cap: Cap) => `${colorLabel[cap.color]} ${shapeLabel[cap.shape]}`;

function Capsule({ cap }: { cap: Cap }) {
  return <span className={`capsule ${cap.color}`} aria-hidden="true"><i className={`shape ${cap.shape}`} /></span>;
}

function Pattern({ correct, wrong, difficulty, roomId }: Body) {
  const S = (shape: Cap['shape'], color: Cap['color']): Cap => ({ shape, color });
  const rounds: Record<Difficulty, { sequence: Cap[]; gap: number; options: Cap[] }> = {
    1: {
      sequence: [S('star', 'red'), S('star', 'red'), S('circle', 'blue'), S('circle', 'blue'), S('star', 'red'), S('star', 'red'), S('circle', 'blue')],
      gap: 6,
      options: [S('star', 'red'), S('circle', 'blue'), S('triangle', 'yellow')],
    },
    2: {
      sequence: [S('star', 'red'), S('circle', 'blue'), S('triangle', 'yellow'), S('star', 'red'), S('circle', 'blue'), S('triangle', 'yellow'), S('star', 'red')],
      gap: 4,
      options: [S('star', 'red'), S('circle', 'blue'), S('triangle', 'yellow')],
    },
    3: {
      // 모양은 별·동그라미·세모 3개 주기, 색은 빨강·파랑 2개 주기로 따로 돈다.
      sequence: [S('star', 'red'), S('circle', 'blue'), S('triangle', 'red'), S('star', 'blue'), S('circle', 'red'), S('triangle', 'blue'), S('star', 'red')],
      gap: 4,
      options: [S('circle', 'red'), S('circle', 'blue'), S('star', 'red'), S('triangle', 'red')],
    },
  };
  const ghostRounds: Record<Difficulty, { sequence: Cap[]; gap: number; options: Cap[] }> = {
    1: { sequence: [S('triangle', 'yellow'), S('triangle', 'yellow'), S('star', 'blue'), S('star', 'blue'), S('triangle', 'yellow'), S('triangle', 'yellow'), S('star', 'blue')], gap: 6, options: [S('circle', 'red'), S('star', 'blue'), S('triangle', 'yellow')] },
    2: { sequence: [S('circle', 'blue'), S('star', 'red'), S('triangle', 'yellow'), S('circle', 'blue'), S('star', 'red'), S('triangle', 'yellow'), S('circle', 'blue')], gap: 4, options: [S('star', 'blue'), S('star', 'red'), S('triangle', 'yellow')] },
    3: { sequence: [S('triangle', 'yellow'), S('star', 'blue'), S('circle', 'yellow'), S('triangle', 'blue'), S('star', 'yellow'), S('circle', 'blue'), S('triangle', 'yellow')], gap: 4, options: [S('star', 'yellow'), S('circle', 'yellow'), S('star', 'blue'), S('triangle', 'blue')] },
  };
  const round = roomId === 'gengar' ? ghostRounds[difficulty] : rounds[difficulty];
  const answer = round.sequence[round.gap];

  return (
    <div className="pattern-board">
      <div className="capsule-sequence">
        {round.sequence.map((cap, index) => (index === round.gap
          ? <span key={index} className="capsule missing" aria-label="빈 캡슐">?</span>
          : <Capsule key={index} cap={cap} />))}
      </div>
      <div className="pattern-options">
        {round.options.map((option) => (
          <button
            key={capLabel(option)}
            aria-label={capLabel(option)}
            onClick={() => (option.shape === answer.shape && option.color === answer.color ? correct() : wrong('모양의 규칙과 색의 규칙을 따로 확인해 봐.'))}
          >
            <Capsule cap={option} /><b>{capLabel(option)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 5. 대칭 (공간) */

const SYMMETRY_ROUNDS: Record<Difficulty, { columns: number; rows: number; axis: 'vertical' | 'horizontal'; given: string[] }> = {
  1: { columns: 6, rows: 5, axis: 'vertical', given: ['.#.', '##.', '###', '##.', '.#.'] },
  2: { columns: 8, rows: 5, axis: 'vertical', given: ['..##', '.##.', '####', '.##.', '..##'] },
  3: { columns: 6, rows: 6, axis: 'horizontal', given: ['.####.', '##..##', '#.##.#'] },
};

function Symmetry({ correct, wrong, difficulty, hintLevel }: Body) {
  const round = SYMMETRY_ROUNDS[difficulty];
  const { columns, rows, axis } = round;

  const given = useMemo(() => {
    const cells = new Set<string>();
    round.given.forEach((line, row) => [...line].forEach((mark, column) => { if (mark === '#') cells.add(`${row},${column}`); }));
    return cells;
  }, [round]);

  const expected = useMemo(() => {
    const cells = new Set<string>();
    given.forEach((key) => {
      const [row, column] = key.split(',').map(Number);
      cells.add(axis === 'vertical' ? `${row},${columns - 1 - column}` : `${rows - 1 - row},${column}`);
    });
    return cells;
  }, [given, axis, columns, rows]);

  const isGivenSide = (row: number, column: number) => (axis === 'vertical' ? column < columns / 2 : row < rows / 2);

  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [showDiff, setShowDiff] = useState(false);

  const toggle = (row: number, column: number) => {
    const key = `${row},${column}`;
    setShowDiff(false);
    setFilled((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const differences = useMemo(() => {
    const keys = new Set([...expected, ...filled]);
    return [...keys].filter((key) => expected.has(key) !== filled.has(key));
  }, [expected, filled]);

  const submit = () => {
    if (differences.length === 0) return correct();
    if (hintLevel === 2) setShowDiff(true);
    wrong(`${differences.length}칸이 달라. 거울선에서 몇 칸 떨어졌는지 세어 봐.`);
  };

  return (
    <div className={`symmetry-board axis-${axis}`}>
      <div className="mirror-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: rows * columns }, (_, index) => {
          const row = Math.floor(index / columns);
          const column = index % columns;
          const key = `${row},${column}`;
          const locked = isGivenSide(row, column);
          const on = locked ? given.has(key) : filled.has(key);
          if (locked) return <span key={key} className={`mirror-cell locked ${on ? 'on' : ''}`} aria-hidden="true" />;
          return (
            <button
              key={key}
              className={`mirror-cell ${on ? 'on' : ''} ${showDiff && differences.includes(key) ? 'off' : ''}`}
              data-mirror-cell={key}
              aria-label={`${row + 1}번째 줄 ${column + 1}번째 칸`}
              aria-pressed={on}
              onClick={() => toggle(row, column)}
            />
          );
        })}
        <i className="mirror-axis" aria-hidden="true" />
      </div>
      <div className="symmetry-actions">
        <span className="mirror-note">거울선 <b>{axis === 'vertical' ? '세로' : '가로'}</b> · 켠 칸 {filled.size}개</span>
        <div className="symmetry-buttons">
          <button className="secondary-button" onClick={() => { setFilled(new Set()); setShowDiff(false); }}>↻ 지우기</button>
          <button className="primary-button" disabled={filled.size === 0} onClick={submit}>빛 쏘기</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 6. 키패드 (규칙) */

function Keypad({ correct, wrong, difficulty, roomId }: Body) {
  const lighthouseRounds: Record<Difficulty, { code: string; clues: { mark: string; text: string }[]; note?: string }> = {
    1: {
      code: '3142',
      clues: [{ mark: '☀️', text: '그림 ③' }, { mark: '🌙', text: '그림 ①' }, { mark: '💡', text: '선반 ④' }, { mark: '🧩', text: '블록 ②' }],
    },
    2: {
      code: '5364',
      clues: [{ mark: '☀️', text: '2 + 3' }, { mark: '🌙', text: '6 − 3' }, { mark: '💡', text: '2 + 4' }, { mark: '🧩', text: '8의 반' }],
    },
    3: {
      code: '4625',
      note: '작은 장치부터 누르기: 🧩 → 💡 → 🌙 → ☀️',
      clues: [{ mark: '☀️', text: '2 + 3' }, { mark: '🌙', text: '4 − 2' }, { mark: '💡', text: '3 + 3' }, { mark: '🧩', text: '8의 반' }],
    },
  };
  const theaterRounds: Record<Difficulty, { code: string; clues: { mark: string; text: string }[]; note?: string }> = {
    1: { code: '2413', clues: [{ mark: '🎟️', text: '좌석 ②' }, { mark: '🌙', text: '전구 ④' }, { mark: '👻', text: '소품 ①' }, { mark: '🎭', text: '커튼 ③' }] },
    2: { code: '7352', clues: [{ mark: '🎟️', text: '3 + 4' }, { mark: '🌙', text: '8 − 5' }, { mark: '👻', text: '2 + 3' }, { mark: '🎭', text: '4의 반' }] },
    3: { code: '5284', note: '무대 가까운 순서: 🎭 → 👻 → 🌙 → 🎟️', clues: [{ mark: '🎟️', text: '2 + 2' }, { mark: '🌙', text: '1 + 7' }, { mark: '👻', text: '6 − 4' }, { mark: '🎭', text: '10의 반' }] },
  };
  const round = roomId === 'gengar' ? theaterRounds[difficulty] : lighthouseRounds[difficulty];
  const [code, setCode] = useState('');
  const submit = () => (code === round.code ? correct() : (wrong('카드의 계산과 순서를 다시 확인해 보자.'), setCode('')));

  return (
    <div className="keypad-board">
      <div className="clue-cards">
        {round.note && <p className="clue-order">{round.note}</p>}
        <div className="clue-card-row">
          {round.clues.map((clue) => <span key={clue.mark} className="clue-card"><b>{clue.mark}</b>{clue.text}</span>)}
        </div>
      </div>
      <div className="code-display" aria-label={`입력한 암호 ${code || '없음'}`}>{[0, 1, 2, 3].map((index) => <span key={index} className={code[index] ? 'filled' : ''}>{code[index] ?? ''}</span>)}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '확인'].map((digit) => (
          <button
            key={digit}
            className={digit === '확인' ? 'confirm' : digit === '지움' ? 'clear' : ''}
            onClick={() => (digit === '지움' ? setCode(code.slice(0, -1)) : digit === '확인' ? submit() : setCode(code.length < 4 ? code + digit : code))}
          >{digit}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 7. 문장 (한글) */

const SENTENCE_TREES = [
  { color: 'red', label: '빨간', berries: 2 },
  { color: 'blue', label: '파란', berries: 6 },
  { color: 'yellow', label: '노란', berries: 4 },
] as const;

function Sentence({ correct, wrong, difficulty, roomId }: Body) {
  const [answers, setAnswers] = useState<string[]>([]);
  const forestRounds: Record<Difficulty, { choices: string[]; expected: string[] }> = {
    1: { choices: ['노란', '빨간', '파란'], expected: ['빨간'] },
    2: { choices: ['많은', '빨간', '적은', '파란'], expected: ['빨간', '적은'] },
    3: { choices: ['가장', '빨간', '적은', '열매가'], expected: ['빨간', '열매가', '가장', '적은'] },
  };
  const theaterRounds: Record<Difficulty, { choices: string[]; expected: string[] }> = {
    1: { choices: ['왼쪽', '가운데', '오른쪽'], expected: ['가운데'] },
    2: { choices: ['파란', '보라', '노란', '초록'], expected: ['보라', '파란'] },
    3: { choices: ['친구들을', '팬텀은', '했어요', '웃게'], expected: ['팬텀은', '친구들을', '웃게', '했어요'] },
  };
  const { choices, expected } = (roomId === 'gengar' ? theaterRounds : forestRounds)[difficulty];
  const choose = (word: string) =>
    setAnswers(answers.includes(word) ? answers.filter((answer) => answer !== word) : answers.length < expected.length ? [...answers, word] : [word]);
  const isCorrect = answers.length === expected.length && answers.every((answer, index) => answer === expected[index]);

  if (roomId === 'gengar') return (
    <div className="sentence-board ghost-sentence-board">
      <div className="ghost-stage" role="img" aria-label="세 개의 극장 문 중 가운데 문과 보라색, 파란색 조명이 차례로 빛난다.">
        {['왼쪽', '가운데', '오른쪽'].map((door) => <div key={door} className={door === '가운데' ? 'is-target' : ''}><span>🎭</span><b>{door} 문</b></div>)}
      </div>
      <p className="sentence-line">
        {difficulty === 1
          ? <>웃음소리는 <strong>{answers[0] || '＿＿'}</strong> 문 뒤에서 들려요.</>
          : difficulty === 2
            ? <><strong>{answers[0] || '＿＿'}</strong> 조명 다음에 <strong>{answers[1] || '＿＿'}</strong> 조명이 켜져요.</>
            : <><strong>{answers.length ? answers.join(' ') : '＿＿ ＿＿ ＿＿ ＿＿'}</strong>.</>}
      </p>
      <div className="choice-row word-chips">{choices.map((word) => <button className={`word-chip ${answers.includes(word) ? 'is-used' : ''}`} key={word} onClick={() => choose(word)}>{word}</button>)}</div>
      <button className="primary-button submit-button" disabled={answers.length !== expected.length} onClick={() => (isCorrect ? correct() : wrong('빛나는 문과 말의 순서를 다시 살펴봐.'))}>초대장 완성하기</button>
    </div>
  );

  return (
    <div className="sentence-board">
      <div className="trail-scene" role="img" aria-label="발자국이 빨간 열매 나무로 이어져 있다. 빨간 나무에 열매 2개, 파란 나무에 6개, 노란 나무에 4개가 달려 있다.">
        {SENTENCE_TREES.map((tree) => (
          <div key={tree.color} className={`trail-tree ${tree.color} ${tree.color === 'red' ? 'is-target' : ''}`}>
            <i className="crown" aria-hidden="true">{Array.from({ length: tree.berries }, (_, index) => <b key={index} />)}</i>
            <em>{tree.label} 나무</em>
          </div>
        ))}
        <div className="trail-steps" aria-hidden="true"><span>🐾</span><span>🐾</span><span>🐾</span></div>
      </div>
      <p className="sentence-line">
        {difficulty === 1
          ? <>잠만보에게 줄 향기는 <strong>{answers[0] || '＿＿'}</strong> 열매 나무에 있어요.</>
          : difficulty === 2
            ? <>향기는 <strong>{answers[0] || '＿＿'}</strong> 열매가 <strong>{answers[1] || '＿＿'}</strong> 나무에서 나요.</>
            : <>향기는 <strong>{answers.length ? answers.join(' ') : '＿＿ ＿＿ ＿＿ ＿＿'}</strong> 나무에서 나요.</>}
      </p>
      <div className="choice-row word-chips">{choices.map((word) => <button className={`word-chip ${answers.includes(word) ? 'is-used' : ''}`} key={word} onClick={() => choose(word)}>{word}</button>)}</div>
      <button className="primary-button submit-button" disabled={answers.length !== expected.length} onClick={() => (isCorrect ? correct() : wrong('발자국이 닿은 나무를 보고 말의 순서를 다시 살펴봐.'))}>쪽지 완성하기</button>
    </div>
  );
}

/* ----------------------------------------------------------- 8. 열매 세기 (수학) */

function Berries({ correct, wrong, difficulty, roomId }: Body) {
  const berryRounds: Record<Difficulty, { counts: [number, number, number]; question: string; answer: number; options: number[] }> = {
    1: { counts: [4, 6, 9], question: '열매가 6개인 나무는 어느 것일까?', answer: 6, options: [4, 6, 9] },
    2: { counts: [4, 7, 5], question: '왼쪽 나무와 오른쪽 나무의 열매를 더하면?', answer: 9, options: [8, 9, 10, 11] },
    3: { counts: [9, 4, 6], question: '가장 많은 나무와 가장 적은 나무의 차이는?', answer: 5, options: [3, 4, 5, 6] },
  };
  const waterRounds: Record<Difficulty, { counts: [number, number, number]; question: string; answer: number; options: number[] }> = {
    1: { counts: [3, 6, 8], question: '물방울이 6칸인 압력계는 어느 것일까?', answer: 6, options: [3, 6, 8] },
    2: { counts: [5, 6, 8], question: '왼쪽과 오른쪽 압력계의 물방울을 더하면?', answer: 13, options: [11, 12, 13, 14] },
    3: { counts: [10, 3, 7], question: '가장 높은 압력과 가장 낮은 압력의 차이는?', answer: 7, options: [5, 6, 7, 8] },
  };
  const isWater = roomId === 'blastoise';
  const round = (isWater ? waterRounds : berryRounds)[difficulty];
  const names = ['왼쪽', '가운데', '오른쪽'];
  const containerName = isWater ? '압력계' : '나무';
  const unitName = isWater ? '물방울' : '열매';

  return (
    <div className={`berry-board ${isWater ? 'water-gauges' : ''}`}>
      <div className="berry-trees">
        {round.counts.map((count, index) => (
          <div key={names[index]} className="berry-tree-card">
            <span className="tree-crown" aria-hidden="true">{isWater ? '💧' : '🌳'}</span>
            <TenFrame count={count} label={`${names[index]} ${containerName} ${unitName} ${count}개`} />
            <b>{names[index]} {containerName}</b>
          </div>
        ))}
      </div>
      <p className="berry-question">{round.question}</p>
      <div className="choice-row number-options">
        {round.options.map((option) => (
          <button
            key={option}
            aria-label={difficulty === 1 ? `${names[round.counts.indexOf(option)]} ${containerName}, ${unitName} ${option}개` : `${option}`}
            onClick={() => (option === round.answer ? correct() : wrong('십틀의 가득 찬 줄은 5개야. 남은 칸만 더 세어 봐.'))}
          >{difficulty === 1 ? `${names[round.counts.indexOf(option)]} ${containerName}` : option}</button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- 9. 뛰어 세기 (수학) */

function Sequence({ correct, wrong, difficulty, roomId }: Body) {
  const dreamRounds: Record<Difficulty, { values: number[]; rule: string; ruleChoices: string[]; answer: number; numberChoices: number[] }> = {
    1: { values: [2, 4, 6], rule: '2씩 커져요', ruleChoices: ['1씩 커져요', '2씩 커져요', '3씩 커져요'], answer: 8, numberChoices: [7, 8, 10] },
    2: { values: [3, 6, 9], rule: '3씩 커져요', ruleChoices: ['2씩 커져요', '3씩 커져요', '4씩 커져요'], answer: 12, numberChoices: [10, 12, 15] },
    3: { values: [20, 17, 14], rule: '3씩 작아져요', ruleChoices: ['2씩 작아져요', '3씩 작아져요', '3씩 커져요'], answer: 11, numberChoices: [11, 12, 17] },
  };
  const valveRounds: Record<Difficulty, { values: number[]; rule: string; ruleChoices: string[]; answer: number; numberChoices: number[] }> = {
    1: { values: [5, 10, 15], rule: '5씩 커져요', ruleChoices: ['2씩 커져요', '5씩 커져요', '10씩 커져요'], answer: 20, numberChoices: [18, 20, 25] },
    2: { values: [4, 8, 12], rule: '4씩 커져요', ruleChoices: ['3씩 커져요', '4씩 커져요', '5씩 커져요'], answer: 16, numberChoices: [14, 16, 20] },
    3: { values: [30, 25, 20], rule: '5씩 작아져요', ruleChoices: ['4씩 작아져요', '5씩 작아져요', '5씩 커져요'], answer: 15, numberChoices: [10, 15, 25] },
  };
  const round = (roomId === 'blastoise' ? valveRounds : dreamRounds)[difficulty];
  const [stage, setStage] = useState<'rule' | 'number'>('rule');
  const step = round.values[1] - round.values[0];
  const hop = step > 0 ? `+${step}` : `${step}`;

  return (
    <div className="sequence-board">
      <div className="stepping-stones">
        {round.values.map((number) => (
          <span key={number} className="stone">{number}<i className="hop" aria-hidden="true">{stage === 'number' ? hop : ''}</i></span>
        ))}
        <span className="stone empty">?</span>
      </div>
      {stage === 'rule' ? (
        <>
          <p className="stage-question">먼저, 수가 어떻게 달라지고 있을까?</p>
          <div className="choice-row rule-options">
            {round.ruleChoices.map((choice) => (
              <button key={choice} onClick={() => (choice === round.rule ? setStage('number') : wrong('앞 돌과 다음 돌의 차이를 손가락으로 세어 봐.'))}>{choice}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="stage-question"><b>{round.rule}</b> 그러면 다음 디딤돌은?</p>
          <div className="choice-row number-options">
            {round.numberChoices.map((number) => (
              <button key={number} onClick={() => (number === round.answer ? correct() : wrong(`${round.values[2]}에서 ${hop} 하면 얼마가 될까?`))}>{number}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- 10. 영어 방향 (영어) */

const ARROW_LABEL: Record<string, string> = { '←': '왼쪽', '↑': '위쪽', '→': '오른쪽', '↓': '아래쪽' };

function Directions({ correct, wrong, speak, difficulty, roomId }: Body) {
  const dreamRounds: Record<Difficulty, { words: string[]; arrows: string[] }[]> = {
    1: [{ words: ['LEFT'], arrows: ['←'] }, { words: ['RIGHT'], arrows: ['→'] }, { words: ['UP'], arrows: ['↑'] }],
    2: [{ words: ['DOWN'], arrows: ['↓'] }, { words: ['LEFT'], arrows: ['←'] }, { words: ['UP'], arrows: ['↑'] }, { words: ['RIGHT'], arrows: ['→'] }],
    3: [{ words: ['UP', 'LEFT'], arrows: ['↑', '←'] }, { words: ['DOWN', 'RIGHT'], arrows: ['↓', '→'] }, { words: ['LEFT', 'UP'], arrows: ['←', '↑'] }],
  };
  const theaterRounds: Record<Difficulty, { words: string[]; arrows: string[] }[]> = {
    1: [{ words: ['RIGHT'], arrows: ['→'] }, { words: ['UP'], arrows: ['↑'] }, { words: ['LEFT'], arrows: ['←'] }],
    2: [{ words: ['LEFT'], arrows: ['←'] }, { words: ['DOWN'], arrows: ['↓'] }, { words: ['RIGHT'], arrows: ['→'] }, { words: ['UP'], arrows: ['↑'] }],
    3: [{ words: ['RIGHT', 'DOWN'], arrows: ['→', '↓'] }, { words: ['LEFT', 'UP'], arrows: ['←', '↑'] }, { words: ['UP', 'RIGHT'], arrows: ['↑', '→'] }],
  };
  const groups = (roomId === 'gengar' ? theaterRounds : dreamRounds)[difficulty];
  const [group, setGroup] = useState(0);
  const [within, setWithin] = useState(0);
  const current = groups[group];

  const say = (text: string) => {
    speak(text, 'en-US', 0.72);
    window.setTimeout(() => speak(text, 'en-US', 0.96), 700);
  };

  const choose = (arrow: string) => {
    if (arrow !== current.arrows[within]) return wrong('단어를 한 번 더 듣고 방향을 생각해 보자.');
    if (within < current.arrows.length - 1) return setWithin(within + 1);
    if (group === groups.length - 1) return correct();
    setGroup(group + 1);
    setWithin(0);
  };

  return (
    <div className="direction-board">
      <button className="english-word" onClick={() => say(current.words.join(', '))}>
        <span className="word-line">
          {current.words.map((word, index) => (
            <b key={word + index} className={index === within ? 'now' : index < within ? 'past' : ''}>{word}</b>
          ))}
        </span>
        <small>눌러서 듣기 🔊</small>
      </button>
      <div className="direction-pad">
        <button className="pad up" onClick={() => choose('↑')} aria-label={ARROW_LABEL['↑']}>↑</button>
        <button className="pad left" onClick={() => choose('←')} aria-label={ARROW_LABEL['←']}>←</button>
        <span className="pad-center" aria-hidden="true">🐾</span>
        <button className="pad right" onClick={() => choose('→')} aria-label={ARROW_LABEL['→']}>→</button>
        <button className="pad down" onClick={() => choose('↓')} aria-label={ARROW_LABEL['↓']}>↓</button>
      </div>
      <div className="progress-pips">{groups.map((_, index) => <i key={index} className={index < group ? 'done' : index === group ? 'current' : ''} />)}</div>
    </div>
  );
}

/* ----------------------------------------------------------- 11. 그림자 (공간) */

type CreatureSpec = { ears: 'pointed' | 'round' | 'long'; tail: 'bushy' | 'thin' | 'curl'; flip?: boolean };

function Creature({ spec, className }: { spec: CreatureSpec; className?: string }) {
  return (
    <svg className={`creature ${className ?? ''}`} viewBox="0 0 124 104" aria-hidden="true">
      <g fill="currentColor" transform={spec.flip ? 'translate(124,0) scale(-1,1)' : undefined}>
        {spec.tail === 'bushy' && <path d="M44 72 C10 70 6 32 30 24 C14 42 20 60 46 60 Z" />}
        {spec.tail === 'thin' && <path d="M44 72 C16 66 12 34 26 22 L31 27 C20 38 24 58 46 62 Z" />}
        {spec.tail === 'curl' && <path d="M44 70 C12 70 8 42 26 40 C38 39 39 52 28 52 C22 52 22 45 27 46 C19 45 16 62 46 62 Z" />}
        <ellipse cx="62" cy="68" rx="30" ry="23" />
        <rect x="48" y="82" width="12" height="18" rx="6" />
        <rect x="72" y="82" width="12" height="18" rx="6" />
        <circle cx="89" cy="44" r="21" />
        {spec.ears === 'pointed' && <><path d="M74 32 L67 5 L91 23 Z" /><path d="M100 29 L113 7 L115 33 Z" /></>}
        {spec.ears === 'round' && <><circle cx="75" cy="25" r="11" /><circle cx="104" cy="23" r="11" /></>}
        {spec.ears === 'long' && <><path d="M78 31 L70 4 Q80 2 84 27 Z" /><path d="M99 29 L109 4 Q118 8 107 33 Z" /></>}
        <path d="M105 47 L121 51 L105 57 Z" />
      </g>
    </svg>
  );
}

function Shadow({ correct, wrong, difficulty, roomId }: Body) {
  const dreamRounds: Record<Difficulty, { target: CreatureSpec; options: CreatureSpec[] }> = {
    1: {
      target: { ears: 'pointed', tail: 'bushy' },
      options: [{ ears: 'round', tail: 'thin' }, { ears: 'pointed', tail: 'bushy' }, { ears: 'long', tail: 'curl' }],
    },
    2: {
      target: { ears: 'pointed', tail: 'bushy' },
      options: [{ ears: 'pointed', tail: 'thin' }, { ears: 'round', tail: 'bushy' }, { ears: 'pointed', tail: 'bushy' }],
    },
    3: {
      target: { ears: 'long', tail: 'curl', flip: true },
      options: [{ ears: 'long', tail: 'bushy' }, { ears: 'long', tail: 'curl' }, { ears: 'pointed', tail: 'curl' }],
    },
  };
  const theaterRounds: Record<Difficulty, { target: CreatureSpec; options: CreatureSpec[] }> = {
    1: { target: { ears: 'pointed', tail: 'curl' }, options: [{ ears: 'round', tail: 'thin' }, { ears: 'long', tail: 'curl' }, { ears: 'pointed', tail: 'curl' }] },
    2: { target: { ears: 'pointed', tail: 'thin' }, options: [{ ears: 'pointed', tail: 'bushy' }, { ears: 'round', tail: 'thin' }, { ears: 'pointed', tail: 'thin' }] },
    3: { target: { ears: 'pointed', tail: 'curl', flip: true }, options: [{ ears: 'pointed', tail: 'bushy' }, { ears: 'pointed', tail: 'curl' }, { ears: 'long', tail: 'curl' }] },
  };
  const round = (roomId === 'gengar' ? theaterRounds : dreamRounds)[difficulty];
  const matches = (option: CreatureSpec) => option.ears === round.target.ears && option.tail === round.target.tail;

  return (
    <div className="shadow-board">
      <div className="wall-shadow">
        <Creature spec={round.target} className="silhouette" />
        <b>{difficulty === 3 ? '뒤집혀 비친 그림자' : '벽에 비친 그림자'}</b>
      </div>
      <div className="shadow-options">
        {round.options.map((option, index) => (
          <button key={index} aria-label={`그림자 후보 ${index + 1}번`} onClick={() => (matches(option) ? correct() : wrong('귀 모양과 꼬리 모양을 하나씩 비교해 봐.'))}>
            <Creature spec={option} />
            <b>{index + 1}번</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 12. 지도 (지도) */

function Route({ correct, wrong, difficulty, roomId }: Body) {
  const isWater = roomId === 'blastoise';
  const start = isWater ? 0 : 15;
  const end = isWater ? 19 : 4;
  const shortestLength = 8;
  const blocked = isWater
    ? difficulty === 1 ? [3, 7, 12, 14] : difficulty === 2 ? [3, 5, 7, 9, 12, 14] : [2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15]
    : difficulty === 1 ? [5, 12, 13, 18] : difficulty === 2 ? [1, 5, 8, 12, 13, 18] : [1, 5, 8, 9, 12, 13, 14, 16, 17, 18, 19];
  const required = isWater ? [1, 11, 18] : [11, 7, 3];
  const icons: Record<number, string> = isWater ? { 0: '⚓', 1: '🐚', 11: '💧', 18: '🔧', 19: '🌊' } : { 15: '★', 11: '🍎', 7: '💧', 3: '🔦', 4: '🌙' };
  const requiredText = isWater ? '🐚 → 💧 → 🔧' : '🍎 → 💧 → 🔦';
  const endName = isWater ? '바다 🌊' : '달빛 무대 🌙';
  const [path, setPath] = useState<number[]>([]);
  const drawing = useRef(false);

  const addCell = (cell: number) => {
    setPath((current) => {
      if (blocked.includes(cell)) return current;
      if (current.length === 0) return cell === start ? [start] : current;
      if (current.includes(cell)) return current;
      const last = current[current.length - 1];
      const rowDistance = Math.abs(Math.floor(last / 5) - Math.floor(cell / 5));
      const columnDistance = Math.abs((last % 5) - (cell % 5));
      return rowDistance + columnDistance === 1 ? [...current, cell] : current;
    });
  };

  const cellFromPoint = (x: number, y: number) => {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-route-cell]');
    if (cell?.dataset.routeCell) addCell(Number(cell.dataset.routeCell));
  };

  const submit = () => {
    const hasAll = required.every((cell) => path.includes(cell));
    const inOrder = required.every((cell, index) => index === 0 || path.indexOf(required[index - 1]) < path.indexOf(cell));
    if (path[path.length - 1] !== end) return wrong(`길은 ${endName}에서 끝나야 해.`);
    if (!hasAll) return wrong(`${requiredText} 표식 세 개를 모두 지나야 해.`);
    if (difficulty > 1 && !inOrder) return wrong(`표식은 ${requiredText} 순서로 지나야 해.`);
    if (difficulty === 3 && path.length !== shortestLength) return wrong(`지금은 ${path.length}칸이야. ${shortestLength}칸으로도 갈 수 있어.`);
    correct();
  };

  return (
    <div className="route-board">
      <div
        className="route-grid"
        onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); cellFromPoint(event.clientX, event.clientY); }}
        onPointerMove={(event) => { if (drawing.current) cellFromPoint(event.clientX, event.clientY); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      >
        {Array.from({ length: 20 }, (_, cell) => (
          <button
            key={cell}
            data-route-cell={cell}
            className={`${blocked.includes(cell) ? 'blocked' : ''} ${path.includes(cell) ? 'in-path' : ''} ${cell === start ? 'start' : ''} ${cell === end ? 'end' : ''}`}
            onClick={() => addCell(cell)}
            aria-label={blocked.includes(cell) ? '막힌 바위' : icons[cell] ? `${icons[cell]} 표식` : '길'}
          >
            <span>{blocked.includes(cell) ? '◆' : icons[cell] ?? ''}</span>
            {path.includes(cell) && <i>{path.indexOf(cell) + 1}</i>}
          </button>
        ))}
      </div>
      <div className="route-legend">
        <span>{isWater ? '⚓ 출발' : '★ 출발'}</span><span>{requiredText} 지나기</span><span>{isWater ? '🌊 도착' : '🌙 도착'}</span>
        <b>그린 길 {path.length}칸{difficulty === 3 ? ` · 목표 ${shortestLength}칸` : ''}</b>
      </div>
      <div className="route-actions">
        <button className="secondary-button" onClick={() => setPath([])}>↻ 다시 그리기</button>
        <button className="primary-button" disabled={!path.length} onClick={submit}>이 길로 가기</button>
      </div>
    </div>
  );
}

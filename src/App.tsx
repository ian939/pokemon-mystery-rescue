import { useEffect, useMemo, useRef, useState } from 'react';
import { PuzzleOverlay } from './components/PuzzleOverlay';
import { roomById, rooms } from './content/rooms';
import { clearAllProgress, defaultProgress, loadProgress, readEvents, recordEvent, saveProgress } from './lib/storage';
import { domainLabel } from './types';
import type { Difficulty, HintSpeed, PlayerProgress, PuzzleDefinition, RoomDefinition, RoomId } from './types';

type Screen = 'landing' | 'map' | 'intro' | 'room' | 'reward' | 'gallery' | 'parent';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [progress, setProgress] = useState<PlayerProgress>(structuredClone(defaultProgress));
  const [ready, setReady] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<RoomId>('charizard');
  const [activePuzzle, setActivePuzzle] = useState<PuzzleDefinition | null>(null);
  const [toast, setToast] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const roomStartedAt = useRef(Date.now());
  const maxHintLevel = useRef<0 | 1 | 2>(0);
  const toastTimer = useRef<number>();

  useEffect(() => {
    loadProgress().then((saved) => {
      setProgress(saved);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void saveProgress(progress);
  }, [progress, ready]);

  const room = roomById[activeRoomId];
  const completed = progress.completedPuzzleIds[activeRoomId];

  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(''), 1900);
  };

  const speak = (text: string, lang: 'ko-KR' | 'en-US' = 'ko-KR', rate = 0.92) => {
    if (!progress.settings.narration || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.05;
    utterance.volume = progress.settings.sound ? 1 : 0;
    window.speechSynthesis.speak(utterance);
  };

  const openMap = () => {
    window.speechSynthesis?.cancel();
    setActivePuzzle(null);
    setScreen('map');
  };

  const chooseRoom = (roomId: RoomId) => {
    const roomIndex = rooms.findIndex((item) => item.id === roomId);
    const previousRoom = rooms[roomIndex - 1];
    const unlocked = roomIndex === 0 || Boolean(previousRoom && progress.unlockedIllustrations.includes(previousRoom.id));
    if (!unlocked) return showToast(`${previousRoom.pokemonName} 사건을 먼저 해결하면 열려!`);
    setActiveRoomId(roomId);
    setScreen('intro');
  };

  const beginRoom = () => {
    const isReplay = progress.completedRooms.some((record) => record.roomId === activeRoomId);
    if (isReplay) {
      setProgress((current) => ({
        ...current,
        completedPuzzleIds: { ...current.completedPuzzleIds, [activeRoomId]: [] },
      }));
    }
    roomStartedAt.current = Date.now();
    maxHintLevel.current = 0;
    recordEvent({ name: 'room_started', roomId: activeRoomId });
    setScreen('room');
  };

  const inspectPuzzle = (puzzle: PuzzleDefinition, index: number) => {
    recordEvent({ name: 'object_inspected', roomId: activeRoomId, puzzleId: puzzle.id });
    const currentIndex = room.puzzles.findIndex((item) => !completed.includes(item.id));
    if (completed.includes(puzzle.id)) return showToast(`여기서는 ‘${puzzle.reward}’을 찾았어!`);
    if (index !== currentIndex) return showToast('반짝이는 장치부터 살펴보자.');
    setActivePuzzle(puzzle);
    recordEvent({ name: 'puzzle_started', roomId: activeRoomId, puzzleId: puzzle.id });
  };

  const solvePuzzle = () => {
    if (!activePuzzle) return;
    const solvedPuzzle = activePuzzle;
    const isFinal = room.puzzles[room.puzzles.length - 1]?.id === solvedPuzzle.id;
    recordEvent({ name: 'puzzle_completed', roomId: activeRoomId, puzzleId: solvedPuzzle.id });

    setProgress((current) => {
      const puzzleIds = current.completedPuzzleIds[activeRoomId];
      const nextPuzzleIds = puzzleIds.includes(solvedPuzzle.id) ? puzzleIds : [...puzzleIds, solvedPuzzle.id];
      if (!isFinal) return {
        ...current,
        completedPuzzleIds: { ...current.completedPuzzleIds, [activeRoomId]: nextPuzzleIds },
      };

      const oldRecord = current.completedRooms.find((record) => record.roomId === activeRoomId);
      const completedRooms = current.completedRooms.filter((record) => record.roomId !== activeRoomId);
      completedRooms.push({
        roomId: activeRoomId,
        completedAt: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round((Date.now() - roomStartedAt.current) / 1000)),
        maxHintLevel: maxHintLevel.current,
        replayCount: (oldRecord?.replayCount ?? -1) + 1,
      });
      return {
        ...current,
        completedPuzzleIds: { ...current.completedPuzzleIds, [activeRoomId]: nextPuzzleIds },
        completedRooms,
        unlockedIllustrations: current.unlockedIllustrations.includes(activeRoomId)
          ? current.unlockedIllustrations
          : [...current.unlockedIllustrations, activeRoomId],
      };
    });

    setActivePuzzle(null);
    if (isFinal) {
      recordEvent({ name: 'room_completed', roomId: activeRoomId });
      window.setTimeout(() => setScreen('reward'), 180);
    } else {
      showToast(`${solvedPuzzle.reward}을 단서함에 넣었어!`);
    }
  };

  const updateSettings = (settings: Partial<PlayerProgress['settings']>) => {
    setProgress((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  };

  const changeDifficulty = (difficulty: Difficulty) => {
    updateSettings({ difficulty });
    showToast(`난이도 ${difficulty}단계로 바꿨어!`);
  };

  const resetProgress = async () => {
    await clearAllProgress();
    setProgress(structuredClone(defaultProgress));
    setActivePuzzle(null);
    setActiveRoomId('charizard');
    setResetOpen(false);
    setScreen('landing');
  };

  if (!ready) return <LoadingScreen />;

  return (
    <div className="app-shell" data-screen={screen}>
      {screen === 'landing' && (
        <LandingScreen
          nickname={progress.nickname}
          hasProgress={rooms.some((item) => progress.completedPuzzleIds[item.id].length > 0) || progress.completedRooms.length > 0}
          onStart={() => setScreen('map')}
          onGallery={() => setScreen('gallery')}
          onParent={() => setScreen('parent')}
          difficulty={progress.settings.difficulty}
          onDifficulty={changeDifficulty}
          onReset={() => setResetOpen(true)}
        />
      )}
      {screen === 'map' && (
        <MapScreen
          progress={progress}
          onChoose={chooseRoom}
          onHome={() => setScreen('landing')}
          onGallery={() => setScreen('gallery')}
          onParent={() => setScreen('parent')}
          onDifficulty={changeDifficulty}
          onReset={() => setResetOpen(true)}
        />
      )}
      {screen === 'intro' && <IntroScreen room={room} difficulty={progress.settings.difficulty} onBack={openMap} onStart={beginRoom} onSpeak={speak} />}
      {screen === 'room' && (
        <RoomScene
          room={room}
          completed={completed}
          sound={progress.settings.sound}
          difficulty={progress.settings.difficulty}
          onExit={() => { recordEvent({ name: 'room_exited', roomId: activeRoomId }); openMap(); }}
          onInspect={inspectPuzzle}
          onSpeak={() => speak(room.objective)}
          onToggleSound={() => updateSettings({ sound: !progress.settings.sound })}
          showToast={showToast}
        />
      )}
      {screen === 'reward' && <RewardScreen room={room} onGallery={() => setScreen('gallery')} onContinue={openMap} />}
      {screen === 'gallery' && <GalleryScreen progress={progress} onBack={() => setScreen(progress.completedRooms.length ? 'map' : 'landing')} onOpen={(roomId) => { setActiveRoomId(roomId); setScreen('reward'); }} />}
      {screen === 'parent' && (
        <ParentScreen
          progress={progress}
          onBack={() => setScreen(progress.completedRooms.length || rooms.some((item) => progress.completedPuzzleIds[item.id].length) ? 'map' : 'landing')}
          onNickname={(nickname) => setProgress((current) => ({ ...current, nickname }))}
          onSettings={updateSettings}
          onRequestReset={() => setResetOpen(true)}
        />
      )}

      {activePuzzle && (
        <PuzzleOverlay
          key={activePuzzle.id}
          puzzle={activePuzzle}
          roomId={activeRoomId}
          hintSpeed={progress.settings.hintSpeed}
          difficulty={progress.settings.difficulty}
          onClose={() => setActivePuzzle(null)}
          onSolve={solvePuzzle}
          onHint={(level) => {
            maxHintLevel.current = Math.max(maxHintLevel.current, level) as 0 | 1 | 2;
            recordEvent({ name: 'hint_shown', roomId: activeRoomId, puzzleId: activePuzzle.id, level });
          }}
          speak={speak}
        />
      )}

      {resetOpen && <ResetConfirm onCancel={() => setResetOpen(false)} onConfirm={resetProgress} />}

      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
      <div className="portrait-lock" role="status"><span>↻</span><strong>iPad를 가로로 돌려 주세요</strong><small>진행한 내용은 그대로 있어요.</small></div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="scanner-loader"><i /><i /><i /></div><p>탐험 장비를 챙기는 중…</p></div>;
}

type QuickSettingsProps = { difficulty: Difficulty; onDifficulty: (difficulty: Difficulty) => void; onReset: () => void; onParent: () => void };
function QuickSettings({ difficulty, onDifficulty, onReset, onParent }: QuickSettingsProps) {
  return <div className="quick-settings" aria-label="테스트 설정">
    <span>난이도</span>
    <div className="quick-levels">{([1, 2, 3] as Difficulty[]).map((level) => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => onDifficulty(level)} aria-label={`난이도 ${level}단계`}>{level}</button>)}</div>
    <button className="quick-reset" onClick={onReset}>↻ 초기화</button>
    <button className="quick-parent" onClick={onParent} aria-label="보호자 설정">⚙️</button>
  </div>;
}

type LandingProps = { nickname: string; hasProgress: boolean; onStart: () => void; onGallery: () => void } & QuickSettingsProps;
function LandingScreen({ nickname, hasProgress, onStart, onGallery, onParent, difficulty, onDifficulty, onReset }: LandingProps) {
  return (
    <main className="landing-screen child-surface">
      <div className="landing-stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <nav className="landing-nav"><QuickSettings difficulty={difficulty} onDifficulty={onDifficulty} onReset={onReset} onParent={onParent} /></nav>
      <section className="hero-card">
        <div className="hero-emblem" aria-hidden="true"><span>⚡</span><i /></div>
        <p className="hero-kicker">관찰하고 · 생각하고 · 구출하자!</p>
        <h1><span>포켓몬</span> 미스터리 구조대</h1>
        <p className="hero-copy">{nickname}, 이상한 신호가 도착했어.<br />첫 번째 사건을 조사하러 갈까?</p>
        <div className="hero-actions">
          <button className="primary-button big-button" onClick={onStart}>{hasProgress ? '탐험 계속하기' : '모험 시작하기'} <span>→</span></button>
          <button className="secondary-button big-button" onClick={onGallery}>🖼️ 탐험 도감</button>
        </div>
      </section>
      <p className="private-note">가족·지인 비공개 테스트용</p>
    </main>
  );
}

type MapProps = { progress: PlayerProgress; onChoose: (id: RoomId) => void; onHome: () => void; onGallery: () => void; onDifficulty: (difficulty: Difficulty) => void; onReset: () => void; onParent: () => void };
function MapScreen({ progress, onChoose, onHome, onGallery, onDifficulty, onReset, onParent }: MapProps) {
  return (
    <main className="map-screen child-surface">
      <header className="map-header">
        <button className="round-nav" onClick={onHome} aria-label="시작 화면">⌂</button>
        <div><span className="eyebrow">구조대 본부</span><h1>오늘의 사건 지도</h1></div>
        <div className="map-actions"><button onClick={onGallery}>🖼️ 도감 <b>{progress.unlockedIllustrations.length}/{rooms.length}</b></button><QuickSettings difficulty={progress.settings.difficulty} onDifficulty={onDifficulty} onReset={onReset} onParent={onParent} /></div>
      </header>
      <section className="case-map" aria-label="사건 선택">
        <div className="map-path" aria-hidden="true"><i /><i /><i /><i /></div>
        {rooms.map((room, index) => {
          const previousRoom = rooms[index - 1];
          const unlocked = index === 0 || progress.unlockedIllustrations.includes(previousRoom.id);
          const done = progress.unlockedIllustrations.includes(room.id);
          const progressCount = progress.completedPuzzleIds[room.id].length;
          return (
            <article key={room.id} className={`case-card ${room.scene} ${room.id} ${!unlocked ? 'locked' : ''} ${done ? 'done' : ''}`}>
              <div className="case-visual">
                <div className="scene-mini" aria-hidden="true">{room.scene === 'lab' ? <><span className="mini-capsule">{room.symbol}</span><i className="mini-console" /><i className="mini-light" /></> : <><span className="mini-tree">♠</span><i className="mini-fog" /><i className="mini-path" /><b className="mini-pokemon">{room.symbol}</b></>}</div>
                <span className="case-status">{done ? '✓ 해결 완료' : unlocked ? room.number : '🔒 잠김'}</span>
              </div>
              <div className="case-content">
                <span>{room.location}</span><h2>{room.shortTitle}</h2>
                <p>{!unlocked ? `${previousRoom.pokemonName} 사건을 해결하면 다음 신호가 보여.` : done ? room.rewardCaption : room.story.slice(0, 47) + '…'}</p>
                {unlocked && !done && <div className="case-progress"><span style={{ width: `${(progressCount / room.puzzles.length) * 100}%` }} /><small>{progressCount ? `${progressCount}/${room.puzzles.length} 단서 발견` : '새 사건'}</small></div>}
                <button className="case-button" onClick={() => onChoose(room.id)}>{!unlocked ? '아직 갈 수 없어' : done ? '다시 탐험하기' : progressCount ? '이어서 조사하기' : '사건 조사하기'} <span>→</span></button>
              </div>
            </article>
          );
        })}
      </section>
      <p className="map-tip"><span>💡</span> 점수도 시간 제한도 없어. 궁금한 곳을 천천히 살펴봐!</p>
    </main>
  );
}

function IntroScreen({ room, difficulty, onBack, onStart, onSpeak }: { room: RoomDefinition; difficulty: Difficulty; onBack: () => void; onStart: () => void; onSpeak: (text: string) => void }) {
  return (
    <main className={`intro-screen intro-${room.scene} intro-${room.id} child-surface`}>
      <button className="round-nav intro-back" onClick={onBack} aria-label="사건 지도로 돌아가기">←</button>
      <section className="intro-scene">
        <div className="signal-ring"><span>{room.symbol}</span><i /><i /></div>
        <div className="intro-copy">
          <span className="eyebrow">긴급 구조 신호 · {room.number} · 난이도 {difficulty}</span>
          <h1>{room.title}</h1>
          <p>{room.story}</p>
          <div className="mission-strip"><span>오늘의 임무</span><strong>{room.objective}</strong><button onClick={() => onSpeak(room.story + ' ' + room.objective)} aria-label="이야기 읽어주기">🔊</button></div>
          <button className="primary-button big-button" onClick={onStart}>조사 시작! <span>→</span></button>
        </div>
      </section>
      <aside className="rotom-note"><span>◉</span><p>반짝이는 물건부터<br /><b>한 번 눌러 봐!</b></p></aside>
    </main>
  );
}

type RoomProps = {
  room: RoomDefinition;
  completed: string[];
  sound: boolean;
  difficulty: Difficulty;
  onExit: () => void;
  onInspect: (puzzle: PuzzleDefinition, index: number) => void;
  onSpeak: () => void;
  onToggleSound: () => void;
  showToast: (text: string) => void;
};

function RoomScene({ room, completed, sound, difficulty, onExit, onInspect, onSpeak, onToggleSound, showToast }: RoomProps) {
  const [cluesOpen, setCluesOpen] = useState(false);
  const currentIndex = room.puzzles.findIndex((puzzle) => !completed.includes(puzzle.id));
  const powered = completed.length >= 3;
  const solved = completed.length === room.puzzles.length;
  return (
    <main className={`room-screen room-${room.id} room-${room.scene} ${powered ? 'is-powered' : ''} ${solved ? 'is-solved' : ''} child-surface`}>
      <header className="room-toolbar">
        <button className="tool-button exit" onClick={onExit}><span>Ⅱ</span> 나가기</button>
        <div className="objective-pill"><span>{room.symbol}</span><div><small>지금 할 일</small><strong>{room.objective}</strong></div><i>{completed.length}/{room.puzzles.length}</i></div>
        <div className="room-tools"><span className="room-difficulty">난이도 {difficulty}</span><button className="tool-button" onClick={onSpeak} aria-label="목표 읽어주기">🔊 읽기</button><button className="tool-button sound" onClick={onToggleSound} aria-label={sound ? '소리 끄기' : '소리 켜기'}>{sound ? '♪' : '×'} 소리</button></div>
      </header>

      <section className="room-canvas" aria-label={`${room.title} 탐색 화면`}>
        {room.scene === 'lab' ? <LabBackdrop room={room} powered={powered} completed={completed} /> : <ForestBackdrop room={room} completed={completed} />}
        {room.puzzles.map((puzzle, index) => (
          <button
            key={puzzle.id}
            className={`hotspot hotspot-${room.scene}-${index + 1} ${index === currentIndex ? 'is-current' : ''} ${completed.includes(puzzle.id) ? 'is-done' : ''}`}
            onClick={() => onInspect(puzzle, index)}
            aria-label={`${puzzle.title}${completed.includes(puzzle.id) ? ', 해결함' : index === currentIndex ? ', 조사 가능' : ', 아직 잠김'}`}
          >
            <span>{completed.includes(puzzle.id) ? '✓' : puzzle.icon}</span><b>{puzzle.title}</b><i />
          </button>
        ))}
      </section>

      <footer className="room-bottom-bar">
        <button className="clue-button" onClick={() => setCluesOpen(true)}><span>🧰</span><div><small>찾은 단서</small><strong>{completed.length}개</strong></div></button>
        <div className="step-indicator">{room.puzzles.map((puzzle, index) => <i key={puzzle.id} className={completed.includes(puzzle.id) ? 'done' : index === currentIndex ? 'current' : ''} />)}</div>
        <button className="helper-button" onClick={() => showToast(currentIndex >= 0 ? room.puzzles[currentIndex].hints[0] : '사건을 멋지게 해결했어!')}><span>◉</span><div><small>막혔을 땐</small><strong>도움 받기</strong></div></button>
      </footer>

      {cluesOpen && <ClueDrawer room={room} completed={completed} onClose={() => setCluesOpen(false)} />}
    </main>
  );
}

function LabBackdrop({ room, powered, completed }: { room: RoomDefinition; powered: boolean; completed: string[] }) {
  const analyzerSolved = completed.includes(room.puzzles[1].id);
  const finalSolved = completed.includes(room.puzzles[room.puzzles.length - 1].id);
  return (
    <div className={`lab-backdrop theme-${room.id}`} aria-hidden="true">
      <div className="lab-window"><span /><span /><span /></div>
      <div className="ceiling-light one" /><div className="ceiling-light two" />
      <div className="lab-shelf"><i /><i /><i /></div>
      <div className="lab-analyzer"><span>{analyzerSolved ? room.pokemonName : '···'}</span><i /></div>
      <div className={`rescue-capsule ${finalSolved ? 'open' : ''}`}><div className="capsule-glass"><span>{room.symbol}</span><i /><b>{finalSolved ? 'OPEN' : 'SIGNAL'}</b></div></div>
      <div className={`generator ${powered ? 'on' : ''}`}><span>{room.id === 'blastoise' ? '💧' : '🔥'}</span><i /></div>
      <div className={`hologram-rig ${completed.length >= 5 ? 'on' : ''}`}><i /><i /><i /><i /></div>
      <div className="floor-grid" />
      {!powered && <div className="lab-darkness" />}
    </div>
  );
}

function ForestBackdrop({ room, completed }: { room: RoomDefinition; completed: string[] }) {
  return (
    <div className={`forest-backdrop theme-${room.id}`} aria-hidden="true">
      <div className="sky-glow" />
      <div className="forest-tree far one">♠</div><div className="forest-tree far two">♠</div><div className="forest-tree far three">♠</div>
      <div className="great-tree"><span /><i /><b>♣</b><em>{room.symbol}</em></div>
      <div className="berry-tree left">♠<i>● ● ● ● ●</i></div><div className="berry-tree middle">♠<i>● ● ●</i></div><div className="berry-tree right">♠<i>● ● ● ● ● ● ●</i></div>
      <div className="stream"><i /><i /><i /><i /></div>
      <div className={`cave ${completed.length >= 4 ? 'open' : ''}`}><span>{room.id === 'gengar' ? '◉' : '♪'}</span></div>
      <div className="forest-path" />
      <div className={`forest-fog ${completed.length >= 3 ? 'lifting' : ''}`}><i /><i /><i /></div>
    </div>
  );
}

function ClueDrawer({ room, completed, onClose }: { room: RoomDefinition; completed: string[]; onClose: () => void }) {
  const clues = room.puzzles.filter((puzzle) => completed.includes(puzzle.id));
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="clue-drawer" onClick={(event) => event.stopPropagation()} aria-label="단서함">
        <header><div><span className="eyebrow">탐정 장비</span><h2>찾은 단서함</h2></div><button className="icon-button" onClick={onClose} aria-label="단서함 닫기">✕</button></header>
        <div className="clue-grid">{room.puzzles.map((puzzle, index) => {
          const found = completed.includes(puzzle.id);
          return <article key={puzzle.id} className={found ? 'found' : 'locked'}><span>{found ? puzzle.icon : '?'}</span><small>단서 {index + 1}</small><strong>{found ? puzzle.reward : '아직 비어 있어'}</strong>{found && index === room.puzzles.length - 1 && <b className="number-clue">✓</b>}</article>;
        })}</div>
        {room.clueNote && clues.length >= 5 && <p className="clue-note">{room.clueNote}</p>}
      </aside>
    </div>
  );
}

function RewardScreen({ room, onGallery, onContinue }: { room: RoomDefinition; onGallery: () => void; onContinue: () => void }) {
  useEffect(() => { recordEvent({ name: 'illustration_opened', roomId: room.id }); }, [room.id]);
  return (
    <main className={`reward-screen reward-${room.id} child-surface`}>
      <div className="reward-rays" aria-hidden="true" />
      <section className="reward-card">
        <div className="reward-label"><span>CASE CLEAR</span><i>사건 해결!</i></div>
        <div className={`reward-picture pokedex-art art-${room.id}`}>
          <img src={room.rewardImage} alt={room.rewardCaption} draggable="false" />
          <div className="reveal-tiles" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} style={{ animationDelay: `${.25 + index * .18}s` }} />)}</div>
          <span className="saved-stamp">도감에 저장!</span>
        </div>
        <div className="reward-copy"><span className="eyebrow">새로운 도감 기록 · {room.pokedexNumber}</span><h1>{room.rewardTitle}</h1><div className="pokemon-tags"><span>{room.species}</span><span>{room.typeLabel}</span></div><p>{room.rewardCaption}</p><small>{room.pokedexEntry}</small></div>
        <div className="reward-actions"><button className="secondary-button big-button" onClick={onGallery}>🖼️ 도감 보기</button><button className="primary-button big-button" onClick={onContinue}>다음에 계속 <span>→</span></button></div>
      </section>
    </main>
  );
}

function GalleryScreen({ progress, onBack, onOpen }: { progress: PlayerProgress; onBack: () => void; onOpen: (id: RoomId) => void }) {
  return (
    <main className="gallery-screen child-surface">
      <header className="gallery-header"><button className="round-nav" onClick={onBack}>←</button><div><span className="eyebrow">나의 모험 기록</span><h1>탐험 도감</h1><p>구조한 친구들과 사건의 마지막 장면을 모아 두는 곳이야.</p></div><div className="gallery-count"><strong>{progress.unlockedIllustrations.length}</strong><span>/ {rooms.length} 장</span></div></header>
      <section className="gallery-grid">{rooms.map((room) => {
        const unlocked = progress.unlockedIllustrations.includes(room.id);
        const record = progress.completedRooms.find((item) => item.roomId === room.id);
        return <article key={room.id} className={`gallery-card ${room.id} ${unlocked ? 'unlocked' : 'locked'}`}>
          <div className={`gallery-image art-${room.id}`}>{unlocked ? <img src={room.rewardImage} alt={`${room.pokemonName} 도감 그림`} draggable="false" /> : <div className="locked-scene"><span>{room.symbol}</span><i>?</i></div>}<span className="gallery-number">{room.pokedexNumber}</span></div>
          <div className="gallery-copy"><span>{unlocked ? `${room.species} · ${room.typeLabel}` : room.number}</span><h2>{unlocked ? room.pokemonName : '아직 비밀인 친구'}</h2><p>{unlocked && record ? `${room.pokedexEntry} · ${new Date(record.completedAt).toLocaleDateString('ko-KR')} 기록` : room.teaser}</p><button disabled={!unlocked} onClick={() => onOpen(room.id)}>{unlocked ? '도감 크게 보기' : '사건 해결 후 열림'}</button></div>
        </article>;
      })}</section>
      <p className="gallery-note">힌트를 써도, 여러 번 도전해도 괜찮아. 끝까지 도운 모든 순간이 멋진 기록이야!</p>
    </main>
  );
}

function ResetConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number>();
  const start = () => {
    setHolding(true);
    holdTimer.current = window.setTimeout(() => void onConfirm(), 1800);
  };
  const stop = () => {
    window.clearTimeout(holdTimer.current);
    setHolding(false);
  };
  return <div className="reset-confirm-backdrop" role="presentation">
    <section className="reset-confirm" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <span className="reset-icon" aria-hidden="true">↻</span>
      <span className="eyebrow">보호자 확인</span>
      <h2 id="reset-title">처음부터 다시 시작할까요?</h2>
      <p>퍼즐 진행과 도감 기록이 모두 지워져요.<br />난이도도 1단계로 돌아갑니다.</p>
      <div><button className="reset-cancel" onClick={onCancel}>취소</button><button className={`reset-hold ${holding ? 'holding' : ''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><i />2초 길게 눌러 초기화</button></div>
    </section>
  </div>;
}

type ParentProps = {
  progress: PlayerProgress;
  onBack: () => void;
  onNickname: (name: string) => void;
  onSettings: (settings: Partial<PlayerProgress['settings']>) => void;
  onRequestReset: () => void;
};

function ParentScreen(props: ParentProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number>();
  const events = useMemo(() => readEvents(), [unlocked, props.progress.completedRooms]);
  const startHold = () => {
    setHolding(true);
    holdTimer.current = window.setTimeout(() => { setUnlocked(true); setHolding(false); }, 1800);
  };
  const stopHold = () => { window.clearTimeout(holdTimer.current); setHolding(false); };

  if (!unlocked) return (
    <main className="parent-gate child-surface">
      <button className="round-nav gate-back" onClick={props.onBack}>←</button>
      <section><span className="gate-icon">🔒</span><span className="eyebrow">어른과 함께 열어 주세요</span><h1>보호자 확인</h1><p>아이의 진행 기록과 설정이 있는 곳입니다.</p><button className={`hold-button ${holding ? 'holding' : ''}`} onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}><i />2초 동안 길게 누르기</button><small>버튼을 놓으면 다시 잠깁니다.</small></section>
    </main>
  );

  return (
    <main className="parent-screen" data-adult="true">
      <header>
        <button className="round-nav" onClick={props.onBack}>←</button>
        <div><span className="eyebrow">보호자 전용</span><h1>설정과 진행 기록</h1></div>
        <div className="parent-header-tools">
          <div className="parent-difficulty" aria-label="게임 난이도 설정"><span>게임 난이도</span>{([1, 2, 3] as Difficulty[]).map((level) => <button key={level} className={props.progress.settings.difficulty === level ? 'selected' : ''} onClick={() => props.onSettings({ difficulty: level })}>{level}단계</button>)}</div>
          <button className="parent-reset-button" onClick={props.onRequestReset}>↻ 초기화</button>
        </div>
      </header>
      <div className="parent-layout">
        <section className="settings-card adult-surface" data-adult="true">
          <h2>플레이 설정</h2>
          <label><span><strong>아이 별명</strong><small>실명 대신 별명을 권장합니다.</small></span><input value={props.progress.nickname} maxLength={12} onChange={(event) => props.onNickname(event.target.value)} /></label>
          <label><span><strong>읽어주기</strong><small>한글 지시문과 영어 단어 발음</small></span><button className={`switch ${props.progress.settings.narration ? 'on' : ''}`} onClick={() => props.onSettings({ narration: !props.progress.settings.narration })} aria-label="읽어주기 전환"><i /></button></label>
          <label><span><strong>게임 소리</strong><small>시각 정보만으로도 완주할 수 있습니다.</small></span><button className={`switch ${props.progress.settings.sound ? 'on' : ''}`} onClick={() => props.onSettings({ sound: !props.progress.settings.sound })} aria-label="게임 소리 전환"><i /></button></label>
          <fieldset><legend><strong>힌트가 나타나는 시간</strong><small>아이에게 감점이나 불이익은 없습니다.</small></legend><div className="segmented">{(['fast', 'normal', 'slow'] as HintSpeed[]).map((speed) => <button key={speed} className={props.progress.settings.hintSpeed === speed ? 'selected' : ''} onClick={() => props.onSettings({ hintSpeed: speed })}>{speed === 'fast' ? '빠르게' : speed === 'normal' ? '보통' : '천천히'}</button>)}</div></fieldset>
        </section>
        <section className="progress-card">
          <h2>사건별 진행</h2>
          {rooms.map((room) => {
            const record = props.progress.completedRooms.find((item) => item.roomId === room.id);
            return <article key={room.id}><span className={`record-icon ${room.id}`}>{room.symbol}</span><div><strong>{room.pokemonName} · {room.shortTitle}</strong><small>{record ? `${new Date(record.completedAt).toLocaleDateString('ko-KR')} 완료` : `${props.progress.completedPuzzleIds[room.id].length}/${room.puzzles.length} 퍼즐 완료`}</small></div><div className="record-stats"><span>{record ? `${Math.floor(record.durationSeconds / 60)}분 ${record.durationSeconds % 60}초` : '진행 중'}</span><span>{record ? `힌트 ${record.maxHintLevel}단계` : '—'}</span></div></article>;
          })}
          <p className="privacy-copy">총 {events.length}개의 익명 플레이 이벤트가 이 기기에만 기록되어 있습니다. 계정·이메일·위치·사진·음성은 수집하지 않습니다.</p>
        </section>
        <section className="skills-card">
          <h2>이 게임에서 연습하는 것</h2>
          <p className="skills-intro">퍼즐마다 하나의 학습 목표가 붙어 있습니다. 아이가 푼 퍼즐에는 도장이 찍힙니다.</p>
          {rooms.map((room) => (
            <div key={room.id} className="skill-room">
              <h3>{room.shortTitle}</h3>
              <ul>
                {room.puzzles.map((puzzle) => {
                  const done = props.progress.completedPuzzleIds[room.id].includes(puzzle.id);
                  return (
                    <li key={puzzle.id} className={done ? 'done' : ''}>
                      <span className={`domain-tag domain-${puzzle.domain}`}>{domainLabel[puzzle.domain]}</span>
                      <div><strong>{puzzle.title}</strong><small>{puzzle.practice}</small></div>
                      <b aria-label={done ? '완료' : '아직'}>{done ? '해결' : ''}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
      <footer>포켓몬 및 관련 명칭은 권리자의 자산입니다. 이 앱은 가족·지인 비공개 테스트용이며 상업적 용도로 배포하지 않습니다.</footer>
    </main>
  );
}

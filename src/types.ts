export type RoomId = 'charizard' | 'snorlax' | 'gengar' | 'blastoise' | 'pikachu' | 'eevee';

export type PuzzleKind =
  | 'antonyms'
  | 'wordMatch'
  | 'sumTen'
  | 'pattern'
  | 'symmetry'
  | 'keypad'
  | 'sentence'
  | 'berries'
  | 'sequence'
  | 'directions'
  | 'shadow'
  | 'route';

/** 보호자 화면에서 "무엇을 연습했는지" 보여주기 위한 분류. */
export type SkillDomain = 'korean' | 'english' | 'math' | 'logic' | 'space' | 'map';

export type PuzzleDefinition = {
  id: string;
  kind: PuzzleKind;
  title: string;
  instruction: string;
  icon: string;
  reward: string;
  result: string;
  hints: [string, string];
  domain: SkillDomain;
  /** 보호자에게 보여주는 한 줄 학습 설명. */
  practice: string;
};

export type RoomDefinition = {
  id: RoomId;
  scene: 'lab' | 'forest';
  number: string;
  pokemonName: string;
  pokedexNumber: string;
  species: string;
  typeLabel: string;
  symbol: string;
  title: string;
  shortTitle: string;
  location: string;
  story: string;
  objective: string;
  teaser: string;
  pokedexEntry: string;
  clueNote?: string;
  accent: string;
  rewardImage: string;
  rewardTitle: string;
  rewardCaption: string;
  puzzles: PuzzleDefinition[];
};

export type HintSpeed = 'fast' | 'normal' | 'slow';
export type Difficulty = 1 | 2 | 3;

export type CompletionRecord = {
  roomId: RoomId;
  completedAt: string;
  durationSeconds: number;
  maxHintLevel: 0 | 1 | 2;
  replayCount: number;
};

export type PlayerProgress = {
  schemaVersion: 2;
  nickname: string;
  completedPuzzleIds: Record<RoomId, string[]>;
  completedRooms: CompletionRecord[];
  unlockedIllustrations: RoomId[];
  settings: {
    narration: boolean;
    hintSpeed: HintSpeed;
    sound: boolean;
    difficulty: Difficulty;
  };
};

export type LocalEvent = {
  name: string;
  at: string;
  roomId?: RoomId;
  puzzleId?: string;
  level?: number;
};

export const domainLabel: Record<SkillDomain, string> = {
  korean: '한글',
  english: '영어',
  math: '수학',
  logic: '규칙',
  space: '공간',
  map: '지도',
};

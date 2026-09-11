import type { LocalEvent, PlayerProgress, RoomId } from '../types';

const DB_NAME = 'mystery-rescue-db';
const STORE_NAME = 'game';
const PROGRESS_KEY = 'player-progress';
const FALLBACK_KEY = 'mystery-rescue-progress';
const EVENT_KEY = 'mystery-rescue-local-events-v2';

const ROOM_IDS: RoomId[] = ['charizard', 'snorlax', 'gengar', 'blastoise'];

export const defaultProgress: PlayerProgress = {
  schemaVersion: 2,
  nickname: '신입 탐정',
  completedPuzzleIds: { charizard: [], snorlax: [], gengar: [], blastoise: [] },
  completedRooms: [],
  unlockedIllustrations: [],
  settings: { narration: true, hintSpeed: 'normal', sound: true, difficulty: 1 },
};

type StoredProgress = Partial<PlayerProgress> & {
  schemaVersion?: number;
  settings?: Partial<PlayerProgress['settings']>;
  completedPuzzleIds?: Partial<Record<RoomId, string[]>> & Record<string, unknown>;
};

function normalizeProgress(value: StoredProgress | undefined): PlayerProgress {
  if (!value) return structuredClone(defaultProgress);

  // 이전 2개 사건 저장값은 이름과 보호자 설정만 보존하고 새 4개 사건은 처음부터 시작한다.
  if (value.schemaVersion !== 2) return {
    ...structuredClone(defaultProgress),
    nickname: typeof value.nickname === 'string' ? value.nickname : defaultProgress.nickname,
    settings: { ...defaultProgress.settings, ...(value.settings ?? {}) },
  };

  const completedPuzzleIds = Object.fromEntries(ROOM_IDS.map((roomId) => [
    roomId,
    Array.isArray(value.completedPuzzleIds?.[roomId]) ? value.completedPuzzleIds[roomId] : [],
  ])) as PlayerProgress['completedPuzzleIds'];
  const completedRooms = (value.completedRooms ?? [])
    .filter((record) => ROOM_IDS.includes(record.roomId))
    .map((record) => ({ ...record, maxHintLevel: Math.min(2, record.maxHintLevel) as 0 | 1 | 2 }));
  const unlockedIllustrations = (value.unlockedIllustrations ?? []).filter((roomId) => ROOM_IDS.includes(roomId));

  return {
    ...defaultProgress,
    ...value,
    schemaVersion: 2,
    completedPuzzleIds,
    completedRooms,
    unlockedIllustrations,
    settings: { ...defaultProgress.settings, ...(value.settings ?? {}) },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadProgress(): Promise<PlayerProgress> {
  let stored: StoredProgress | undefined;
  try {
    const db = await openDatabase();
    stored = await new Promise<StoredProgress | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(PROGRESS_KEY);
      request.onsuccess = () => resolve(request.result as StoredProgress | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // localStorage 사본을 아래에서 확인한다.
  }

  if (!stored) {
    const fallback = localStorage.getItem(FALLBACK_KEY);
    if (fallback) {
      try { stored = JSON.parse(fallback) as StoredProgress; } catch { /* 손상된 사본은 무시한다. */ }
    }
  }
  return normalizeProgress(stored);
}

export async function saveProgress(progress: PlayerProgress): Promise<void> {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(progress));
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(progress, PROGRESS_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // localStorage fallback was already written.
  }
}

export function recordEvent(event: Omit<LocalEvent, 'at'>): void {
  const events = JSON.parse(localStorage.getItem(EVENT_KEY) ?? '[]') as LocalEvent[];
  events.push({ ...event, at: new Date().toISOString() });
  localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-500)));
}

export function readEvents(): LocalEvent[] {
  return JSON.parse(localStorage.getItem(EVENT_KEY) ?? '[]') as LocalEvent[];
}

export async function clearAllProgress(): Promise<void> {
  localStorage.removeItem(FALLBACK_KEY);
  localStorage.removeItem(EVENT_KEY);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // Nothing else to clear.
  }
}

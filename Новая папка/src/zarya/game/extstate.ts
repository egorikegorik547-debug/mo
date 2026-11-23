import { DAY_LENGTH } from './data';
import type { Game, Unit } from './game';

/* ───────────── Общее состояние новых систем ───────────── */

export type ChronKind = 'info' | 'good' | 'warn' | 'war' | 'peace' | 'sci' | 'gov' | 'wonder' | 'death' | 'season';

export interface ChronEntry {
  day: number;
  text: string;
  kind: ChronKind;
}

export interface Cargo {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  goods: number;
}
export const emptyCargo = (): Cargo => ({ gold: 0, food: 0, wood: 0, stone: 0, goods: 0 });

export interface Rel {
  a: number;
  b: number;
  kind: 'war' | 'ally';
  since: number;
  battles: number;
  cd: number;
}

export interface RivalMarch {
  id: number;
  from: number;
  to: number;
  n: number;
  t: number;
  dur: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface Caravan {
  id: number;
  from: number;
  fromName: string;
  path: { x: number; y: number }[];
  pi: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sea: boolean;
  seaT: number;
  seaDur: number;
  cargo: Cargo;
  members: Unit[];
  escort: number;
  state: 'go' | 'ambush';
  dir: number;
  risk: number;
  ambush: Ambush | null;
}

export interface Ambush {
  kind: 'bandit' | 'enemy';
  n: number;
  t: number;
  units: Unit[];
  resolved: boolean;
  won: boolean;
}

export interface Wonder {
  id: number;
  wk: 'mine' | 'monolith' | 'wreck' | 'fort';
  x: number;
  y: number;
  owner: 'none' | 'player' | 'bot';
  ownerName: string;
  since: number;
}

export interface Sample {
  day: number;
  pop: number;
  gold: number;
  goods: number;
  techs: number;
  land: number;
  army: number;
  prov: number;
}

export interface Counters {
  riots: number;
  peace: number;
  conquered: number;
  battlesWon: number;
  raidsRepelled: number;
  caravansDone: number;
  caravansLost: number;
  banditsKilled: number;
  executed: number;
  iceConq: number;
  absorbed: number;
  aiWars: number;
  aiAlliances: number;
  goldDelivered: number;
}

export interface VictoryProg {
  mil: number;
  gold: number;
  goods: number;
  sci: number;
  sciTarget: number;
  t: number;
}

export interface ExtState {
  season: number;
  frozen: number[];
  rel: Rel[];
  truce: Record<string, number>;
  rivalT: number;
  allyT: number;
  rivalMarches: RivalMarch[];
  rivalNews: number;
  caravans: Caravan[];
  caravanDay: number;
  caravanLog: { t: number; text: string; ok: boolean }[];
  wonders: Wonder[];
  wonderT: number;
  ach: Record<string, number>;
  achT: number;
  cnt: Counters;
  chronicle: ChronEntry[];
  samples: Sample[];
  sampleDay: number;
  victory: { type: 'mil' | 'eco' | 'sci'; day: number } | null;
  victoryDismissed: boolean;
  prog: VictoryProg;
  epochSeen: string;
  popSeen: number;
  techSeen: number;
  winterHungerOk: boolean;
  guide: boolean;
  milT: number;
  genSeen: number;
}

export function createExt(): ExtState {
  return {
    season: -1,
    frozen: [],
    rel: [],
    truce: {},
    rivalT: 30,
    allyT: 60,
    rivalMarches: [],
    rivalNews: 0,
    caravans: [],
    caravanDay: 1,
    caravanLog: [],
    wonders: [],
    wonderT: 0,
    ach: {},
    achT: 2,
    cnt: { riots: 0, peace: 0, conquered: 0, battlesWon: 0, raidsRepelled: 0, caravansDone: 0, caravansLost: 0, banditsKilled: 0, executed: 0, iceConq: 0, absorbed: 0, aiWars: 0, aiAlliances: 0, goldDelivered: 0 },
    chronicle: [],
    samples: [],
    sampleDay: 0,
    victory: null,
    victoryDismissed: false,
    prog: { mil: 0, gold: 0, goods: 0, sci: 0, sciTarget: 100, t: 0 },
    epochSeen: '',
    popSeen: 0,
    techSeen: 0,
    winterHungerOk: true,
    guide: true,
    milT: 0,
    genSeen: 1,
  };
}

export const dayNo = (g: Game) => Math.floor(g.time / DAY_LENGTH) + 1;

/** запись в Летопись государства */
export function chron(g: Game, text: string, kind: ChronKind = 'info') {
  const X = g.ext;
  if (!X) return;
  const last = X.chronicle[X.chronicle.length - 1];
  const day = dayNo(g);
  if (last && last.text === text && last.day === day) return;
  X.chronicle.push({ day, text, kind });
  if (X.chronicle.length > 600) X.chronicle.splice(0, X.chronicle.length - 600);
}

/** поколение жителя (1 — основатели) */
export function generationOf(g: Game, id: number, memo: Map<number, number> = new Map(), depth = 0): number {
  const hit = memo.get(id);
  if (hit) return hit;
  const p = g.life.people.get(id);
  if (!p || !p.parents.length || depth > 12) {
    memo.set(id, 1);
    return 1;
  }
  let best = 0;
  for (const pid of p.parents) best = Math.max(best, generationOf(g, pid, memo, depth + 1));
  const v = best + 1;
  memo.set(id, v);
  return v;
}

export function maxGeneration(g: Game): number {
  const memo = new Map<number, number>();
  let best = 1;
  for (const id of g.life.people.keys()) best = Math.max(best, generationOf(g, id, memo));
  return best;
}

import { B, DAY_LENGTH } from './data';
import type { Game } from './game';
import type { Mods } from './techs';
import type { Town } from './towns';
import { chron } from './extstate';

/* ───────────── Четыре сезона: каждые 9 игровых дней ───────────── */

export const SEASON_DAYS = 9;

export interface SeasonDef {
  id: 'spring' | 'summer' | 'autumn' | 'winter';
  name: string;
  icon: string;
  color: string;
  lines: string[];
  fx: Partial<Mods>;
}

export const SEASONS: SeasonDef[] = [
  {
    id: 'spring',
    name: 'Весна',
    icon: '🌱',
    color: '#9be37a',
    lines: ['Ягоды растут быстрее', 'Урожай +5%', 'Рождаемость чуть выше'],
    fx: { farm: 1.05, gather: 1.1, birth: 0.93 },
  },
  {
    id: 'summer',
    name: 'Лето',
    icon: '☀️',
    color: '#ffd84a',
    lines: ['Урожай +15%', 'Сбор ягод +15%', 'Рубка +5%'],
    fx: { farm: 1.15, gather: 1.15, chop: 1.05 },
  },
  {
    id: 'autumn',
    name: 'Осень',
    icon: '🍂',
    color: '#f09a30',
    lines: ['Урожай +30%, ягоды +35%', 'Дожди: походы и караваны медленнее', 'Кусты отрастают быстрее'],
    fx: { farm: 1.3, gather: 1.35, speed: 0.93 },
  },
  {
    id: 'winter',
    name: 'Зима',
    icon: '❄️',
    color: '#bfe6ff',
    lines: ['Поля спят, кусты пусты', 'Еды нужно на 30% больше', 'Проливы замерзают: армия идёт по льду'],
    fx: { farm: 0, gather: 0.05, hunger: 1.3, speed: 0.95, chop: 0.95 },
  },
];

export interface SeasonInfo {
  idx: number;
  def: SeasonDef;
  /** день внутри сезона 1..9 */
  dayIn: number;
  left: number;
  year: number;
  /** дробная позиция внутри сезона, в днях */
  pos: number;
  rainy: boolean;
  winter: boolean;
}

export function seasonInfo(g: Game): SeasonInfo {
  const d = g.time / DAY_LENGTH;
  const di = Math.floor(d);
  const idx = Math.floor(di / SEASON_DAYS) % 4;
  const pos = d - Math.floor(di / SEASON_DAYS) * SEASON_DAYS;
  return {
    idx,
    def: SEASONS[idx],
    dayIn: Math.floor(pos) + 1,
    left: Math.max(1, SEASON_DAYS - Math.floor(pos)),
    year: Math.floor(di / (SEASON_DAYS * 4)) + 1,
    pos,
    rainy: idx === 2,
    winter: idx === 3,
  };
}

export const isWinter = (g: Game) => seasonInfo(g).winter;

/** модификаторы текущего сезона */
export function applySeasonMods(g: Game, m: Mods) {
  const s = seasonInfo(g);
  const fx = s.def.fx;
  for (const k of Object.keys(fx) as (keyof Mods)[]) m[k] *= fx[k]!;
}

/** множитель скорости походов и караванов (дожди и снег) */
export function marchSpeedK(g: Game): number {
  const s = seasonInfo(g);
  if (s.idx === 2) return 0.72;
  if (s.idx === 3) return 0.9;
  return 1;
}

/** поля: множитель урожая от сезона для провинций */
export function seasonFarmK(g: Game): number {
  return seasonInfo(g).def.fx.farm ?? 1;
}

/** интенсивность дождя 0..1 */
export function rainK(g: Game): number {
  const s = seasonInfo(g);
  if (!s.rainy) return 0;
  const edge = Math.min(1, s.pos / 0.6, (SEASON_DAYS - s.pos) / 0.6);
  const t = g.time * 0.011;
  return Math.max(0, Math.min(1, (0.62 + 0.38 * Math.sin(t) * Math.sin(t * 0.37 + 1)) * edge));
}

/** видимая толщина льда/снега 0..1 */
export function iceK(g: Game): number {
  const s = seasonInfo(g);
  if (s.winter) return Math.min(1, s.pos / 1.2);
  if (s.idx === 0 && s.year > 1) return Math.max(0, 1 - s.pos / 1.2);
  return 0;
}

/** лёд достаточно крепок для перехода */
export function iceSolid(g: Game): boolean {
  const s = seasonInfo(g);
  return s.winter && s.pos >= 1.2;
}

/* ───────────── Лёд: связность суши через замёрзшие проливы ───────────── */

const ICE_LIMIT = 4;
const iceCache = new WeakMap<object, Int16Array>();

export function frozenTile(g: Game, i: number): boolean {
  const w = g.world;
  if (w.biome[i] > B.WATER) return false;
  const sh = w.shore;
  return !!sh && sh[i] <= ICE_LIMIT;
}

function iceComponents(g: Game): Int16Array {
  const w = g.world;
  let comp = iceCache.get(w.biome);
  if (comp) return comp;
  const n = w.w * w.h;
  comp = new Int16Array(n).fill(-1);
  let id = 0;
  const ok = (i: number) => w.biome[i] > B.WATER || frozenTile(g, i);
  const stack: number[] = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0 || !ok(s)) continue;
    comp[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w.w;
      const y = (i / w.w) | 0;
      if (x > 0 && comp[i - 1] < 0 && ok(i - 1)) ((comp[i - 1] = id), stack.push(i - 1));
      if (x < w.w - 1 && comp[i + 1] < 0 && ok(i + 1)) ((comp[i + 1] = id), stack.push(i + 1));
      if (y > 0 && comp[i - w.w] < 0 && ok(i - w.w)) ((comp[i - w.w] = id), stack.push(i - w.w));
      if (y < w.h - 1 && comp[i + w.w] < 0 && ok(i + w.w)) ((comp[i + w.w] = id), stack.push(i + w.w));
    }
    id++;
  }
  iceCache.set(w.biome, comp);
  return comp;
}

/** соединены ли две точки сушей или льдом (только когда лёд встал) */
export function iceLinked(g: Game, ax: number, ay: number, bx: number, by: number): boolean {
  if (!iceSolid(g)) return false;
  const w = g.world;
  const c = iceComponents(g);
  const a = c[Math.floor(ay) * w.w + Math.floor(ax)];
  const b = c[Math.floor(by) * w.w + Math.floor(bx)];
  return a >= 0 && a === b;
}

export function townViaIce(g: Game, t: Town): boolean {
  const camp = g.buildings[0];
  if (!camp) return false;
  return iceLinked(g, camp.x + 1, camp.y + 1, t.x, t.y);
}

/* ───────────── Обновление ───────────── */

function winterize(g: Game) {
  const w = g.world;
  const X = g.ext;
  X.frozen = [];
  for (let i = 0; i < w.objs.length; i++) {
    const o = w.objs[i];
    if (o && o.kind === 'bush' && o.amount > 0) {
      X.frozen.push(i);
      o.spr = 'bushEmpty';
      o.amount = 0;
    }
  }
}

function thaw(g: Game) {
  const w = g.world;
  const X = g.ext;
  for (const i of X.frozen) {
    const o = w.objs[i];
    if (o && o.kind === 'bush' && o.amount <= 0) {
      o.spr = 'bush';
      o.amount = o.max || 6;
      o.regrow = 0;
      const k = g.regrow.indexOf(o);
      if (k >= 0) g.regrow.splice(k, 1);
    }
  }
  X.frozen = [];
}

export function updateSeasons(g: Game, _dt: number) {
  const X = g.ext;
  const s = seasonInfo(g);
  if (s.idx === X.season) return;
  const first = X.season === -1;
  const prev = X.season;
  X.season = s.idx;
  if (prev === 3 && s.idx === 0) thaw(g);
  if (s.idx === 3 && !(first && X.frozen.length)) winterize(g);
  if (first && s.idx !== 3 && X.frozen.length) thaw(g);
  g.refreshMods();
  if (first) return;
  const def = s.def;
  const text = `Наступила ${def.name.toLowerCase()} (год ${s.year}). ${def.lines[0]}.`;
  g.msg(`${def.icon} ${def.name}! ${def.lines.join(' · ')}`, s.idx === 3 ? 'warn' : 'info');
  chron(g, text, 'season');
  if (s.idx === 3) {
    X.winterHungerOk = true;
    g.sfx('alarm');
  }
  if (s.idx === 0 && s.year > 1) g.msg('Лёд растаял — проливы снова непроходимы без флота', 'info');
}

/** зимой отросшие ягоды не растут */
export function regrowSpeed(g: Game): number {
  const s = seasonInfo(g);
  if (s.idx === 3) return 0;
  if (s.idx === 2) return 1.8;
  if (s.idx === 0) return 1.3;
  return 1;
}

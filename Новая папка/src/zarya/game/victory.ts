import { B } from './data';
import type { Game } from './game';
import { chron, dayNo, type Sample } from './extstate';
import { techsFor } from './techs';

/* ───────────── Условия победы: три пути ───────────── */

export const VICTORY_INFO = {
  mil: { name: 'Военное господство', icon: '⚔️', desc: 'Контролировать 80% карты: земли ближе к вашим флагам, селениям и лагерю, чем к любым чужим.', color: '#e5484d' },
  eco: { name: 'Экономическая гегемония', icon: '💰', desc: 'Одновременно накопить 5000 золота и 1000 товаров.', color: '#f2c94c' },
  sci: { name: 'Научный триумф', icon: '🔬', desc: 'Изучить 100 технологий.', color: '#4aa8ff' },
} as const;
export type VictoryType = keyof typeof VICTORY_INFO;

export const WIN_GOLD = 5000;
export const WIN_GOODS = 1000;
export const WIN_SHARE = 0.8;

const landCache = new WeakMap<object, Uint32Array>();

function landTiles(g: Game): Uint32Array {
  const w = g.world;
  let c = landCache.get(w.biome);
  if (!c) {
    const arr: number[] = [];
    for (let i = 0; i < w.w * w.h; i++) if (w.biome[i] > B.WATER) arr.push(i);
    c = Uint32Array.from(arr);
    landCache.set(w.biome, c);
  }
  return c;
}

/** доля суши, которая «ближе» к игроку, чем к любому другому центру силы */
export function controlShare(g: Game): number {
  const camp = g.buildings[0];
  if (!camp) return 0;
  const centers: { x: number; y: number; p: boolean }[] = [{ x: camp.x + 1, y: camp.y + 1, p: true }];
  for (const t of g.towns) centers.push({ x: t.x, y: t.y, p: t.owner === 'player' });
  for (const c of g.life.claims) centers.push({ x: c.x, y: c.y, p: c.owner === 0 || g.towns.some((t) => t.id === c.owner && t.owner === 'player') });
  const land = landTiles(g);
  if (!land.length) return 0;
  const w = g.world.w;
  let mine = 0;
  for (let k = 0; k < land.length; k++) {
    const i = land[k];
    const x = i % w;
    const y = (i / w) | 0;
    let best = 1e9;
    let isP = false;
    for (const c of centers) {
      const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (d < best) {
        best = d;
        isP = c.p;
      }
    }
    if (isP) mine++;
  }
  return mine / land.length;
}

export function sciTarget(g: Game) {
  return Math.min(100, techsFor(g.spec).length);
}

export function takeSample(g: Game): Sample {
  const X = g.ext;
  return {
    day: dayNo(g),
    pop: g.totalPop() + Math.floor(g.towns.filter((t) => t.owner === 'player').reduce((a, t) => a + t.pop, 0)),
    gold: Math.floor(g.res.gold),
    goods: Math.floor(g.res.goods),
    techs: g.done.size,
    land: Math.round((X.prog.mil || 0) * 1000) / 10,
    army: g.army + g.awayCount(),
    prov: g.towns.filter((t) => t.owner === 'player').length,
  };
}

export function updateVictory(g: Game, dt: number) {
  const X = g.ext;
  if (g.mode !== 'play') return;
  const day = dayNo(g);
  if (day !== X.sampleDay) {
    X.sampleDay = day;
    X.samples.push(takeSample(g));
    if (X.samples.length > 400) X.samples.splice(1, 1);
  }
  X.prog.t -= dt;
  if (X.prog.t > 0) return;
  X.prog.t = 3;
  X.prog.mil = controlShare(g);
  X.prog.gold = Math.min(1, g.res.gold / WIN_GOLD);
  X.prog.goods = Math.min(1, g.res.goods / WIN_GOODS);
  X.prog.sciTarget = sciTarget(g);
  X.prog.sci = Math.min(1, g.done.size / X.prog.sciTarget);
  if (X.victory || g.gameOver || g.time < 120) return;
  let won: 'mil' | 'eco' | 'sci' | null = null;
  if (X.prog.mil >= WIN_SHARE) won = 'mil';
  else if (!g.dev.infinite && g.res.gold >= WIN_GOLD && g.res.goods >= WIN_GOODS) won = 'eco';
  else if (g.done.size >= X.prog.sciTarget) won = 'sci';
  if (won) {
    X.victory = { type: won, day };
    X.samples.push(takeSample(g));
    chron(g, `ПОБЕДА! ${VICTORY_INFO[won].name}`, 'good');
    g.sfx('fanfare');
    g.setPaused(true);
  }
}

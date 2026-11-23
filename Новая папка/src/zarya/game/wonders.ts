import { B } from './data';
import type { Game } from './game';
import { chron, type Wonder } from './extstate';
import type { Mods } from './techs';
import { isStateOwner } from './social';

/* ───────────── Чудеса и руины на карте ───────────── */

export interface WonderDef {
  name: string;
  icon: string;
  desc: string;
  bonus: string;
  fx: Partial<Mods>;
}

export const WONDER_DEFS: Record<Wonder['wk'], WonderDef> = {
  mine: { name: 'Заброшенный рудник', icon: '⛏️', desc: 'Древние штольни, полные нетронутой руды.', bonus: 'Добыча камня +25% · золото +5%', fx: { mine: 1.25, gold: 1.05 } },
  monolith: { name: 'Древний монолит', icon: '🗿', desc: 'Чёрный камень с рунами, которые светятся по ночам.', bonus: 'Знания +15% · лояльность +3', fx: { know: 1.15, loyalty: 3 } },
  wreck: { name: 'Затонувший корабль', icon: '🚢', desc: 'Остов торговой каравеллы, выброшенный на мель.', bonus: 'Золото +12% · присоединение −8%', fx: { gold: 1.12, annex: 0.92 } },
  fort: { name: 'Руины древней крепости', icon: '🏯', desc: 'Обрушенные стены, в которых ещё живёт воинский дух.', bonus: 'Оборона +12% · атака +6%', fx: { def: 1.12, atk: 1.06 } },
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function placeWonders(g: Game) {
  const w = g.world;
  const X = g.ext;
  X.wonders = [];
  const camp = g.buildings[0];
  if (!camp) return;
  const cx = camp.x + 1;
  const cy = camp.y + 1;
  const pLand = w.landId[cy * w.w + cx];
  const kinds: Wonder['wk'][] = ['mine', 'monolith', 'wreck'];
  if (w.w >= 100 || Math.random() < 0.5) kinds.push('fort');

  const okTile = (x: number, y: number, kind: Wonder['wk']) => {
    if (x < 5 || y < 5 || x >= w.w - 5 || y >= w.h - 5) return false;
    const i = y * w.w + x;
    const b = w.biome[i];
    if (kind === 'wreck') {
      if (b !== B.BEACH) return false;
      let water = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.biome[(y + dy) * w.w + x + dx] <= B.WATER) water = true;
      if (!water) return false;
    } else if (b <= B.BEACH || b === B.DESERT) return false;
    if (w.blocked[i]) return false;
    for (const t of g.towns) if (Math.hypot(t.x - x, t.y - y) < 15) return false;
    if (Math.hypot(cx - x, cy - y) < 16) return false;
    for (const o of X.wonders) if (Math.hypot(o.x - x, o.y - y) < 20) return false;
    return true;
  };

  const cands: { x: number; y: number }[] = [];
  for (let y = 6; y < w.h - 6; y++) for (let x = 6; x < w.w - 6; x++) cands.push({ x, y });
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }

  kinds.forEach((kind, idx) => {
    // первое чудо — недалеко и на вашей земле, остальные — где придётся
    const pick = (strict: boolean) =>
      cands.find((c) => {
        if (!okTile(c.x, c.y, kind)) return false;
        const d = Math.hypot(c.x - cx, c.y - cy);
        const sameLand = w.landId[c.y * w.w + c.x] === pLand;
        if (!strict) return true;
        if (idx === 0) return sameLand && d < 34;
        if (idx === 1) return sameLand && d < 60;
        return true;
      });
    const c = pick(true) ?? pick(false);
    if (!c) return;
    const i = c.y * w.w + c.x;
    w.objs[i] = null;
    g.marked.delete(i);
    w.blocked[i] = 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (c.y + dy) * w.w + c.x + dx;
      const o = w.objs[j];
      if (o && o.kind !== 'bush') {
        w.objs[j] = null;
        w.blocked[j] = 0;
      }
    }
    X.wonders.push({ id: g.nextId++, wk: kind, x: c.x, y: c.y, owner: 'none', ownerName: '', since: 0 });
  });
  void rnd;
}

/** бонусы чудес, захваченных игроком */
export function applyWonderMods(g: Game, m: Mods) {
  for (const o of g.ext.wonders) {
    if (o.owner !== 'player') continue;
    const fx = WONDER_DEFS[o.wk].fx;
    for (const k of Object.keys(fx) as (keyof Mods)[]) {
      if (k === 'loyalty' || k === 'carry') m[k] += fx[k]!;
      else m[k] *= fx[k]!;
    }
  }
}

export function wonderCount(g: Game) {
  return g.ext.wonders.filter((w) => w.owner === 'player').length;
}

export function updateWonders(g: Game, dt: number) {
  const X = g.ext;
  if (g.mode !== 'play' || !g.terr) return;
  X.wonderT -= dt;
  if (X.wonderT > 0) return;
  X.wonderT = 1.5;
  let changed = false;
  for (const o of X.wonders) {
    const code = g.terr.owner[o.y * g.terr.w + o.x];
    let owner: Wonder['owner'] = 'none';
    let name = '';
    if (code && isStateOwner(g, code)) owner = 'player';
    else if (code >= 2) {
      owner = 'bot';
      name = g.towns[code - 2]?.name ?? '';
    }
    if (owner === o.owner && name === o.ownerName) continue;
    const prev = o.owner;
    o.owner = owner;
    o.ownerName = name;
    o.since = g.time;
    changed = true;
    const def = WONDER_DEFS[o.wk];
    if (owner === 'player') {
      g.msg(`${def.icon} Захвачено: «${def.name}»! ${def.bonus}`, 'good');
      g.sfx('fanfare');
      g.sfx('mystic');
      chron(g, `Флаг поднят над чудом: «${def.name}» — ${def.bonus.toLowerCase()}`, 'wonder');
      g.particles.push({ x: o.x * 16 + 8, y: o.y * 12 - 6, vx: 0, vy: -10, life: 1.6, max: 1.6, color: '#ffe27a', size: 0, grav: 0, text: '✦' });
    } else if (prev === 'player') {
      g.msg(`Потеряно чудо: «${def.name}» — бонус исчез`, 'warn');
      chron(g, `Утрачено чудо: «${def.name}»`, 'warn');
    } else if (owner === 'bot') {
      g.msg(`«${name}» прибрало к рукам «${def.name}»`, 'info');
      chron(g, `«${name}» заняло земли с «${def.name}»`, 'wonder');
    }
  }
  if (changed) g.refreshMods();
}

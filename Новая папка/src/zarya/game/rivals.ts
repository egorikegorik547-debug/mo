import { TH, TW } from './data';
import type { Game } from './game';
import { chron, dayNo, type Rel } from './extstate';
import { iceLinked, marchSpeedK } from './seasons';
import { townDef, type Town } from './towns';

/* ───────────── Войны, союзы и поглощения между ИИ-городами ───────────── */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const RIVAL_GRACE = 1260;

const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const townById = (g: Game, id: number) => g.towns.find((t) => t.id === id);

export function rootOf(g: Game, t: Town): Town {
  let cur = t;
  for (let i = 0; i < 8 && cur.overlord != null; i++) {
    const up = townById(g, cur.overlord);
    if (!up || up.owner !== 'free') break;
    cur = up;
  }
  return cur;
}

export function realmMembers(g: Game, root: Town): Town[] {
  return g.towns.filter((t) => t.owner === 'free' && rootOf(g, t).id === root.id);
}

const strike = (t: Town) => t.soldiers + t.pop * 0.08;

function realmPower(g: Game, root: Town): number {
  let s = 0;
  for (const m of realmMembers(g, root)) s += townDef(m);
  return s;
}

function sameZone(g: Game, a: Town, b: Town): boolean {
  return a.land === b.land || iceLinked(g, a.x, a.y, b.x, b.y);
}

const dist = (a: Town, b: Town) => Math.hypot(a.x - b.x, a.y - b.y);

function relOf(g: Game, a: number, b: number, kind?: Rel['kind']): Rel | undefined {
  return g.ext.rel.find((r) => ((r.a === a && r.b === b) || (r.a === b && r.b === a)) && (!kind || r.kind === kind));
}

function allies(g: Game, t: Town): Town[] {
  const out: Town[] = [];
  for (const r of g.ext.rel) {
    if (r.kind !== 'ally') continue;
    const o = r.a === t.id ? r.b : r.b === t.id ? r.a : -1;
    const ot = o >= 0 ? townById(g, o) : undefined;
    if (ot && ot.owner === 'free') out.push(ot);
  }
  return out;
}

function nearPlayer(g: Game, ...ts: Town[]): boolean {
  const camp = g.buildings[0];
  if (!camp) return false;
  return ts.some((t) => Math.hypot(t.x - camp.x, t.y - camp.y) < 58) || ts.some((t) => t.owner === 'player');
}

function news(g: Game, text: string, kind: 'info' | 'warn' | 'good', near: boolean, chronKind: 'war' | 'peace' | 'info' = 'info') {
  chron(g, text, chronKind);
  if (near && g.time - g.ext.rivalNews > 9) {
    g.ext.rivalNews = g.time;
    g.msg(text, kind);
  }
}

/* ───────────── Вспомогательное для других систем ───────────── */

/** дополнительные воины державы, которые могут пойти в набег */
export function realmSoldiers(g: Game, t: Town): number {
  if (t.overlord != null) return 0;
  let s = 0;
  for (const m of realmMembers(g, t)) if (m.id !== t.id) s += m.soldiers;
  return s;
}

/** добавка к обороне при атаке игрока на подданного / главу державы */
export function defBonus(g: Game, t: Town): number {
  const root = rootOf(g, t);
  let extra = 0;
  if (root.id !== t.id) extra += townDef(root) * 0.5;
  for (const m of realmMembers(g, root)) if (m.id !== t.id && m.id !== root.id) extra += townDef(m) * 0.2;
  for (const a of allies(g, root)) if (sameZone(g, a, t)) extra += townDef(a) * 0.3;
  return extra;
}

export function realmSize(g: Game, t: Town): number {
  return realmMembers(g, rootOf(g, t)).length;
}

/** игрок покорил/присоединил город — он покидает державу, а его вассалы уходят на волю */
export function detachTown(g: Game, t: Town) {
  const was = t.overlord;
  t.overlord = undefined;
  let freed = 0;
  for (const o of g.towns) {
    if (o.overlord === t.id) {
      o.overlord = undefined;
      o.attitude = clamp(o.attitude + 12, 0, 100);
      freed++;
    }
  }
  g.ext.rel = g.ext.rel.filter((r) => r.a !== t.id && r.b !== t.id);
  if (freed) {
    g.msg(`Держава «${t.name}» пала — ${freed} её подданных вновь независимы`, 'info');
    chron(g, `Пала держава «${t.name}»: подданные вернули независимость`, 'war');
  }
  void was;
}

export function strongStates(g: Game): number {
  const seen = new Set<number>();
  let n = 0;
  for (const t of g.towns) {
    if (t.owner !== 'free') continue;
    const r = rootOf(g, t);
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (realmMembers(g, r).length >= 2) n++;
  }
  return n;
}

/* ───────────── Решения ИИ ───────────── */

function roots(g: Game): Town[] {
  return g.towns.filter((t) => t.owner === 'free' && t.overlord == null);
}

function maxRealm(g: Game) {
  return Math.max(2, Math.ceil(g.towns.length * 0.45));
}

/** «Честолюбцы»: гарантируют появление 1–2 сильных государств к 30–50 дню */
function ambitious(g: Game, rs: Town[]): Set<number> {
  const day = dayNo(g);
  const out = new Set<number>();
  const realms = rs.filter((r) => realmMembers(g, r).length >= 2);
  const want = day >= 26 ? 2 : day >= 13 ? 1 : 0;
  if (realms.length >= want || rs.length < 3) return out;
  const cand = rs
    .filter((r) => realmMembers(g, r).length < 2 && rs.some((o) => o.id !== r.id && sameZone(g, r, o)))
    .sort((a, b) => realmPower(g, b) - realmPower(g, a));
  if (cand[0]) out.add(cand[0].id);
  return out;
}

function declareWar(g: Game, a: Town, d: Town, ally = false) {
  const X = g.ext;
  X.rel.push({ a: a.id, b: d.id, kind: 'war', since: g.time, battles: 0, cd: rnd(6, 20) });
  X.cnt.aiWars++;
  const ra = rootOf(g, a);
  const rd = rootOf(g, d);
  const text = ally ? `«${a.name}» вступает в войну против «${d.name}» как союзник` : `«${ra.name}» объявило войну «${rd.name}»`;
  news(g, text, 'info', nearPlayer(g, a, d), 'war');
}

function tickWars(g: Game, dt: number) {
  const X = g.ext;
  const amb = ambitious(g, roots(g));
  for (let i = X.rel.length - 1; i >= 0; i--) {
    const r = X.rel[i];
    const a = townById(g, r.a);
    const b = townById(g, r.b);
    if (!a || !b || a.owner !== 'free' || b.owner !== 'free') {
      X.rel.splice(i, 1);
      continue;
    }
    if (r.kind === 'ally') {
      // сильный союзник может предать слабого, иначе союз со временем распадается
      const pa = realmPower(g, rootOf(g, a));
      const pb = realmPower(g, rootOf(g, b));
      const strong = pa >= pb ? a : b;
      const weak = pa >= pb ? b : a;
      const ratio = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
      if (ratio > 2.2 && Math.random() < 0.05 * (dt / 12) && sameZone(g, strong, weak) && (strong.aggr > 0.4 || amb.has(strong.id))) {
        X.rel.splice(i, 1);
        X.rel.push({ a: strong.id, b: weak.id, kind: 'war', since: g.time, battles: 0, cd: 5 });
        news(g, `«${strong.name}» предало союзника — война с «${weak.name}»`, 'warn', nearPlayer(g, strong, weak), 'war');
      } else if (g.time - r.since > 2700 && Math.random() < 0.02 * (dt / 12)) {
        X.rel.splice(i, 1);
        news(g, `Союз «${a.name}» и «${b.name}» распался`, 'info', false, 'peace');
      }
      continue;
    }
    // война
    const atk = a;
    const def = b;
    r.cd -= dt;
    if (r.cd > 0) continue;
    r.cd = rnd(42, 78);
    if (rootOf(g, atk).id === rootOf(g, def).id) {
      X.rel.splice(i, 1);
      continue;
    }
    const n = Math.min(Math.floor(strike(atk) * 0.65), Math.floor(atk.soldiers + 1));
    if (n < 2 || X.rivalMarches.some((m) => m.from === atk.id && m.to === def.id)) continue;
    atk.soldiers = Math.max(0, atk.soldiers - n);
    const d = dist(atk, def);
    X.rivalMarches.push({ id: g.nextId++, from: atk.id, to: def.id, n, t: 0, dur: Math.max(12, d * 1.1), sx: atk.x, sy: atk.y, tx: def.x, ty: def.y });
  }
}

function endWars(g: Game) {
  const X = g.ext;
  for (let i = X.rel.length - 1; i >= 0; i--) {
    const r = X.rel[i];
    if (r.kind !== 'war') continue;
    const a = townById(g, r.a);
    const b = townById(g, r.b);
    if (!a || !b) continue;
    const tired = r.battles >= 3 + (r.since % 3) || g.time - r.since > 1500 || (strike(a) < 2 && strike(b) < 2);
    if (tired && !X.rivalMarches.some((m) => (m.from === a.id && m.to === b.id) || (m.from === b.id && m.to === a.id))) {
      X.rel.splice(i, 1);
      X.truce[key(a.id, b.id)] = g.time + rnd(900, 1800);
      news(g, `«${a.name}» и «${b.name}» заключили перемирие`, 'info', nearPlayer(g, a, b), 'peace');
    }
  }
}

function considerWars(g: Game) {
  const X = g.ext;
  const rs = roots(g);
  const amb = ambitious(g, rs);
  for (const A of rs) {
    const atWar = X.rel.filter((r) => r.kind === 'war' && (r.a === A.id || r.b === A.id)).length;
    const totalWars = X.rel.filter((r) => r.kind === 'war').length;
    const isAmb = amb.has(A.id);
    if (atWar >= (isAmb ? 2 : 1) || strike(A) < 3 || totalWars >= Math.max(2, Math.floor(rs.length / 2) + (isAmb ? 1 : 0))) continue;
    const p = 0.006 + A.aggr * 0.02 + (A.spec === 'warrior' ? 0.012 : 0) + (isAmb ? 0.3 : 0);
    if (Math.random() > p) continue;
    const powA = realmPower(g, A);
    let best: Town | null = null;
    let bs = 0;
    for (const B of rs) {
      if (B.id === A.id || relOf(g, A.id, B.id) || (X.truce[key(A.id, B.id)] ?? 0) > g.time) continue;
      if (!sameZone(g, A, B) || dist(A, B) > 70) continue;
      const ratio = powA / Math.max(1, realmPower(g, B));
      if (ratio < (isAmb ? 0.9 : 0.8)) continue;
      const sc = ratio * rnd(0.8, 1.2) / (1 + dist(A, B) / 60);
      if (sc > bs) {
        bs = sc;
        best = B;
      }
    }
    if (!best) continue;
    declareWar(g, A, best);
    // союзники присоединяются
    for (const ally of allies(g, A)) {
      if (ally.id === best.id || relOf(g, ally.id, best.id) || !sameZone(g, ally, best) || Math.random() > 0.45) continue;
      if (relOf(g, ally.id, best.id, 'ally')) continue;
      declareWar(g, ally, best, true);
    }
  }
}

function considerAlliances(g: Game) {
  const X = g.ext;
  const rs = roots(g);
  if (rs.length < 2) return;
  const A = rs[Math.floor(Math.random() * rs.length)];
  if (allies(g, A).length >= 2) return;
  const warsOf = (t: Town) => new Set(X.rel.filter((r) => r.kind === 'war' && (r.a === t.id || r.b === t.id)).map((r) => (r.a === t.id ? r.b : r.a)));
  const wa = warsOf(A);
  for (const B of rs) {
    if (B.id === A.id || relOf(g, A.id, B.id) || allies(g, B).length >= 2 || !sameZone(g, A, B) || dist(A, B) > 60) continue;
    if ((X.truce[key(A.id, B.id)] ?? 0) > g.time) continue;
    const wb = warsOf(B);
    let common = false;
    for (const c of wa) if (wb.has(c)) common = true;
    const p = 0.1 + (common ? 0.45 : 0) + (B.aggr < 0.4 && A.aggr < 0.5 ? 0.12 : 0);
    if (Math.random() > p) continue;
    X.rel.push({ a: A.id, b: B.id, kind: 'ally', since: g.time, battles: 0, cd: 0 });
    X.cnt.aiAlliances++;
    news(g, `«${A.name}» и «${B.name}» заключили союз`, 'info', nearPlayer(g, A, B), 'peace');
    return;
  }
}

/* ───────────── Сражения и поглощение ───────────── */

function absorb(g: Game, A: Town, D: Town) {
  const X = g.ext;
  const rootA = rootOf(g, A);
  const hadRealm = realmMembers(g, rootA).length >= 2;
  D.overlord = rootA.id;
  rootA.pop += D.pop * 0.12;
  rootA.soldiers += Math.floor(D.soldiers * 0.5) + 2;
  rootA.stock.gold += D.stock.gold * 0.5;
  D.soldiers = 0;
  D.attitude = clamp(D.attitude - 10, 0, 100);
  X.rel = X.rel.filter((r) => r.a !== D.id && r.b !== D.id);
  X.rivalMarches = X.rivalMarches.filter((m) => m.from !== D.id && m.to !== D.id);
  X.cnt.absorbed++;
  const size = realmMembers(g, rootA).length;
  news(g, `«${rootA.name}» поглотило «${D.name}»${hadRealm ? ` — держава растёт (${size} селений)` : ' — на карте возникла новая Держава'}`, 'warn', true, 'war');
  g.sfx('horn');
}

function resolveBattle(g: Game, m: { from: number; to: number; n: number }) {
  const A = townById(g, m.from);
  const D = townById(g, m.to);
  if (!A || !D) return;
  if (A.owner !== 'free') return;
  if (D.owner !== 'free' || rootOf(g, A).id === rootOf(g, D).id) {
    A.soldiers += m.n;
    return;
  }
  const X = g.ext;
  const amb = ambitious(g, roots(g)).has(rootOf(g, A).id);
  const rootA = rootOf(g, A);
  const att = m.n * (1 + 0.1 * A.tier) * (A.spec === 'warrior' ? 1.25 : 1) * (A.spec === 'smith' ? 1.1 : 1) * (amb ? 1.9 : 1) * (1 + 0.05 * (realmMembers(g, rootA).length - 1)) * rnd(0.85, 1.15);
  let def = townDef(D) * rnd(0.85, 1.15);
  for (const al of allies(g, D)) if (sameZone(g, al, D)) def += townDef(al) * 0.35;
  const r = att / Math.max(0.1, def);
  const win = r > 1;
  const rel = relOf(g, A.id, D.id, 'war');
  if (rel) rel.battles++;
  const nearP = nearPlayer(g, A, D);
  if (win) {
    const lossFrac = clamp(0.5 / r, 0.08, 0.6);
    A.soldiers += Math.round(m.n * (1 - lossFrac));
    D.soldiers = Math.max(0, D.soldiers * 0.3 - 1);
    D.pop = Math.max(5, D.pop * 0.88);
    const loot = { gold: D.stock.gold * 0.4, food: D.stock.food * 0.4 };
    D.stock.gold -= loot.gold;
    D.stock.food -= loot.food;
    A.stock.gold += loot.gold;
    A.stock.food += loot.food;
    D.razedT = Math.max(D.razedT, 120);
    const slots = realmMembers(g, rootA).length + realmMembers(g, rootOf(g, D)).length;
    const gate = dayNo(g) >= 14 + 6 * X.cnt.absorbed;
    const canAbsorb = slots <= maxRealm(g) && (gate || amb);
    const p = amb ? 1 : clamp(0.2 + (r - 1.3) * 0.5, 0, 0.8);
    const weak = D.soldiers < 4 || r > 1.5;
    if (canAbsorb && weak && Math.random() < p) absorb(g, A, D);
    else news(g, `«${A.name}» разбило войско «${D.name}»`, 'info', nearP, 'war');
  } else {
    const lossFrac = clamp(0.6 + 0.2 * (1 / r - 1), 0.6, 1);
    A.soldiers += Math.round(m.n * (1 - lossFrac));
    D.soldiers = Math.max(0, D.soldiers * 0.8);
    news(g, `«${D.name}» отбило нападение «${A.name}»`, 'info', nearP, 'war');
  }
  // дым над сражением
  for (let i = 0; i < 14; i++) g.particles.push({ x: (D.x + (Math.random() - 0.5) * 5) * TW, y: (D.y + (Math.random() - 0.5) * 3) * TH, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 8, life: 1.3, max: 1.3, color: Math.random() < 0.5 ? '#ff7a2a' : '#555560', size: 2, grav: 0 });
  void X;
}

/* ───────────── Главный цикл ───────────── */

export function updateRivals(g: Game, dt: number) {
  const X = g.ext;
  if (g.mode !== 'play' || !g.towns.length) return;
  const sp = marchSpeedK(g);
  const arrived: typeof X.rivalMarches = [];
  for (const m of X.rivalMarches) {
    m.t += dt * sp;
    if (m.t >= m.dur) arrived.push(m);
  }
  if (arrived.length) {
    X.rivalMarches = X.rivalMarches.filter((m) => !arrived.includes(m));
    for (const m of arrived) resolveBattle(g, m);
  }
  if (g.time < RIVAL_GRACE) return;
  X.rivalT -= dt;
  if (X.rivalT > 0) return;
  const tick = rnd(9, 15);
  X.rivalT = tick;
  // честолюбцы быстрее копят войска
  for (const id of ambitious(g, roots(g))) {
    const t = townById(g, id);
    if (t) t.soldiers = Math.min(t.pop * 0.5, t.soldiers + t.pop * 0.0035 * tick);
  }
  for (const r of X.rel) {
    if (r.kind !== 'war') continue;
    for (const id of [r.a, r.b]) {
      const t = townById(g, id);
      if (t && t.owner === 'free') t.soldiers = Math.min(t.pop * 0.35, t.soldiers + t.pop * 0.0012 * tick);
    }
  }
  tickWars(g, tick);
  endWars(g);
  considerWars(g);
  X.allyT -= tick;
  if (X.allyT <= 0) {
    X.allyT = rnd(25, 50);
    considerAlliances(g);
  }
}

/* ───────────── Снимок для интерфейса ───────────── */

export interface RealmView {
  rootId: number;
  name: string;
  members: string[];
  pop: number;
  soldiers: number;
  power: number;
  strong: boolean;
}

export function rivalSnapshot(g: Game) {
  const X = g.ext;
  const realms: RealmView[] = [];
  for (const r of roots(g)) {
    const ms = realmMembers(g, r);
    realms.push({ rootId: r.id, name: r.name, members: ms.filter((m) => m.id !== r.id).map((m) => m.name), pop: Math.floor(ms.reduce((a, m) => a + m.pop, 0)), soldiers: Math.floor(ms.reduce((a, m) => a + m.soldiers, 0)), power: Math.round(realmPower(g, r)), strong: ms.length >= 2 });
  }
  realms.sort((a, b) => b.power - a.power);
  const nm = (id: number) => townById(g, id)?.name ?? '?';
  return {
    realms,
    wars: X.rel.filter((r) => r.kind === 'war').map((r) => ({ a: nm(r.a), b: nm(r.b), battles: r.battles })),
    allies: X.rel.filter((r) => r.kind === 'ally').map((r) => ({ a: nm(r.a), b: nm(r.b) })),
    marches: X.rivalMarches.length,
  };
}

import { B, TH, TW } from './data';
import type { Game, Unit } from './game';
import { chron, dayNo, emptyCargo, type Ambush, type Cargo, type Caravan } from './extstate';
import { iceLinked, marchSpeedK, seasonInfo } from './seasons';
import { DIFFS, isStateOwner } from './social';
import { killPerson, lifeArmyPower, restoreGuards, takeGuards } from './life';
import type { March } from './towns';

/* ───────────── Физические торговые караваны ─────────────
   Раз в игровой день из каждой провинции выезжает повозка с налогами и
   ресурсами в столицу. Лесные разбойники и враги могут ограбить её. */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const BASE_SPEED = 2.7;
const AMBUSH_TIME = 3.6;

const cargoSum = (c: Cargo) => c.gold + c.food + c.wood + c.stone + c.goods;
export const cargoValue = (c: Cargo) => Math.round(c.gold + (c.food + c.wood + c.stone) * 0.5 + c.goods * 1.4);

export function capitalSpot(g: Game): { x: number; y: number; name: string; townId: number | null } {
  const cap = g.soc.capital != null ? g.towns.find((t) => t.id === g.soc.capital && t.owner === 'player') : null;
  if (cap) return { x: cap.x, y: cap.y + 2, name: cap.name, townId: cap.id };
  const camp = g.buildings[0];
  return { x: camp ? camp.x + 1 : 0, y: camp ? camp.y + 3 : 0, name: g.name, townId: null };
}

export function setEscort(g: Game, townId: number, n: number) {
  const t = g.towns.find((q) => q.id === townId);
  if (!t || t.owner !== 'player') return;
  t.escort = Math.max(0, Math.min(3, n));
  g.emit(true);
}

function logC(g: Game, text: string, ok: boolean) {
  const L = g.ext.caravanLog;
  L.unshift({ t: g.time, text, ok });
  if (L.length > 14) L.length = 14;
}

/* ───────────── Отправка ───────────── */

function mkEscortUnits(members: Unit[], x: number, y: number) {
  members.forEach((u, i) => {
    u.x = x + (i % 2 ? 0.8 : -0.8);
    u.y = y + 0.4 + i * 0.25;
    u.path = [];
    u.sel = false;
    u.sleeping = false;
  });
}

function spawnOne(g: Game, t: (typeof g.towns)[number]) {
  const X = g.ext;
  const cargo = t.cargo;
  if (!cargo || cargoSum(cargo) < 3) return;
  const dest = capitalSpot(g);
  if (dest.townId === t.id) return;
  const start = g.freeTilesNear(t.x, t.y + 3, 1)[0];
  const end = g.freeTilesNear(Math.floor(dest.x), Math.floor(dest.y), 1)[0];
  const load: Cargo = { ...cargo };
  t.cargo = emptyCargo();

  // охрана — воины из гарнизона
  let members: Unit[] = [];
  const want = Math.min(t.escort ?? 0, g.army);
  if (want > 0) {
    g.army -= want;
    members = takeGuards(g, want);
  }

  const camp = g.buildings[0];
  const sameLand = camp && g.world.landId[(camp.y + 1) * g.world.w + camp.x + 1] === t.land;
  let path: { x: number; y: number }[] | null = null;
  if (start && end && (sameLand || iceLinked(g, t.x, t.y, dest.x, dest.y))) {
    path = g.pf.find(g.world.blocked, start.x, start.y, (x, y) => Math.hypot(x - end.x, y - end.y) < 1.5, end.x, end.y, false, 14000);
  }
  const c: Caravan = {
    id: g.nextId++,
    from: t.id,
    fromName: t.name,
    path: path ?? [],
    pi: 0,
    x: (start?.x ?? t.x) + 0.5,
    y: (start?.y ?? t.y) + 0.5,
    sx: t.x + 0.5,
    sy: t.y + 2.5,
    tx: dest.x + 0.5,
    ty: dest.y + 0.5,
    sea: !path,
    seaT: 0,
    seaDur: Math.max(10, Math.hypot(t.x - dest.x, t.y - dest.y) * 1.25),
    cargo: load,
    members,
    escort: members.length,
    state: 'go',
    dir: 2,
    risk: 0,
    ambush: null,
  };
  mkEscortUnits(members, c.x, c.y);
  X.caravans.push(c);
  g.sfx('cart', c.x * TW, c.y * TH);
}

export function spawnCaravans(g: Game) {
  for (const t of g.towns) if (t.owner === 'player') spawnOne(g, t);
}

/* ───────────── Опасность на дороге ───────────── */

function terrOwner(g: Game, tx: number, ty: number) {
  const T = g.terr;
  if (!T || tx < 0 || ty < 0 || tx >= T.w || ty >= T.h) return 0;
  return T.owner[ty * T.w + tx];
}

function threatAt(g: Game, c: Caravan): { forest: number; enemy: number; raid: number } {
  const tx = Math.floor(c.x);
  const ty = Math.floor(c.y);
  const b = g.world.biome[ty * g.world.w + tx];
  let forest = 0;
  if (b === B.DARK || b === B.TAIGA) forest = 1;
  else if (b === B.OAK || b === B.BIRCH || b === B.AUTUMN) forest = 0.55;
  let enemy = 0;
  const o = terrOwner(g, tx, ty);
  if (o >= 2 && !isStateOwner(g, o)) {
    const town = g.towns[o - 2];
    if (town && town.owner === 'free' && town.attitude < 40) enemy = 1;
  }
  let raid = 0;
  for (const m of g.marches) {
    if (!m.incoming) continue;
    const k = Math.min(1, m.t / m.dur);
    const mx = m.sx + (m.tx - m.sx) * k;
    const my = m.sy + (m.ty - m.sy) * k;
    if (Math.hypot(mx - c.x, my - c.y) < 7) raid = 1;
  }
  return { forest, enemy, raid };
}

function startAmbush(g: Game, c: Caravan, kind: 'bandit' | 'enemy') {
  const n = 2 + Math.floor(g.time / 2700) + (Math.random() < 0.5 ? 1 : 0) + (kind === 'enemy' ? 1 : 0);
  const spots = g.freeTilesNear(Math.floor(c.x), Math.floor(c.y), n + 2);
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const s = spots[(i + 1) % Math.max(1, spots.length)] ?? { x: Math.floor(c.x), y: Math.floor(c.y) };
    const u = g.newUnit(s.x + 0.5, s.y + 0.5, false);
    u.role = 'bandit';
    u.look = { skin: 1, hair: 0, cloth: kind === 'enemy' ? 3 : 0, female: false, style: 0, outfit: 0, beard: true, acc: 1 };
    u.name = kind === 'enemy' ? 'Вражеский воин' : 'Лесной разбойник';
    u.dir = s.x + 0.5 < c.x ? 2 : 3;
    u.fx = u.dir;
    units.push(u);
  }
  const a: Ambush = { kind, n, t: 0, units, resolved: false, won: false };
  c.ambush = a;
  c.state = 'ambush';
  const where = kind === 'enemy' ? 'вражеский отряд' : 'лесные разбойники';
  g.msg(`⚠ Караван из «${c.fromName}» попал в засаду: ${where}! ${c.members.length ? `Охрана: ${c.members.length}` : 'Охраны нет!'}`, 'warn');
  g.sfx('alarm', c.x * TW, c.y * TH);
}

function nearbyGuards(g: Game, c: Caravan): number {
  let n = 0;
  for (const u of g.guards) if (!u.sleeping && Math.hypot(u.x - c.x, u.y - c.y) < 9) n++;
  return n;
}

function finishAmbush(g: Game, c: Caravan) {
  const X = g.ext;
  const a = c.ambush!;
  const near = nearbyGuards(g, c);
  const D = lifeArmyPower(g, c.members.length + near * 0.8) * Math.sqrt(g.mods.def);
  const A = a.n * (a.kind === 'enemy' ? 1.35 : 1) * (1 + g.time / 9000) * rnd(0.8, 1.2);
  a.resolved = true;
  a.t = 0;
  if (D >= A && D > 0) {
    a.won = true;
    X.cnt.banditsKilled += a.n;
    g.life.kills += a.n;
    const bounty = a.n * 5;
    g.gain('gold', bounty);
    const lose = D < A * 1.5 && c.members.length > 1 ? 1 : 0;
    for (let i = 0; i < lose; i++) {
      const u = c.members.pop();
      if (u) killPerson(g, u, 'пал, защищая караван', true);
    }
    g.msg(`Караван из «${c.fromName}» отбился от ${a.kind === 'enemy' ? 'врагов' : 'разбойников'}! Награда ${bounty}🪙${lose ? ', один воин погиб' : ''}`, 'good');
    logC(g, `Караван из «${c.fromName}» отбил засаду`, true);
    g.sfx('victory', c.x * TW, c.y * TH);
    c.state = 'go';
  } else {
    a.won = false;
    X.cnt.caravansLost++;
    const lost = cargoValue(c.cargo);
    const keep = Math.round(c.members.length * 0.3);
    while (c.members.length > keep) {
      const u = c.members.pop();
      if (u) killPerson(g, u, 'погиб при нападении на караван', true);
    }
    g.msg(`Караван из «${c.fromName}» ограблен! Потеряно груза на ~${lost}🪙${c.escort === 0 ? '. Отправьте охрану: вкладка «Караваны» [P]' : ''}`, 'warn');
    chron(g, `Ограблен караван из «${c.fromName}» (${a.kind === 'enemy' ? 'враги' : 'лесные разбойники'}): потеряно ~${lost} золота`, 'warn');
    logC(g, `Караван из «${c.fromName}» разграблен: −${lost}🪙`, false);
    g.sfx('defeat', c.x * TW, c.y * TH);
  }
}

/* ───────────── Приезд и возврат охраны ───────────── */

function returnEscort(g: Game, c: Caravan) {
  if (c.members.length) {
    g.army += c.members.length;
    restoreGuards(g, { members: c.members } as unknown as March, c.members.length);
    c.members = [];
  }
}

function deliver(g: Game, c: Caravan) {
  const X = g.ext;
  const k = c.cargo;
  g.gain('gold', k.gold);
  g.gain('food', k.food);
  g.gain('wood', k.wood);
  g.gain('stone', k.stone);
  g.gain('goods', k.goods);
  g.stats.wood += k.wood;
  g.stats.stone += k.stone;
  g.stats.food += k.food;
  X.cnt.caravansDone++;
  X.cnt.goldDelivered += k.gold;
  const cap = capitalSpot(g);
  const parts = [k.gold >= 1 ? `${Math.round(k.gold)}🪙` : '', k.food >= 1 ? `${Math.round(k.food)}🍖` : '', k.wood >= 1 ? `${Math.round(k.wood)}🪵` : '', k.stone >= 1 ? `${Math.round(k.stone)}🪨` : '', k.goods >= 1 ? `${Math.round(k.goods)}📦` : ''].filter(Boolean);
  g.floatText(cap.x * TW + 8, cap.y * TH - 10, `🐎 ${parts.join(' ')}`, '#ffe9a8');
  g.sfx('coin', cap.x * TW, cap.y * TH);
  logC(g, `Караван из «${c.fromName}» прибыл: ${parts.join(' ')}`, true);
  returnEscort(g, c);
}

/* ───────────── Цикл ───────────── */

export function updateCaravans(g: Game, dt: number) {
  const X = g.ext;
  if (g.mode !== 'play') return;
  const day = dayNo(g);
  if (day !== X.caravanDay) {
    X.caravanDay = day;
    spawnCaravans(g);
  }
  const D = DIFFS[g.diff];
  const speed = BASE_SPEED * marchSpeedK(g) * g.mods.speed;
  for (let i = X.caravans.length - 1; i >= 0; i--) {
    const c = X.caravans[i];
    // морской/абстрактный караван
    if (c.sea) {
      c.seaT += dt * marchSpeedK(g);
      const k = Math.min(1, c.seaT / c.seaDur);
      c.x = c.sx + (c.tx - c.sx) * k;
      c.y = c.sy + (c.ty - c.sy) * k;
      c.dir = c.tx >= c.sx ? 2 : 3;
      if (k >= 1) {
        deliver(g, c);
        X.caravans.splice(i, 1);
      }
      continue;
    }
    // засада
    if (c.state === 'ambush' && c.ambush) {
      const a = c.ambush;
      a.t += dt;
      for (const u of a.units) {
        u.phase = 'work';
        u.moving = false;
        u.swing += dt * 1.6;
      }
      for (const u of c.members) {
        u.phase = 'work';
        u.moving = false;
        u.swing += dt * 1.6;
        u.fx = c.dir;
        u.dir = c.dir;
      }
      if (!a.resolved && a.t >= AMBUSH_TIME) finishAmbush(g, c);
      else if (a.resolved && a.t >= 2.2) {
        if (a.won) {
          c.ambush = null;
          c.state = 'go';
          for (const u of c.members) u.phase = 'goto';
        } else {
          for (const u of c.members) returnEscortUnit(g, u);
          c.members = [];
          X.caravans.splice(i, 1);
        }
      }
      continue;
    }
    // движение по дороге
    let left = speed * dt;
    while (left > 0 && c.pi < c.path.length) {
      const n = c.path[c.pi];
      if (g.world.blocked[n.y * g.world.w + n.x] && c.pi < c.path.length - 1) {
        // путь перекрыт стройкой — перепрокладываем
        const end = c.path[c.path.length - 1];
        const np = g.pf.find(g.world.blocked, Math.floor(c.x), Math.floor(c.y), (x, y) => Math.hypot(x - end.x, y - end.y) < 1.5, end.x, end.y, true, 9000);
        if (np && np.length) {
          c.path = np;
          c.pi = 0;
          continue;
        }
        c.pi = c.path.length;
        break;
      }
      const dx = n.x + 0.5 - c.x;
      const dy = n.y + 0.5 - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.001) {
        c.pi++;
        continue;
      }
      if (Math.abs(dx) > 0.05) c.dir = dx > 0 ? 2 : 3;
      const st = Math.min(left, d);
      c.x += (dx / d) * st;
      c.y += (dy / d) * st;
      left -= st;
      if (st >= d - 1e-6) c.pi++;
    }
    // охрана идёт рядом
    c.members.forEach((u, k) => {
      const tx = c.x + (k % 2 ? 0.9 : -0.9) - (c.dir === 2 ? 0.7 : -0.7);
      const ty = c.y + 0.35 + k * 0.22;
      u.x += (tx - u.x) * Math.min(1, dt * 6);
      u.y += (ty - u.y) * Math.min(1, dt * 6);
      u.moving = true;
      u.phase = 'goto';
      u.dir = c.dir;
      u.fx = c.dir;
      u.anim += dt * 5.5;
    });
    // угрозы: лес, враждебные земли, набеги
    c.risk -= dt;
    if (c.risk <= 0 && dayNo(g) >= 3 && !g.dev.noRaids) {
      c.risk = 0.5;
      const th = threatAt(g, c);
      const scale = (1 + Math.min(1.5, g.time / 5400)) / Math.max(0.5, D.raid);
      const winterK = seasonInfo(g).winter ? 0.7 : 1;
      const rate = (th.forest * 0.02 + th.enemy * 0.03 + th.raid * 0.12) * scale * winterK;
      if (Math.random() < rate * 0.5) startAmbush(g, c, th.enemy + th.raid > th.forest * 0.6 ? 'enemy' : 'bandit');
    }
    if (c.pi >= c.path.length) {
      deliver(g, c);
      X.caravans.splice(i, 1);
    }
  }
}

function returnEscortUnit(g: Game, u: Unit) {
  g.army += 1;
  restoreGuards(g, { members: [u] } as unknown as March, 1);
}

/* ───────────── Для отрисовки и интерфейса ───────────── */

export function extUnits(g: Game): Unit[] {
  const out: Unit[] = [];
  for (const c of g.ext.caravans) {
    for (const u of c.members) out.push(u);
    if (c.ambush) for (const u of c.ambush.units) out.push(u);
  }
  return out;
}

export function caravanSnapshot(g: Game) {
  const X = g.ext;
  return {
    active: X.caravans.map((c) => ({
      id: c.id,
      from: c.fromName,
      progress: c.sea ? Math.min(1, c.seaT / c.seaDur) : c.path.length ? c.pi / c.path.length : 0,
      value: cargoValue(c.cargo),
      escort: c.members.length,
      sea: c.sea,
      ambush: c.state === 'ambush',
    })),
    log: X.caravanLog.slice(0, 8),
    dest: capitalSpot(g).name,
  };
}

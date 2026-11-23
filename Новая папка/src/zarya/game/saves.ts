import type { Game } from './game';
import { createExt } from './extstate';
import { Pathfinder } from './pathfinding';
import { computeTerritory } from './social';
import { renderMinimap, renderTerrain } from './terrain';
import { ensureSpecSprites } from './bsprites2';
import { seasonInfo } from './seasons';
import { TW, TH } from './data';
import { RANKS } from './meta';

/* ───────────── Сохранения: сериализация Game + IndexedDB ─────────────
   Автосейв и 3 ручных слота. Состояние пишется «как есть» универсальным
   сериализатором (Map/Set/типизированные массивы/общие ссылки). */

const FIELDS = [
  'world', 'trample', 'tut', 'units', 'buildings', 'regrow', 'marked', 'res', 'tax', 'prices', 'know', 'research', 'progress', 'done', 'stats',
  'time', 'dayT', 'speed', 'nextId', 'birthTimer', 'starveTimer', 'gameOver', 'questDone', 'name', 'spec', 'mapType', 'gov', 'stateFormed', 'needGov',
  'army', 'marches', 'towns', 'selTown', 'tierIdx', 'diff', 'soc', 'borderMode', 'life', 'guards', 'dev', 'costs', 'ext', 'capVal',
] as const;

const TA: Record<string, new (b: ArrayBuffer) => ArrayBufferView> = {
  Uint8Array, Uint8ClampedArray, Uint16Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array,
};

function u8ToB64(u8: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH) as unknown as number[]);
  return btoa(s);
}
function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

type Obj = Record<string, unknown>;

function countRefs(v: unknown, seen: Map<object, number>) {
  if (v === null || typeof v !== 'object') return;
  if (ArrayBuffer.isView(v)) return;
  const o = v as object;
  const c = seen.get(o);
  if (c !== undefined) {
    seen.set(o, c + 1);
    return;
  }
  seen.set(o, 1);
  if (Array.isArray(v)) for (const x of v) countRefs(x, seen);
  else if (v instanceof Map) {
    for (const [k, x] of v) {
      countRefs(k, seen);
      countRefs(x, seen);
    }
  } else if (v instanceof Set) for (const x of v) countRefs(x, seen);
  else for (const k of Object.keys(v as Obj)) countRefs((v as Obj)[k], seen);
}

interface EncState {
  counts: Map<object, number>;
  ids: Map<object, number>;
  n: number;
}

function enc(v: unknown, st: EncState): unknown {
  if (v === null) return null;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'number') return Number.isFinite(v as number) ? v : { $t: 'n', v: String(v) };
  if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
  if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return null;
  if (ArrayBuffer.isView(v)) {
    const a = v as unknown as { constructor: { name: string }; buffer: ArrayBuffer; byteOffset: number; byteLength: number };
    return { $t: 'ta', k: a.constructor.name, d: u8ToB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) };
  }
  const o = v as object;
  const shared = (st.counts.get(o) ?? 0) > 1;
  let id = 0;
  if (shared) {
    const have = st.ids.get(o);
    if (have !== undefined) return { $t: 'r', i: have };
    id = ++st.n;
    st.ids.set(o, id);
  }
  let out: unknown;
  if (Array.isArray(v)) {
    const e = v.map((x) => {
      const r = enc(x, st);
      return r === undefined ? null : r;
    });
    out = shared ? { $t: 'a', i: id, e } : e;
    return out;
  }
  if (v instanceof Map) return { $t: 'm', i: id, e: [...v].map(([k, x]) => [enc(k, st), enc(x, st)]) };
  if (v instanceof Set) return { $t: 's', i: id, e: [...v].map((x) => enc(x, st)) };
  const p: Obj = {};
  for (const k of Object.keys(v as Obj)) {
    const r = enc((v as Obj)[k], st);
    if (r !== undefined) p[k] = r;
  }
  return shared ? { $t: 'o', i: id, p } : p;
}

function dec(v: unknown, reg: Map<number, unknown>): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => dec(x, reg));
  const o = v as Obj;
  switch (o.$t) {
    case 'n':
      return Number(o.v);
    case 'ta': {
      const u8 = b64ToU8(o.d as string);
      const C = TA[o.k as string];
      return new C(u8.buffer as ArrayBuffer);
    }
    case 'r':
      return reg.get(o.i as number);
    case 'a': {
      const arr: unknown[] = [];
      reg.set(o.i as number, arr);
      for (const x of o.e as unknown[]) arr.push(dec(x, reg));
      return arr;
    }
    case 'm': {
      const m = new Map<unknown, unknown>();
      if (o.i) reg.set(o.i as number, m);
      for (const [k, x] of o.e as [unknown, unknown][]) m.set(dec(k, reg), dec(x, reg));
      return m;
    }
    case 's': {
      const s = new Set<unknown>();
      if (o.i) reg.set(o.i as number, s);
      for (const x of o.e as unknown[]) s.add(dec(x, reg));
      return s;
    }
    case 'o': {
      const r: Obj = {};
      reg.set(o.i as number, r);
      const p = o.p as Obj;
      for (const k of Object.keys(p)) r[k] = dec(p[k], reg);
      return r;
    }
    default: {
      const r: Obj = {};
      for (const k of Object.keys(o)) r[k] = dec(o[k], reg);
      return r;
    }
  }
}

export function serializeGame(g: Game): string {
  const src: Obj = {};
  const gg = g as unknown as Obj;
  for (const f of FIELDS) src[f] = gg[f];
  const w = { ...(g.world as unknown as Obj) };
  delete w.shore;
  src.world = w;
  const counts = new Map<object, number>();
  countRefs(src, counts);
  const st: EncState = { counts, ids: new Map(), n: 0 };
  return JSON.stringify({ v: 1, d: enc(src, st) });
}

export function applySave(g: Game, json: string) {
  const parsed = JSON.parse(json) as { v: number; d: unknown };
  const raw = dec(parsed.d, new Map()) as Obj;
  const gg = g as unknown as Obj;
  for (const f of FIELDS) if (raw[f] !== undefined) gg[f] = raw[f];
  if (!raw.ext) g.ext = createExt();
  const w = g.world;
  g.terrain = renderTerrain(w);
  g.minimap = renderMinimap(w);
  g.pf = new Pathfinder(w.w, w.h);
  g.pre = Array.from({ length: w.h }, () => []);
  g.post = Array.from({ length: w.h }, () => []);
  ensureSpecSprites(g.bspr, g.spec);
  g.particles = [];
  g.pings = [];
  g.msgs = [];
  g.bad.clear();
  g.fieldPulse.clear();
  g.prints = [];
  g.hoverBuilding = null;
  g.hoverObj = null;
  g.hoverUnit = null;
  g.hoverTown = null;
  g.selBuilding = null;
  g.tool = 'select';
  g.buildType = null;
  g.drag = null;
  g.panDrag = null;
  g.mode = 'play';
  g.paused = false;
  g.introT = 0;
  g.unpaid = false;
  g.starving = false;
  g.lowFoodWarned = false;
  g.accIn = {};
  g.accOut = {};
  g.rateIn = {};
  g.rateOut = {};
  g.terr = null;
  g.pre.forEach((r) => (r.length = 0));
  for (const u of g.units) u.sel = false;
  computeTerritory(g);
  g.refreshMods();
  const camp = g.buildings[0];
  if (camp) {
    g.cam.x = (camp.x + 1) * TW;
    g.cam.y = (camp.y + 2) * TH;
  }
  g.zoom = g.cw / g.dpr < 900 ? 2 : 3;
  g.emit(true);
}

/* ───────────── Хранилище ───────────── */

export const SLOT_IDS = ['auto', 's1', 's2', 's3'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export interface SaveMeta {
  id: string;
  name: string;
  day: number;
  season: string;
  pop: number;
  prov: number;
  spec: string;
  tier: string;
  diff: string;
  at: number;
  size: number;
}

const DB_NAME = 'zarya-saves';
let dbP: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbP) return dbP;
  dbP = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  dbP.catch(() => (dbP = null));
  return dbP;
}

function idbPut(store: string, key: string, val: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(val, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      }),
  );
}
function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((res, rej) => {
        const rq = db.transaction(store).objectStore(store).get(key);
        rq.onsuccess = () => res(rq.result as T | undefined);
        rq.onerror = () => rej(rq.error);
      }),
  );
}
function idbDel(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }),
  );
}

async function gzip(s: string): Promise<ArrayBuffer | string> {
  try {
    if (typeof CompressionStream === 'undefined') return s;
    const stream = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).arrayBuffer();
  } catch {
    return s;
  }
}
async function gunzip(d: ArrayBuffer | string): Promise<string> {
  if (typeof d === 'string') return d;
  const stream = new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

const LS = 'zarya_save_';

export function makeMeta(g: Game, id: string, size: number): SaveMeta {
  const s = seasonInfo(g);
  return {
    id,
    name: g.name,
    day: Math.floor(g.time / 180) + 1,
    season: `${s.def.icon} ${s.def.name}, год ${s.year}`,
    pop: g.totalPop(),
    prov: g.towns.filter((t) => t.owner === 'player').length,
    spec: g.spec,
    tier: RANKS[g.tierIdx].name,
    diff: g.diff,
    at: Date.now(),
    size,
  };
}

export async function saveGame(g: Game, id: string): Promise<SaveMeta> {
  const json = serializeGame(g);
  const data = await gzip(json);
  const size = typeof data === 'string' ? data.length : data.byteLength;
  const meta = makeMeta(g, id, size);
  try {
    await idbPut('data', id, data);
    await idbPut('meta', id, meta);
  } catch {
    // запасной вариант: localStorage (если лимит позволяет)
    try {
      localStorage.setItem(LS + id, json);
      localStorage.setItem(LS + id + '_meta', JSON.stringify(meta));
    } catch {
      throw new Error('Не удалось сохранить: нет места в хранилище браузера');
    }
  }
  return meta;
}

export async function listSaves(): Promise<Record<string, SaveMeta>> {
  const out: Record<string, SaveMeta> = {};
  for (const id of SLOT_IDS) {
    let m: SaveMeta | undefined;
    try {
      m = await idbGet<SaveMeta>('meta', id);
    } catch {
      /* idb недоступен */
    }
    if (!m) {
      try {
        const r = localStorage.getItem(LS + id + '_meta');
        if (r) m = JSON.parse(r) as SaveMeta;
      } catch {
        /* ignore */
      }
    }
    if (m) out[id] = m;
  }
  return out;
}

export async function loadGame(g: Game, id: string): Promise<boolean> {
  let json: string | null = null;
  try {
    const d = await idbGet<ArrayBuffer | string>('data', id);
    if (d) json = await gunzip(d);
  } catch {
    /* ignore */
  }
  if (!json) {
    try {
      json = localStorage.getItem(LS + id);
    } catch {
      /* ignore */
    }
  }
  if (!json) return false;
  applySave(g, json);
  return true;
}

export async function deleteSave(id: string) {
  try {
    await idbDel('data', id);
    await idbDel('meta', id);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS + id);
    localStorage.removeItem(LS + id + '_meta');
  } catch {
    /* ignore */
  }
}

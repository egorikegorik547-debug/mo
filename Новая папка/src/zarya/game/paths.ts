/** Живые тропинки: где жители ходят чаще всего, трава вытаптывается в землю, а после «Мощёных дорог» — в брусчатку. */
import { B, TH, TW } from './data';
import type { Game, Unit } from './game';
import { hash2 } from './rng';
import { mk, type Cv } from './sprites';

export const PATH_T1 = 3; // примятая трава
export const PATH_T2 = 7; // земляная тропа
export const PATH_T3 = 15; // мощёная дорога (нужна технология)

export function pathStage(g: Game, v: number): number {
  if (v >= PATH_T3 && g.done.has('roads')) return 3;
  if (v >= PATH_T2) return 2;
  if (v >= PATH_T1) return 1;
  return 0;
}

export function ensureTrample(g: Game) {
  const n = g.world.w * g.world.h;
  if (!g.trample || g.trample.length !== n) g.trample = new Float32Array(n);
}

/** Жители вытаптывают клетку, по которой идут. */
export function trampleStep(g: Game, u: Unit, dt: number) {
  if (!u.moving || u.sleeping) return;
  const w = g.world;
  const x = Math.floor(u.x);
  const y = Math.floor(u.y);
  if (x < 1 || y < 1 || x >= w.w - 1 || y >= w.h - 1) return;
  const i = y * w.w + x;
  const b = w.biome[i];
  if (b < B.STEPPE) return; // песок и вода тропу не держат
  if (w.cliff[i] === 2) return;
  const o = w.objs[i];
  if (o && o.kind !== 'stump') return;
  const t = g.trample[i];
  // чем туже тропа, тем медленнее растёт — но мощёной дорогой она становится только при высоком значении
  g.trample[i] = Math.min(60, t + dt * 0.95);
}

let decayT = 0;
export function decayPaths(g: Game, dt: number) {
  decayT += dt;
  if (decayT < 4) return;
  decayT = 0;
  const a = g.trample;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v <= 0) continue;
    if (v >= PATH_T3) continue; // вытоптанное навсегда
    a[i] = Math.max(0, v - 0.1);
  }
}

/* ---------- кэш плиток ---------- */

const cache = new Map<string, Cv>();

const DIRT = ['#6a4c2c', '#7a5a36', '#8a6a42', '#9c7c50', '#b0905e'];
const DIRT_COOL = '#4a3a3c';
const COB = ['#4e5062', '#6c6f80', '#8a8d9e', '#a8abbb', '#c4c7d4'];

function tile(stage: number, mask: number, variant: number, wet: boolean): Cv {
  const key = `${stage}|${mask}|${variant}|${wet ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = mk(TW, TH);
  const g = c.getContext('2d')!;
  const R = stage === 1 ? 2.6 : stage === 2 ? 4.4 : 7.4;
  const cx = TW / 2 - 0.5;
  const cy = TH / 2 - 0.5;
  const segDist = (px: number, py: number, x1: number, y1: number) => {
    const ex = x1 - cx;
    const ey = y1 - cy;
    const l2 = ex * ex + ey * ey || 1;
    let t = ((px - cx) * ex + (py - cy) * ey) / l2;
    t = Math.max(0, Math.min(1, t));
    const dx = px - (cx + ex * t);
    const dy = (py - (cy + ey * t)) * 1.33;
    return Math.hypot(dx, dy);
  };
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      let d = Math.hypot(x - cx, (y - cy) * 1.33);
      if (mask & 1) d = Math.min(d, segDist(x, y, cx, 0));
      if (mask & 2) d = Math.min(d, segDist(x, y, TW - 1, cy));
      if (mask & 4) d = Math.min(d, segDist(x, y, cx, TH - 1));
      if (mask & 8) d = Math.min(d, segDist(x, y, 0, cy));
      const hz = hash2(x + variant * 31, y, 901);
      const rr = d + (hz - 0.5) * 2.2;
      if (rr > R) continue;
      const edge = rr > R - 1.1;
      if (stage === 1) {
        // примятая трава: редкие земляные пятна
        if (hz < 0.55) {
          g.fillStyle = hz < 0.2 ? DIRT[1] : DIRT[2];
          g.fillRect(x, y, 1, 1);
        } else if (hz < 0.7) {
          g.fillStyle = '#5e9a3c';
          g.fillRect(x, y, 1, 1);
        }
      } else if (stage === 2) {
        let k = 2;
        if (edge) k = 1;
        else if (hz > 0.86) k = 3;
        else if (hz < 0.12) k = 1;
        // сырая земля под дождём темнее
        g.fillStyle = wet ? DIRT_COOL : DIRT[k];
        g.fillRect(x, y, 1, 1);
        if (edge && hz < 0.35) {
          // торчащие травинки по краю
          g.fillStyle = '#4a9a3a';
          g.fillRect(x, y, 1, 1);
        }
        if (!edge && hz > 0.93) {
          g.fillStyle = DIRT[4];
          g.fillRect(x, y, 1, 1);
        }
      } else {
        // брусчатка: булыжники со швами
        const row = Math.floor(y / 3);
        const off = (row % 2) * 2;
        const gx = (x + off + variant) % 4;
        const mortar = y % 3 === 2 || gx === 3;
        let k = 2;
        if (mortar) k = 0;
        else if (y % 3 === 0) k = 3;
        else if (gx === 0) k = 3;
        if (!mortar && hz < 0.16) k = 1;
        if (edge) k = Math.max(0, k - 1);
        g.fillStyle = COB[k];
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  cache.set(key, c);
  return c;
}

export function drawPaths(ctx: CanvasRenderingContext2D, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const w = g.world;
  const a = g.trample;
  if (!a || a.length !== w.w * w.h) return;
  const wet = false;
  for (let ty = Math.max(1, r0); ty <= Math.min(w.h - 2, r1); ty++) {
    for (let tx = Math.max(1, c0); tx <= Math.min(w.w - 2, c1); tx++) {
      const i = ty * w.w + tx;
      const v = a[i];
      if (v < PATH_T1) continue;
      const st = pathStage(g, v);
      if (st === 0) continue;
      let mask = 0;
      if (a[i - w.w] >= PATH_T1) mask |= 1;
      if (a[i + 1] >= PATH_T1) mask |= 2;
      if (a[i + w.w] >= PATH_T1) mask |= 4;
      if (a[i - 1] >= PATH_T1) mask |= 8;
      const variant = Math.floor(hash2(tx, ty, 77) * 3);
      ctx.drawImage(tile(st, mask, variant, wet), tx * TW, ty * TH);
    }
  }
}

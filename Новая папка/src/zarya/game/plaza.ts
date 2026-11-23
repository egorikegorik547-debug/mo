/** Мощёная площадь вокруг стоянки: с ростом ранга поселения расширяется, появляются фонари. */
import { B, TH, TW } from './data';
import type { Game } from './game';
import { hash2 } from './rng';
import { mk, type Cv } from './sprites';

type Ctx = CanvasRenderingContext2D;

export interface Lantern {
  tx: number;
  ty: number;
  /** пиксельная позиция основания */
  x: number;
  y: number;
}

interface Plaza {
  rank: number;
  campId: number;
  x0: number;
  y0: number;
  cv: Cv | null;
  lanterns: Lantern[];
}

/** полуоси площади в тайлах по рангу (0 — хутор, площади ещё нет) */
const RX = [0, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2];
const RY = [0, 2.4, 3.1, 3.8, 4.5, 5.2, 5.9, 6.6];
const LAMPS = [0, 2, 4, 4, 6, 8, 8, 10];

let cache: Plaza | null = null;

function land(g: Game, x: number, y: number) {
  const w = g.world;
  if (x < 1 || y < 1 || x >= w.w - 1 || y >= w.h - 1) return false;
  return w.biome[y * w.w + x] > B.WATER;
}

function build(g: Game, rank: number): Plaza {
  const camp = g.buildings[0];
  const rx = RX[rank] ?? 0;
  const ry = RY[rank] ?? 0;
  const p: Plaza = { rank, campId: camp?.id ?? 0, x0: 0, y0: 0, cv: null, lanterns: [] };
  if (!camp || rx === 0) return p;
  const cx = camp.x + camp.w / 2;
  const cy = camp.y + camp.h / 2 + 0.6;
  const x0 = Math.floor(cx - rx) - 1;
  const y0 = Math.floor(cy - ry) - 1;
  const nw = Math.ceil(rx * 2) + 3;
  const nh = Math.ceil(ry * 2) + 3;
  p.x0 = x0;
  p.y0 = y0;
  const cv = mk(nw * TW, nh * TH);
  const c = cv.getContext('2d')!;
  const ok = (x: number, y: number) => {
    if (!land(g, x, y)) return false;
    const o = g.world.objs[y * g.world.w + x];
    if (o && o.kind !== 'stump') return false;
    for (const b of g.buildings) if (b !== camp && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
    return true;
  };
  const PAL = ['#a29c8a', '#9a9482', '#aca696', '#8e8878'];
  const set = new Set<number>();
  for (let ty = y0; ty < y0 + nh; ty++) {
    for (let tx = x0; tx < x0 + nw; tx++) {
      const dx = (tx + 0.5 - cx) / rx;
      const dy = (ty + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      // неровный край: на границе плиты выпадают случайно
      if (d > 1 || (d > 0.72 && hash2(tx, ty, 800) < (d - 0.72) * 2.4)) continue;
      if (!ok(tx, ty)) continue;
      set.add(ty * 4096 + tx);
      const X = (tx - x0) * TW;
      const Y = (ty - y0) * TH;
      c.fillStyle = '#6c6657';
      c.fillRect(X, Y, TW, TH);
      // булыжники 2×2 в шахматном порядке
      for (let by = 0; by < 2; by++)
        for (let bx = 0; bx < 3; bx++) {
          const off = by % 2 ? 2 : 0;
          const sx = X + bx * 5 + off + (bx === 0 && off ? -3 : 0);
          const sy = Y + by * 6;
          const px = Math.max(X, sx);
          const wdt = Math.min(X + TW, sx + 5) - px - 1;
          if (wdt <= 0) continue;
          c.fillStyle = PAL[Math.floor(hash2(tx * 7 + bx, ty * 5 + by, 801) * PAL.length)];
          c.fillRect(px, sy + 1, wdt, 4);
          c.fillStyle = 'rgba(255,255,255,0.22)';
          c.fillRect(px, sy + 1, wdt, 1);
          c.fillStyle = 'rgba(0,0,0,0.18)';
          c.fillRect(px, sy + 4, wdt, 1);
        }
      // трава пробивается в швах у края
      if (d > 0.6 && hash2(tx, ty, 802) < 0.5) {
        c.fillStyle = '#5a9a40';
        c.fillRect(X + Math.floor(hash2(tx, ty, 803) * 14), Y + Math.floor(hash2(tx, ty, 804) * 10), 1, 2);
      }
    }
  }
  // кольцо-мозаика у центра для крупных городов
  if (rank >= 4) {
    c.fillStyle = 'rgba(210,180,100,0.55)';
    const rcx = Math.round((cx - x0) * TW);
    const rcy = Math.round((cy - y0) * TH);
    const rr = Math.round(TW * (rank >= 6 ? 3.2 : 2.6));
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      const px = rcx + Math.round(Math.cos(ang) * rr);
      const py = rcy + Math.round(Math.sin(ang) * rr * 0.75);
      const tx = Math.floor(px / TW) + x0;
      const ty = Math.floor(py / TH) + y0;
      if (set.has(ty * 4096 + tx)) c.fillRect(px, py, 2, 1);
    }
  }
  p.cv = cv;
  // фонари — по периметру площади, только на плитке
  const n = LAMPS[rank] ?? 0;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.PI / n;
    for (let shrink = 0; shrink < 3; shrink++) {
      const tx = Math.round(cx + Math.cos(ang) * (rx - 0.7 - shrink * 0.6));
      const ty = Math.round(cy + Math.sin(ang) * (ry - 0.7 - shrink * 0.6));
      if (set.has(ty * 4096 + tx)) {
        p.lanterns.push({ tx, ty, x: tx * TW + TW / 2, y: ty * TH + TH - 2 });
        break;
      }
    }
  }
  return p;
}

function plazaOf(g: Game): Plaza | null {
  if (g.mode !== 'play' || !g.buildings[0]) return null;
  const rank = Math.max(0, Math.min(7, g.tierIdx));
  if (!cache || cache.rank !== rank || cache.campId !== g.buildings[0].id) cache = build(g, rank);
  return cache;
}

export function drawPlaza(ctx: Ctx, g: Game, left: number, top: number, vw: number, vh: number) {
  const p = plazaOf(g);
  if (!p || !p.cv) return;
  const x = p.x0 * TW;
  const y = p.y0 * TH;
  if (x > left + vw || y > top + vh || x + p.cv.width < left || y + p.cv.height < top) return;
  ctx.drawImage(p.cv, x, y);
}

export function plazaLanterns(g: Game): Lantern[] {
  const p = plazaOf(g);
  return p ? p.lanterns : [];
}

/** фонарный столб в ряду r (для сортировки по глубине вместе с объектами) */
export function drawLanternsRow(ctx: Ctx, g: Game, r: number, list: Lantern[]) {
  const t = g.waterT;
  const night = g.nightK;
  for (const l of list) {
    if (l.ty !== r) continue;
    const x = Math.round(l.x);
    const y = Math.round(l.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 2, y, 6, 1);
    // столб
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x, y - 13, 1, 13);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x - 1, y - 1, 3, 1);
    ctx.fillRect(x - 1, y - 14, 3, 1);
    // фонарь
    const fl = 0.85 + 0.15 * Math.sin(t * 9 + l.tx * 3 + l.ty);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x - 2, y - 19, 5, 1);
    ctx.fillRect(x - 2, y - 15, 5, 1);
    ctx.fillRect(x - 2, y - 18, 1, 3);
    ctx.fillRect(x + 2, y - 18, 1, 3);
    ctx.fillStyle = night > 0.25 ? '#ffe27a' : '#c8b878';
    ctx.globalAlpha = night > 0.25 ? fl : 0.9;
    ctx.fillRect(x - 1, y - 18, 3, 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = night > 0.25 ? '#fff6c8' : '#e8dca8';
    ctx.fillRect(x, y - 17, 1, 1);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x, y - 20, 1, 1);
  }
}

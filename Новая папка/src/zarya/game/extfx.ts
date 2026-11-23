import { B, TH, TW } from './data';
import type { Game } from './game';
import type { Caravan, Wonder } from './extstate';
import { iceK, rainK, seasonInfo } from './seasons';
import { hash2 } from './rng';

type Ctx = CanvasRenderingContext2D;
type Cv = HTMLCanvasElement;

const mkCv = (w: number, h: number): Cv => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};

/* ───────────── Снег на земле (кэшируется на карту) ───────────── */

const snowCache = new WeakMap<Cv, Cv>();

function snowLayer(g: Game): Cv {
  let c = snowCache.get(g.terrain);
  if (c) return c;
  const w = g.world;
  const W = w.w * TW;
  const H = w.h * TH;
  const src = g.terrain.getContext('2d')!.getImageData(0, 0, W, H);
  const out = new ImageData(W, H);
  const sd = src.data;
  const od = out.data;
  for (let py = 0; py < H; py++) {
    const row = ((py / TH) | 0) * w.w;
    for (let px = 0; px < W; px++) {
      const b = w.biome[row + ((px / TW) | 0)];
      if (b <= B.WATER) continue;
      const i = (py * W + px) * 4;
      const n = (((px * 73856093) ^ (py * 19349663)) >>> 0) % 100;
      const k = (b === B.BEACH ? 0.45 : b === B.DESERT ? 0.6 : 0.72) + n * 0.0022;
      od[i] = sd[i] * (1 - k) + 238 * k;
      od[i + 1] = sd[i + 1] * (1 - k) + 245 * k;
      od[i + 2] = sd[i + 2] * (1 - k) + 252 * k;
      od[i + 3] = 255;
    }
  }
  c = mkCv(W, H);
  c.getContext('2d')!.putImageData(out, 0, 0);
  snowCache.set(g.terrain, c);
  return c;
}

export function drawSnow(ctx: Ctx, g: Game, sx: number, sy: number, sw: number, sh: number) {
  const k = iceK(g);
  if (k < 0.02) return;
  const sn = snowLayer(g);
  ctx.globalAlpha = Math.min(0.94, k);
  ctx.drawImage(sn, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.globalAlpha = 1;
}

/* ───────────── Лёд на проливах ───────────── */

export function drawIce(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const k = iceK(g);
  if (k < 0.02) return;
  const w = g.world;
  const sh = w.shore;
  if (!sh) return;
  const t = g.waterT;
  for (let ty = Math.max(0, r0); ty <= Math.min(w.h - 1, r1); ty++) {
    for (let tx = Math.max(0, c0); tx <= Math.min(w.w - 1, c1); tx++) {
      const i = ty * w.w + tx;
      if (w.biome[i] > B.WATER || sh[i] > 4) continue;
      const x = tx * TW;
      const y = ty * TH;
      const a = k * (0.93 - sh[i] * 0.07);
      ctx.globalAlpha = a;
      ctx.fillStyle = hash2(tx, ty, 3) < 0.5 ? '#d6eefa' : '#c6e4f6';
      ctx.fillRect(x, y, TW, TH);
      // трещины
      const h = hash2(tx, ty, 17);
      ctx.fillStyle = '#9cc4de';
      if (h < 0.4) {
        const cx = x + 2 + Math.floor(hash2(tx, ty, 5) * 10);
        ctx.fillRect(cx, y + 2, 1, 3);
        ctx.fillRect(cx + 1, y + 5, 2, 1);
        ctx.fillRect(cx + 3, y + 6, 1, 3);
      } else if (h < 0.55) {
        ctx.fillRect(x + 3, y + 8, 5, 1);
        ctx.fillRect(x + 8, y + 7, 1, 2);
      }
      // блики
      const tw = Math.sin(t * 1.3 + tx * 1.7 + ty * 2.3);
      if (tw > 0.93) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4 + ((tx * 7 + ty * 3) % 8), y + 3 + ((tx + ty * 5) % 6), 2, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* ───────────── Сезонная дымка, дождь и снегопад (экранные) ───────────── */

export function drawSeasonScreen(ctx: Ctx, g: Game, cw: number, ch: number) {
  if (g.mode !== 'play') return;
  const s = seasonInfo(g);
  const ik = iceK(g);
  const rain = rainK(g);
  const tints: [string, number][] = [
    ['140,230,140', 0.035],
    ['255,226,130', 0.05],
    ['214,120,40', 0.07],
    ['190,222,255', 0.05 + 0.1 * ik],
  ];
  const [col, a] = tints[s.idx];
  // плавный переход в начале сезона
  const fade = Math.min(1, s.pos / 0.8);
  ctx.fillStyle = `rgba(${col},${a * (0.4 + 0.6 * fade)})`;
  ctx.fillRect(0, 0, cw, ch);
  const t = g.waterT;
  const d = g.dpr || 1;
  if (rain > 0.02) {
    ctx.fillStyle = `rgba(36,48,72,${0.2 * rain})`;
    ctx.fillRect(0, 0, cw, ch);
    const n = Math.floor(190 * rain);
    ctx.strokeStyle = 'rgba(190,210,235,0.45)';
    ctx.lineWidth = Math.max(1, d);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 520 + (i % 7) * 40;
      const x = ((i * 97.3 + t * 90) % (cw + 80)) - 40;
      const y = ((i * 61.7 + t * sp * d) % (ch + 60)) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4 * d, y + 13 * d);
    }
    ctx.stroke();
  }
  if (s.winter && ik > 0.05) {
    const n = Math.floor(150 * ik);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (let i = 0; i < n; i++) {
      const fall = 26 + (i % 6) * 9;
      const x = ((i * 131.7 + t * (10 + (i % 5) * 3) * d + Math.sin(t * 0.9 + i) * 24 * d) % (cw + 40)) - 20;
      const y = ((i * 53.3 + t * fall * d) % (ch + 20)) - 10;
      const z = (i % 3 === 0 ? 2.4 : 1.5) * d;
      ctx.fillRect(Math.round(x), Math.round(y), z, z);
    }
  }
}

/* ───────────── Чудеса: спрайты ───────────── */

const wonderCache: Partial<Record<Wonder['wk'], Cv>> = {};

function wonderSprite(wk: Wonder['wk']): Cv {
  const hit = wonderCache[wk];
  if (hit) return hit;
  let c: Cv;
  if (wk === 'monolith') {
    c = mkCv(26, 38);
    const x = c.getContext('2d')!;
    R(x, 2, 33, 22, 4, '#585e6e');
    R(x, 4, 31, 18, 3, '#6a7080');
    R(x, 0, 36, 26, 2, '#e8d89a');
    for (let y = 3; y < 32; y++) {
      const wd = 8 + Math.floor((y / 32) * 5);
      const lx = 13 - Math.floor(wd / 2);
      R(x, lx, y, wd, 1, '#4a5064');
      R(x, lx, y, 2, 1, '#6a7188');
      R(x, lx + wd - 2, y, 2, 1, '#363a4a');
    }
    R(x, 10, 1, 5, 2, '#4a5064');
    R(x, 11, 0, 3, 1, '#6a7188');
    R(x, 6, 29, 4, 2, '#4a7a3a');
    R(x, 17, 30, 3, 2, '#3a6a30');
    for (const [rx, ry] of [[11, 8], [14, 12], [11, 17], [13, 22], [12, 26]]) R(x, rx, ry, 2, 1, '#7af2ff');
  } else if (wk === 'mine') {
    c = mkCv(46, 32);
    const x = c.getContext('2d')!;
    for (let y = 4; y < 31; y++) {
      const half = Math.min(21, 6 + Math.floor((y - 4) * 0.9));
      R(x, 23 - half, y, half * 2, 1, y < 9 ? '#9a8a72' : y < 18 ? '#7a6a58' : '#6a5a4a');
      R(x, 23 - half, y, 2, 1, '#a89878');
      R(x, 23 + half - 3, y, 3, 1, '#524536');
    }
    R(x, 4, 29, 38, 3, '#e8d89a');
    R(x, 15, 14, 16, 16, '#100a06');
    R(x, 17, 11, 12, 3, '#100a06');
    R(x, 14, 13, 3, 17, '#8a5a2a');
    R(x, 29, 13, 3, 17, '#8a5a2a');
    R(x, 12, 10, 22, 4, '#a86e34');
    R(x, 12, 10, 22, 1, '#c88a48');
    R(x, 20, 16, 1, 14, '#2a1a10');
    R(x, 21, 29, 12, 1, '#6a6a72');
    R(x, 23, 25, 9, 5, '#6a4a2a');
    R(x, 24, 24, 7, 1, '#c8c8d0');
    R(x, 25, 23, 4, 1, '#e0e0e8');
    R(x, 10, 15, 2, 4, '#ffcf6a');
    R(x, 33, 5, 3, 1, '#c8c8d0');
    R(x, 36, 4, 1, 4, '#7a4a20');
  } else if (wk === 'wreck') {
    c = mkCv(50, 34);
    const x = c.getContext('2d')!;
    R(x, 0, 26, 50, 8, '#e4d494');
    R(x, 2, 24, 46, 3, '#d8c887');
    R(x, 5, 24, 40, 3, '#4a2e18');
    for (let i = 0; i < 8; i++) {
      const h = Math.round(16 - Math.abs(i - 3.5) * 2.6);
      const rx = 7 + i * 5;
      R(x, rx, 25 - h, 2, h, '#6b4423');
      R(x, rx, 25 - h, 2, 1, '#8a5e36');
    }
    R(x, 7, 20, 14, 1, '#4a2e18');
    R(x, 24, 17, 18, 1, '#4a2e18');
    R(x, 9, 15, 9, 1, '#4a2e18');
    for (let i = 0; i < 14; i++) R(x, 23 + Math.floor(i * 0.3), 2 + i, 2, 1, '#5a3a1c');
    R(x, 27, 4, 9, 9, '#d8d0b8');
    R(x, 29, 6, 2, 3, '#7a7466');
    R(x, 33, 9, 3, 3, '#7a7466');
    R(x, 12, 27, 2, 4, '#3a7a4a');
    R(x, 35, 28, 2, 3, '#3a7a4a');
    R(x, 20, 30, 6, 1, '#c8b878');
  } else {
    c = mkCv(48, 38);
    const x = c.getContext('2d')!;
    R(x, 3, 18, 42, 18, '#8a8a82');
    for (let yy = 20; yy < 36; yy += 4) for (let xx = 3 + (yy % 8); xx < 45; xx += 8) R(x, xx, yy, 7, 1, '#6a6a64');
    for (const cx of [3, 14, 33]) R(x, cx, 13, 7, 5, '#8a8a82');
    R(x, 3, 5, 11, 31, '#82827a');
    R(x, 3, 5, 4, 3, '#82827a');
    R(x, 9, 7, 5, 2, '#9a9a92');
    R(x, 3, 5, 2, 31, '#a0a098');
    R(x, 19, 24, 10, 12, '#16161a');
    R(x, 20, 21, 8, 3, '#16161a');
    R(x, 5, 24, 3, 6, '#4a7a3a');
    R(x, 36, 20, 3, 8, '#3a6a30');
    R(x, 38, 26, 2, 4, '#4a7a3a');
    R(x, 0, 34, 48, 4, '#e0d090');
    for (const [rx, ry, rw] of [[14, 33, 5], [30, 33, 6], [41, 34, 4]]) R(x, rx, ry, rw, 3, '#74746c');
  }
  wonderCache[wk] = c;
  return c;
}

const OWNER_COL = { none: '#e8e0c8', player: '#7dff8c', bot: '#ff7a6a' } as const;

function flag(ctx: Ctx, g: Game, x: number, y: number, col: string) {
  const t = g.waterT;
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(x, y, 1, 12);
  ctx.fillStyle = col;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 1 + i, y + 1 + Math.round(Math.sin(t * 4 + i * 0.7) * 0.8), 1, 4 - (i > 3 ? 1 : 0));
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x - 1, y + 12, 3, 1);
}

export function drawWondersRow(ctx: Ctx, g: Game, row: number) {
  for (const o of g.ext.wonders) {
    if (o.y !== row) continue;
    const sp = wonderSprite(o.wk);
    const dx = Math.round((o.x + 0.5) * TW - sp.width / 2);
    const dy = Math.round((o.y + 1) * TH - sp.height);
    ctx.drawImage(sp, dx, dy);
    const t = g.waterT;
    if (o.wk === 'monolith') {
      const k = 0.45 + 0.4 * Math.sin(t * 2.2);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(dx + 13, dy + 18, 0, dx + 13, dy + 18, 22);
      gr.addColorStop(0, `rgba(90,230,255,${0.32 * k})`);
      gr.addColorStop(1, 'rgba(90,230,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(dx - 12, dy - 6, 50, 50);
      ctx.globalCompositeOperation = 'source-over';
    } else if (o.wk === 'mine') {
      const k = 0.6 + 0.3 * Math.sin(t * 7);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(dx + 11, dy + 17, 0, dx + 11, dy + 17, 12);
      gr.addColorStop(0, `rgba(255,190,80,${0.4 * k})`);
      gr.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(dx - 2, dy + 4, 26, 26);
      ctx.globalCompositeOperation = 'source-over';
    }
    flag(ctx, g, dx + (o.wk === 'fort' ? 8 : sp.width - 8), dy - 8 + (o.wk === 'monolith' ? 2 : 0), OWNER_COL[o.owner]);
  }
}

export function drawWonderLabels(ctx: Ctx, g: Game, left: number, top: number, s: number, fs: number, defs: Record<string, { name: string; icon: string }>) {
  if (g.mode !== 'play') return;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const o of g.ext.wonders) {
    const x = ((o.x + 0.5) * TW - left) * s;
    const y = ((o.y - 2.6) * TH - top) * s;
    if (x < -200 || x > g.cw + 200 || y < -60 || y > g.ch + 60) continue;
    const d = defs[o.wk];
    const title = `${d.icon} ${d.name}`;
    const sub = o.owner === 'player' ? '✔ ваше · бонус действует' : o.owner === 'bot' ? `занято: ${o.ownerName}` : 'не занято — поставьте флаг [L]';
    ctx.font = `600 ${fs}px "Pixelify Sans", ui-monospace, monospace`;
    ctx.lineWidth = Math.max(3, fs * 0.28);
    ctx.strokeStyle = 'rgba(12,8,6,0.92)';
    ctx.strokeText(title, x, y);
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(title, x, y);
    ctx.font = `500 ${Math.round(fs * 0.78)}px "Pixelify Sans", ui-monospace, monospace`;
    ctx.lineWidth = Math.max(3, fs * 0.24);
    ctx.strokeText(sub, x, y + fs * 0.95);
    ctx.fillStyle = o.owner === 'player' ? '#9affaa' : o.owner === 'bot' ? '#ff9a8a' : '#f3e3c0';
    ctx.fillText(sub, x, y + fs * 0.95);
  }
}

/* ───────────── Караваны ───────────── */

export function drawCaravansRow(ctx: Ctx, g: Game, row: number) {
  const t = g.waterT;
  for (const c of g.ext.caravans) {
    if (Math.floor(c.y) !== row) continue;
    drawCaravan(ctx, c, t);
  }
}

function drawCaravan(ctx: Ctx, c: Caravan, t: number) {
  const px = Math.round(c.x * TW);
  const py = Math.round(c.y * TH);
  if (c.sea) {
    const bx = px - 8;
    const by = Math.round(py - 10 + Math.sin(t * 3) * 0.8);
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(bx, by + 6, 16, 3);
    ctx.fillRect(bx + 2, by + 9, 12, 1);
    ctx.fillStyle = '#8a5e36';
    ctx.fillRect(bx, by + 6, 16, 1);
    ctx.fillStyle = '#6a4524';
    ctx.fillRect(bx + 7, by - 6, 1, 12);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(bx + 8, by - 5, 6, 8);
    ctx.fillStyle = '#ffcf6a';
    ctx.fillRect(bx + 3, by + 4, 3, 2);
    return;
  }
  const right = c.dir === 2;
  const moving = c.state === 'go';
  const bob = moving ? Math.round(Math.sin(t * 9 + c.id) * 0.6) : 0;
  const o = (dx: number) => (right ? px + dx : px - dx - 1);
  // тень
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.fillRect(px - 9, py - 1, 18, 3);
  ctx.globalAlpha = 1;
  // телега
  const cartX = right ? px - 9 : px - 2;
  ctx.fillStyle = '#7a4e26';
  ctx.fillRect(cartX, py - 7 + bob, 11, 5);
  ctx.fillStyle = '#9a6a36';
  ctx.fillRect(cartX, py - 7 + bob, 11, 1);
  // тент
  ctx.fillStyle = '#efe4c6';
  ctx.fillRect(cartX + 1, py - 12 + bob, 9, 5);
  ctx.fillStyle = '#d8c9a2';
  ctx.fillRect(cartX + 1, py - 8 + bob, 9, 1);
  ctx.fillStyle = '#b84a3a';
  ctx.fillRect(cartX + 1, py - 12 + bob, 9, 1);
  // колёса
  const wf = moving ? Math.floor(t * 8 + c.id) & 1 : 0;
  for (const wx of [cartX + 2, cartX + 8]) {
    ctx.fillStyle = '#2a1a0e';
    ctx.fillRect(wx, py - 3 + bob, 3, 3);
    ctx.fillStyle = wf ? '#c8a060' : '#8a6a3a';
    ctx.fillRect(wx + 1, py - 2 + bob, 1, 1);
  }
  // лошадка
  const hx = right ? px + 3 : px - 8;
  const step = moving ? Math.floor(t * 9 + c.id) & 1 : 0;
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(hx, py - 8 + bob, 7, 4);
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(hx, py - 8 + bob, 7, 1);
  ctx.fillRect(right ? hx + 6 : hx - 1, py - 11 + bob, 2, 4);
  ctx.fillStyle = '#2a1a0e';
  ctx.fillRect(right ? hx + 7 : hx - 2, py - 10 + bob, 1, 1);
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(hx + 1 + step, py - 4 + bob, 1, 4);
  ctx.fillRect(hx + 5 - step, py - 4 + bob, 1, 4);
  void o;
  if (c.state === 'ambush') {
    const k = Math.sin(t * 10) > 0 ? '#ff5a4a' : '#ffe27a';
    ctx.fillStyle = k;
    ctx.fillRect(px - 1, py - 24 + Math.round(Math.sin(t * 6)), 2, 6);
    ctx.fillRect(px - 1, py - 16 + Math.round(Math.sin(t * 6)), 2, 2);
  }
}

/* ───────────── Походы ИИ-армий ───────────── */

const BANNERS = ['#e5484d', '#e8a33a', '#a96bff', '#4aa8ff', '#5fd0a0', '#e86ab0'];

export function drawRivalMarches(ctx: Ctx, g: Game) {
  for (const m of g.ext.rivalMarches) {
    const k = Math.min(1, m.t / m.dur);
    const x0 = (m.sx + 0.5) * TW;
    const y0 = (m.sy + 0.7) * TH;
    const x1 = (m.tx + 0.5) * TW;
    const y1 = (m.ty + 0.7) * TH;
    const px = x0 + (x1 - x0) * k;
    const py = y0 + (y1 - y0) * k;
    const col = BANNERS[m.from % BANNERS.length];
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = col;
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += 10) ctx.fillRect(Math.round(x0 + ((x1 - x0) * d) / len), Math.round(y0 + ((y1 - y0) * d) / len), 2, 1);
    ctx.globalAlpha = 1;
    const right = x1 >= x0;
    const cnt = Math.min(5, 2 + Math.floor(m.n / 6));
    const fr = Math.floor(g.waterT * 6) & 1;
    for (let i = 0; i < cnt; i++) {
      const sx = Math.round(px + (i - cnt / 2) * 4 - (right ? 2 : -2) * (i % 2));
      const sy = Math.round(py + (i % 2) * 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx - 1, sy, 5, 1);
      ctx.fillStyle = '#c8ccd8';
      ctx.fillRect(sx + 1, sy - 8, 2, 2);
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy - 6, 4, 4);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(sx, sy - 2 + (fr && i % 2 ? 0 : 0), 1, 2 + (fr ^ (i & 1)));
      ctx.fillRect(sx + 3, sy - 2, 1, 2 + (1 - (fr ^ (i & 1))));
      ctx.fillStyle = '#9aa0b0';
      ctx.fillRect(right ? sx + 4 : sx - 1, sy - 9, 1, 8);
    }
    // знамя
    ctx.fillStyle = '#2a1a0e';
    ctx.fillRect(Math.round(px), Math.round(py - 17), 1, 12);
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(px) + 1, Math.round(py - 17), 6, 4);
  }
}

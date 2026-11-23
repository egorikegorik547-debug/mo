/** Живая природа и вода: камыш, кувшинки, стайки рыб, валуны, грибы, круги дождя, утренний туман,
 *  рябящие отражения, падающие деревья и пунктирные связи «дом ↔ жители». Всё рисуется пикселями. */
import { B, BUILDINGS, TH, TW } from './data';
import { FALL_TIME, type FallingTree, type Game } from './game';
import { DECOR, natureDecor } from './terrain';
import { hash2 } from './rng';
import { iceK, rainK } from './seasons';
import { mk, type Cv } from './sprites';
import { windAt } from './fx';

type Ctx = CanvasRenderingContext2D;

/** 0..1: сглаженная ступенька */
const sstep = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/* ───────────── Камыш, кувшинки, рыбы, валуны, грибы ───────────── */

export function drawNatureDecor(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const w = g.world;
  const dec = natureDecor(w);
  const t = g.waterT;
  const ice = iceK(g);
  const sh = w.shore;
  const night = g.nightK;
  for (let ty = Math.max(1, r0); ty <= Math.min(w.h - 2, r1); ty++) {
    for (let tx = Math.max(1, c0); tx <= Math.min(w.w - 2, c1); tx++) {
      const i = ty * w.w + tx;
      const k = dec[i];
      if (!k) continue;
      const X = tx * TW;
      const Y = ty * TH;
      if (k === DECOR.REED) {
        if (w.blocked[i] || w.objs[i]) continue;
        drawReeds(ctx, g, tx, ty, X, Y, t, ice);
      } else if (k === DECOR.LILY) {
        if (ice > 0.35 && sh && sh[i] <= 4) continue;
        drawLily(ctx, tx, ty, X, Y, t, 1 - Math.min(1, ice * 2));
      } else if (k === DECOR.FISH) {
        if (ice > 0.35 && sh && sh[i] <= 4) continue;
        drawFish(ctx, tx, ty, X, Y, t, 1 - Math.min(1, ice * 2));
      } else if (k === DECOR.BOULDER) {
        if (w.blocked[i] || w.objs[i]) continue;
        drawBoulder(ctx, tx, ty, X, Y);
      } else if (k === DECOR.MUSHROOM) {
        if (w.blocked[i] || w.objs[i]) continue;
        drawMushrooms(ctx, tx, ty, X, Y, t, night);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawReeds(ctx: Ctx, g: Game, tx: number, ty: number, X: number, Y: number, t: number, ice: number) {
  const dry = ice > 0.3;
  const wind = windAt(g, X);
  const clumps = 2 + (hash2(tx, ty, 510) < 0.4 ? 1 : 0);
  for (let c = 0; c < clumps; c++) {
    const bx = X + 2 + Math.floor(hash2(tx, ty, 511 + c) * 12);
    const by = Y + 6 + Math.floor(hash2(tx, ty, 520 + c) * 5);
    const n = 3 + Math.floor(hash2(tx, ty, 530 + c) * 2);
    ctx.fillStyle = 'rgba(30,60,30,0.35)';
    ctx.fillRect(bx - 2, by + 1, 6, 1);
    for (let k = 0; k < n; k++) {
      const hgt = 5 + Math.floor(hash2(tx + k, ty, 540 + c) * 5);
      const x = bx + k - 1 + (k % 2);
      const sway = Math.round(Math.sin(t * 2.0 + tx * 0.8 + k * 0.9 + c) * (0.5 + wind * 1.2));
      ctx.fillStyle = dry ? '#a89a5c' : k % 2 ? '#4f7a2e' : '#6a9a38';
      ctx.fillRect(x, by - hgt + 2, 1, hgt - 2);
      ctx.fillRect(x + (sway > 0 ? 1 : sway < 0 ? -1 : 0), by - hgt + 1, 1, 2);
      ctx.fillRect(x + sway, by - hgt, 1, 1);
      if (k === 1 || (k === 3 && hash2(tx, ty, 550) < 0.6)) {
        // рогоз — коричневая «сосиска» на верхушке
        ctx.fillStyle = '#6a3a1c';
        ctx.fillRect(x + sway, by - hgt - 2, 1, 3);
        ctx.fillStyle = '#9a6a3a';
        ctx.fillRect(x + sway, by - hgt - 2, 1, 1);
      }
    }
  }
}

function drawLily(ctx: Ctx, tx: number, ty: number, X: number, Y: number, t: number, vis: number) {
  const n = 1 + (hash2(tx, ty, 560) < 0.45 ? 1 : 0);
  for (let c = 0; c < n; c++) {
    const px = X + 2 + Math.floor(hash2(tx, ty, 561 + c) * 10);
    const py = Y + 2 + Math.floor(hash2(tx, ty, 571 + c) * 7);
    const bob = Math.round(Math.sin(t * 1.1 + tx * 1.7 + ty * 0.9 + c * 2) * 0.6);
    const dx = Math.round(Math.sin(t * 0.35 + tx + c) * 0.8);
    const x = px + dx;
    const y = py + bob;
    ctx.globalAlpha = vis * 0.95;
    ctx.fillStyle = 'rgba(20,70,90,0.35)';
    ctx.fillRect(x - 1, y + 3, 6, 1);
    ctx.fillStyle = '#2c7a3a';
    ctx.fillRect(x, y, 5, 3);
    ctx.fillRect(x - 1, y + 1, 7, 1);
    ctx.fillStyle = '#4aaa52';
    ctx.fillRect(x + 1, y, 3, 2);
    ctx.fillStyle = '#7ad07a';
    ctx.fillRect(x + 1, y, 1, 1);
    // выемка листа
    ctx.fillStyle = '#3fa8c8';
    ctx.fillRect(x + 4, y + 1, 2, 1);
    if (hash2(tx, ty, 581 + c) < 0.5) {
      ctx.fillStyle = '#fff4f8';
      ctx.fillRect(x + 2, y - 1, 2, 2);
      ctx.fillStyle = '#ff9ec0';
      ctx.fillRect(x + 2, y, 1, 1);
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(x + 3, y - 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function drawFish(ctx: Ctx, tx: number, ty: number, X: number, Y: number, t: number, vis: number) {
  const n = 4 + Math.floor(hash2(tx, ty, 590) * 3);
  const cx = X + TW / 2;
  const cy = Y + TH / 2;
  const sp = 0.55 + hash2(tx, ty, 591) * 0.5;
  const dirSign = hash2(tx, ty, 592) < 0.5 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const ph = t * sp * dirSign + k * 0.55 + hash2(tx, ty, 593) * 6;
    const rx = 4 + (k % 3) * 2 + Math.sin(t * 0.4 + k) * 1.2;
    const ry = 2.5 + (k % 2) * 1.5;
    const fx = cx + Math.cos(ph) * rx + Math.sin(t * 0.23 + tx) * 2;
    const fy = cy + Math.sin(ph) * ry;
    const vx = -Math.sin(ph) * dirSign;
    const vy = Math.cos(ph) * (ry / rx) * dirSign;
    const horiz = Math.abs(vx) >= Math.abs(vy) * 1.4;
    const x = Math.round(fx);
    const y = Math.round(fy);
    ctx.globalAlpha = 0.5 * vis;
    ctx.fillStyle = '#12405c';
    if (horiz) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x + (vx > 0 ? -2 : 2), y - 1, 1, 3);
      ctx.globalAlpha = 0.28 * vis;
      ctx.fillStyle = '#e8fbff';
      ctx.fillRect(x + (vx > 0 ? 0 : -1), y - 1, 1, 1);
    } else {
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillRect(x - 1, y + (vy > 0 ? -2 : 2), 3, 1);
    }
  }
  // редкий всплеск у поверхности
  const jp = (t * 0.33 + hash2(tx, ty, 594) * 9) % 5;
  if (jp < 0.5) {
    const q = jp / 0.5;
    ctx.globalAlpha = (1 - q) * 0.8 * vis;
    ctx.fillStyle = '#ffffff';
    const rr = 1 + Math.round(q * 3);
    ctx.fillRect(cx - rr, cy, 1, 1);
    ctx.fillRect(cx + rr, cy, 1, 1);
    ctx.fillRect(cx - rr + 1, cy - 1, Math.max(1, rr * 2 - 1), 1);
    ctx.fillRect(cx, cy - Math.round(Math.sin(q * Math.PI) * 3) - 1, 1, 2);
  }
  ctx.globalAlpha = 1;
}

function drawBoulder(ctx: Ctx, tx: number, ty: number, X: number, Y: number) {
  const bw = 7 + Math.floor(hash2(tx, ty, 600) * 4);
  const bh = 4 + Math.floor(hash2(tx, ty, 601) * 3);
  const x = X + 2 + Math.floor(hash2(tx, ty, 602) * (TW - bw - 3));
  const y = Y + 5 + Math.floor(hash2(tx, ty, 603) * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(x - 1, y + bh, bw + 2, 1);
  ctx.fillStyle = '#4e525c';
  ctx.fillRect(x, y + 1, bw, bh);
  ctx.fillRect(x + 1, y, bw - 2, 1);
  ctx.fillStyle = '#7c8088';
  ctx.fillRect(x + 1, y + 1, bw - 2, bh - 1);
  ctx.fillStyle = '#9aa0aa';
  ctx.fillRect(x + 1, y + 1, Math.max(2, bw - 5), 1);
  ctx.fillRect(x + 1, y + 2, 1, 1);
  // мох сверху и по бокам
  ctx.fillStyle = '#3f7a34';
  ctx.fillRect(x + 1, y, bw - 3, 1);
  ctx.fillRect(x, y + 1, 2, 1);
  ctx.fillRect(x + bw - 3, y + 1, 3, 1);
  ctx.fillStyle = '#5a9a40';
  ctx.fillRect(x + 2, y, 2, 1);
  ctx.fillRect(x + bw - 3, y + 1, 1, 1);
  if (bh > 4) ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = '#86c05a';
  ctx.fillRect(x + 3, y, 1, 1);
}

const CAPS = [
  ['#d8402e', '#fff4e0'],
  ['#c0783a', '#f0d8a8'],
  ['#e8dcc0', '#b8a888'],
  ['#9a5ac8', '#e8c8ff'],
];

function drawMushrooms(ctx: Ctx, tx: number, ty: number, X: number, Y: number, t: number, night: number) {
  const n = 3 + Math.floor(hash2(tx, ty, 610) * 3);
  for (let k = 0; k < n; k++) {
    const x = X + 1 + Math.floor(hash2(tx, ty, 611 + k) * 13);
    const y = Y + 4 + Math.floor(hash2(tx, ty, 621 + k) * 7);
    const [cap, dot] = CAPS[Math.floor(hash2(tx, ty, 631 + k) * (night > 0.4 ? 4 : 3))];
    const big = hash2(tx, ty, 641 + k) < 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x - 1, y + 2, big ? 5 : 4, 1);
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(x + 1, y + 1, 1, 2);
    ctx.fillStyle = cap;
    if (big) {
      ctx.fillRect(x, y - 1, 3, 1);
      ctx.fillRect(x - 1, y, 5, 1);
      ctx.fillStyle = dot;
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillRect(x + 3, y, 1, 1);
    } else {
      ctx.fillRect(x, y, 3, 1);
      ctx.fillStyle = dot;
      ctx.fillRect(x + 1, y - 1, 1, 1);
    }
    // ночью фиолетовые шляпки чуть светятся спорами
    if (night > 0.4 && cap === '#9a5ac8') {
      const tw = Math.sin(t * 2.2 + k + tx);
      ctx.globalAlpha = night * (0.35 + 0.35 * tw * tw);
      ctx.fillStyle = '#d8a8ff';
      ctx.fillRect(x + 1, y - 3 - Math.round(Math.abs(tw) * 2), 1, 1);
      ctx.globalAlpha = 1;
    }
  }
}

/* ───────────── Круги от капель дождя на воде ───────────── */

export function drawRainRipples(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const rain = rainK(g);
  if (rain < 0.04) return;
  const w = g.world;
  const t = g.waterT;
  ctx.fillStyle = '#e4f6ff';
  for (let ty = Math.max(0, r0); ty <= Math.min(w.h - 1, r1); ty++) {
    for (let tx = Math.max(0, c0); tx <= Math.min(w.w - 1, c1); tx++) {
      if (w.biome[ty * w.w + tx] > B.WATER) continue;
      // у каждой клетки несколько «слотов»: капля падает, круг расходится ~0.9 с
      for (let s = 0; s < 2; s++) {
        const period = 0.9 + s * 0.33;
        const o = hash2(tx, ty, 650 + s) * period;
        const slot = Math.floor((t + o) / period);
        if (hash2(tx, ty, 660 + slot * 3 + s) > 0.1 * rain) continue;
        const ph = ((t + o) % period) / 0.9;
        if (ph >= 1) continue;
        const cx = tx * TW + 3 + Math.floor(hash2(tx, slot, 670 + s) * 10);
        const cy = ty * TH + 3 + Math.floor(hash2(ty, slot, 680 + s) * 6);
        const r = 1 + Math.floor(ph * 5);
        ctx.globalAlpha = (1 - ph) * 0.8;
        // пиксельный эллипс: плоский круг (ширина больше высоты)
        const ry = Math.max(1, Math.round(r * 0.5));
        ctx.fillRect(cx - r + 1, cy - ry, Math.max(1, r * 2 - 1), 1);
        ctx.fillRect(cx - r + 1, cy + ry, Math.max(1, r * 2 - 1), 1);
        ctx.fillRect(cx - r, cy - ry + 1, 1, Math.max(1, ry * 2 - 1));
        ctx.fillRect(cx + r, cy - ry + 1, 1, Math.max(1, ry * 2 - 1));
        if (ph < 0.12) ctx.fillRect(cx, cy - 2, 1, 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* ───────────── Утренний туман над водой (04:00–07:00) ───────────── */

let fogCv: Cv | null = null;
function fogSprite(): Cv {
  if (fogCv) return fogCv;
  const W = 26;
  const H = 8;
  const c = mk(W, H);
  const g = c.getContext('2d')!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2);
      const dy = (y + 0.5 - H / 2) / (H / 2);
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const a = Math.floor(Math.pow(1 - d, 1.1) * 4.99) / 4; // 5 уровней — «пиксельная» дымка
      if (a <= 0) continue;
      g.fillStyle = `rgba(236,244,250,${a * 0.9})`;
      g.fillRect(x, y, 1, 1);
    }
  fogCv = c;
  return c;
}

/** интенсивность тумана 0..1 по часам суток */
export function fogK(g: Game): number {
  const h = g.dayT * 24;
  if (h < 3.5 || h > 7.5) return 0;
  return sstep(3.5, 5, h) * (1 - sstep(6, 7.5, h));
}

export function drawMorningFog(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const fk = fogK(g);
  if (fk < 0.02) return;
  const w = g.world;
  const t = g.waterT;
  const sp = fogSprite();
  const sh = w.shore;
  for (let ty = Math.max(0, r0); ty <= Math.min(w.h - 1, r1); ty++) {
    for (let tx = Math.max(0, c0); tx <= Math.min(w.w - 1, c1); tx++) {
      const i = ty * w.w + tx;
      if (w.biome[i] > B.WATER) continue;
      const hh = hash2(tx, ty, 700);
      if (hh > 0.62) continue;
      // клубы плывут вдоль берега и «дышат»
      const drift = Math.sin(t * 0.22 + hh * 20 + ty * 0.4) * 9 + ((t * 1.1 + hh * 40) % 6);
      const breathe = 0.65 + 0.35 * Math.sin(t * 0.5 + hh * 30);
      const near = sh && sh[i] <= 3 ? 1.25 : 0.85;
      const x = Math.round(tx * TW + (hh * 7 - 5) + drift - 5);
      const y = Math.round(ty * TH + 2 + Math.sin(t * 0.3 + hh * 11) * 1.5 + hash2(tx, ty, 701) * 3);
      ctx.globalAlpha = Math.min(0.4, fk * 0.3 * breathe * near);
      ctx.drawImage(sp, x, y, sp.width * 2, sp.height * 2);
    }
  }
  ctx.globalAlpha = 1;
}

/* ───────────── Рябящие отражения у берега ───────────── */

function reflect(ctx: Ctx, g: Game, spr: Cv, cx: number, base: number, clipX0: number, clipX1: number, clipY0: number, depthPx: number, alpha: number) {
  const t = g.waterT;
  const maxH = Math.min(spr.height, 18);
  const x0 = Math.round(cx - spr.width / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX0, clipY0, clipX1 - clipX0, depthPx);
  ctx.clip();
  for (let k = 0; k < maxH; k += 2) {
    const sy = spr.height - k - 2;
    if (sy < 0) break;
    const rip = Math.round(Math.sin(t * 2.6 + k * 0.85 + cx * 0.21) * (0.6 + k * 0.07));
    ctx.globalAlpha = alpha * (1 - (k / maxH) * 0.85);
    ctx.drawImage(spr, 0, sy, spr.width, 2, x0 + rip, Math.round(base + k + 1), spr.width, 2);
  }
  ctx.restore();
}

export function drawReflections(ctx: Ctx, g: Game, c0: number, c1: number, r0: number, r1: number) {
  const ice = iceK(g);
  if (ice > 0.6) return;
  const w = g.world;
  const alpha = 0.34 * (1 - ice) * (1 - g.nightK * 0.55);
  if (alpha < 0.03) return;
  const waterAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w.w && y < w.h && w.biome[y * w.w + x] <= B.WATER;
  // деревья, камни, пни, кусты
  for (let ty = Math.max(0, r0); ty <= Math.min(w.h - 2, r1); ty++) {
    for (let tx = Math.max(0, c0); tx <= Math.min(w.w - 1, c1); tx++) {
      const o = w.objs[ty * w.w + tx];
      if (!o || !waterAt(tx, ty + 1)) continue;
      const spr = g.spr[o.spr];
      if (!spr) continue;
      let l = tx;
      let rr = tx;
      if (waterAt(tx - 1, ty + 1)) l--;
      if (waterAt(tx + 1, ty + 1)) rr++;
      const deep = waterAt(tx, ty + 2) ? 2 : 1;
      reflect(ctx, g, spr, (tx + 0.5) * TW, (ty + 0.9) * TH, l * TW, (rr + 1) * TW, (ty + 1) * TH, deep * TH, alpha);
    }
  }
  // здания и усадьбы
  const draw = (b: { type: string; x: number; y: number; w: number; h: number; done: boolean }) => {
    if (!b.done) return;
    const row = b.y + b.h;
    if (row < r0 - 1 || row > r1 || b.x > c1 + 2 || b.x + b.w < c0 - 2 || row >= w.h) return;
    const spr = (g.bspr.cv as Record<string, Cv | undefined>)[b.type];
    if (!spr) return;
    const cols: number[] = [];
    for (let x = b.x - 1; x <= b.x + b.w; x++) if (waterAt(x, row)) cols.push(x);
    if (!cols.length) return;
    ctx.save();
    ctx.beginPath();
    for (const x of cols) ctx.rect(x * TW, row * TH, TW, (waterAt(x, row + 1) ? 2 : 1) * TH);
    ctx.clip();
    reflect(ctx, g, spr, (b.x + b.w / 2) * TW, row * TH - 1, 0, w.w * TW, row * TH, 2 * TH, alpha);
    ctx.restore();
  };
  for (const b of g.buildings) draw(b);
  for (const tn of g.towns) for (const b of tn.bld) draw(b);
  ctx.globalAlpha = 1;
}

/* ───────────── Падающее дерево ───────────── */

export function drawFalling(ctx: Ctx, g: Game, f: FallingTree) {
  const s = g.spr[f.spr];
  if (!s) return;
  const cx = (f.tx + 0.5) * TW;
  const base = (f.ty + 0.9) * TH;
  const k = Math.min(1, f.t / FALL_TIME);
  const LEAN = 0.17;
  const END = Math.PI / 2 - 0.05;
  let ang: number;
  if (k < LEAN) {
    // замах: дерево чуть откачивается в обратную сторону
    ang = -f.dir * 0.09 * Math.sin((k / LEAN) * Math.PI);
  } else {
    const q = (k - LEAN) / (1 - LEAN);
    ang = f.dir * Math.pow(q, 2.1) * END;
  }
  // отскок при ударе о землю
  if (f.t > FALL_TIME * 0.82) {
    const b = Math.min(1, (f.t - FALL_TIME * 0.82) / 0.2);
    ang = f.dir * (END - Math.sin(b * Math.PI) * 0.07);
  }
  ctx.save();
  ctx.globalAlpha = f.t > FALL_TIME ? Math.max(0, 1 - (f.t - FALL_TIME) / 0.2) : 1;
  ctx.translate(cx, base);
  ctx.rotate(ang);
  ctx.drawImage(s, Math.round(-s.width / 2), -s.height);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ───────────── Пунктирные связи «дом / усадьба ↔ жители» ───────────── */

export function drawHoverLinks(ctx: Ctx, g: Game) {
  const bid = g.hoverBuilding?.id ?? g.selBuilding;
  if (!bid) return;
  const b = g.buildings.find((q) => q.id === bid);
  if (!b || !b.done) return;
  const def = BUILDINGS[b.type];
  let who: { id: number; x: number; y: number }[] = [];
  const est = g.soc?.estates.find((e) => e.bld === b.id);
  if (est) who = g.units.filter((u) => u.estate === est.id);
  else if (def && def.housing > 0) who = g.units.filter((u) => u.home === b.id);
  if (!who.length) return;
  const ox = (b.x + b.w / 2) * TW;
  const oy = (b.y + b.h) * TH - 5;
  const t = g.waterT;
  const col = est ? '#ffd86a' : '#9ae8ff';
  ctx.save();
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2.5, 2]);
  ctx.lineDashOffset = -t * 7;
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.85;
  const list = who.slice(0, 28);
  for (const u of list) {
    const ux = u.x * TW;
    const uy = u.y * TH - 8;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.quadraticCurveTo((ox + ux) / 2, Math.min(oy, uy) - 6 - Math.abs(ux - ox) * 0.05, ux, uy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = col;
  for (const u of list) {
    const ux = Math.round(u.x * TW);
    const uy = Math.round(u.y * TH);
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 4 + u.id);
    ctx.fillRect(ux - 3, uy, 7, 1);
    ctx.fillRect(ux - 1, uy + 1, 3, 1);
  }
  ctx.restore();
}

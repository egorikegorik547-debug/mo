/** Атмосфера: тёплые многослойные огни ночью, пыльца и пылинки днём, падающие листья в осеннем и дубовом лесу. */
import { B, BUILDINGS, TH, TW } from './data';
import type { Game } from './game';
import { lightOf, windAt } from './fx';
import { plazaLanterns } from './plaza';

type Ctx = CanvasRenderingContext2D;

function glow(ctx: Ctx, x: number, y: number, r: number, k: number) {
  if (r <= 0 || k <= 0) return;
  // оранжевое ядро → жёлтый ореол → мягкая тёплая дымка
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,150,50,${0.42 * k})`);
  gr.addColorStop(0.18, `rgba(255,168,64,${0.3 * k})`);
  gr.addColorStop(0.45, `rgba(255,205,110,${0.13 * k})`);
  gr.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Многослойное тёплое свечение от окон, костров, горнов и факелов. Вызывается в экранных координатах. */
export function drawWarmLights(ctx: Ctx, g: Game, left: number, top: number, s: number, night: number) {
  if (night < 0.04) return;
  const t = g.waterT;
  ctx.globalCompositeOperation = 'lighter';
  const flick = (id: number, sp = 9) => 0.88 + 0.12 * Math.sin(t * sp + id * 1.9) + 0.04 * Math.sin(t * 23 + id * 5.1);
  for (const b of g.buildings) {
    if (!b.done) continue;
    const d = BUILDINGS[b.type];
    const cx = (b.x + b.w / 2) * TW;
    const by = (b.y + b.h) * TH;
    if (d.light) {
      const big = b.type === 'camp' ? 1.5 : b.type === 'campfire' ? 1.05 : 1;
      glow(ctx, (cx - left) * s, (by - 0.6 * TH - top) * s, (46 + (b.type === 'camp' ? 40 : 0)) * big * s * flick(b.id), night * 0.9);
    }
    if (d.housing > 0 && b.type !== 'camp') {
      // окна жилых домов: два тёплых пятна на фасаде и дорожка света на землю
      for (const sx of [-0.27, 0.27]) {
        const wx = cx + sx * b.w * TW;
        const wy = by - 13;
        glow(ctx, (wx - left) * s, (wy - top) * s, 15 * s * flick(b.id + sx * 10, 5), night * 0.75);
        ctx.fillStyle = `rgba(255,214,120,${0.7 * night})`;
        ctx.fillRect(Math.round((wx - 1.5 - left) * s), Math.round((wy - 1 - top) * s), Math.round(3 * s), Math.round(3 * s));
      }
      const gx = (cx - left) * s;
      const gy = (by + 2 - top) * s;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18 * s);
      gr.addColorStop(0, `rgba(255,190,90,${0.2 * night})`);
      gr.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(gx - 18 * s, gy - 9 * s, 36 * s, 18 * s);
    }
    const fire = g.bspr.fire[b.type];
    if (fire && b.type !== 'camp') {
      const sp = g.bspr.cv[b.type];
      const fx = b.x * TW + (b.w * TW) / 2 - sp.width / 2 + fire.x;
      const fy = by - sp.height + fire.y;
      glow(ctx, (fx - left) * s, (fy - top - 4) * s, 34 * s * flick(b.id, 12), night);
    }
  }
  // фонари на площади
  for (const l of plazaLanterns(g)) glow(ctx, (l.x - left) * s, (l.y - 17 - top) * s, 30 * s * flick(l.tx * 7 + l.ty, 8), night * 0.8);
  // факелы жителей
  if (g.done.has('fire')) {
    for (const u of g.units) {
      if (u.sleeping || u.child) continue;
      glow(ctx, (u.x * TW + (u.dir === 3 ? -4 : 4) - left) * s, (u.y * TH - 10 - top) * s, 15 * s * flick(u.id, 11), night * 0.55);
    }
  }
  for (const u of g.guards) {
    if (u.sleeping) continue;
    glow(ctx, (u.x * TW + 4 - left) * s, (u.y * TH - 10 - top) * s, 20 * s * flick(u.id, 11), night * 0.6);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Пыльца и пылинки днём, падающие листья над осенними и дубовыми лесами. */
export function drawAirParticles(ctx: Ctx, g: Game, left: number, top: number, vw: number, vh: number) {
  const t = g.waterT;
  const day = Math.max(0, Math.min(1, (lightOf(g) - 0.35) / 0.4));
  const wd = g.world;
  const wind = windAt(g, left);
  if (day > 0.05) {
    for (let i = 0; i < 26; i++) {
      const sp = 2 + (i % 5) * 1.3 + wind * 7;
      const x = left + ((((i * 97.1 + t * sp + Math.sin(t * 0.45 + i) * 12) % (vw + 16)) + vw + 16) % (vw + 16)) - 8;
      const y = top + ((((i * 61.7 + Math.sin(t * 0.3 + i * 1.7) * 18 + t * ((i % 3) - 1) * 1.6) % vh) + vh) % vh);
      const tw = Math.sin(t * 1.4 + i * 2.3);
      const a = day * (0.12 + 0.4 * tw * tw);
      if (a < 0.05) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 4 === 0 ? '#ffe9a0' : '#fff6d8';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (i % 7 === 0 && tw > 0.8) {
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
        ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      }
    }
    ctx.globalAlpha = 1;
  }
  // листопад
  const AUT = ['#e8821e', '#c8501c', '#e8c030', '#b83a1c', '#f09a30'];
  const OAKC = ['#6cb446', '#92cc58', '#e0b038', '#4a9a4a'];
  for (let i = 0; i < 90; i++) {
    const fall = 8 + (i % 5) * 2.2;
    const y = top + ((((i * 53.7 + t * fall) % (vh + 30)) + vh + 30) % (vh + 30)) - 15;
    const x = left + ((((i * 131.3 + t * (4 + wind * 22) + Math.sin(t * 1.7 + i) * 5) % (vw + 40)) + vw + 40) % (vw + 40)) - 20 + Math.sin(t * 2.3 + i * 1.3) * 5;
    const tx = Math.floor(x / TW);
    const ty = Math.floor(y / TH);
    if (tx < 0 || ty < 0 || tx >= wd.w || ty >= wd.h) continue;
    const b = wd.biome[ty * wd.w + tx];
    let col: string | null = null;
    if (b === B.AUTUMN) col = AUT[i % AUT.length];
    else if ((b === B.OAK || b === B.BIRCH) && i % 3 === 0) col = OAKC[i % OAKC.length];
    if (!col) continue;
    const fr = Math.floor(t * 5 + i) & 3;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = col;
    if (fr === 0) ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    else if (fr === 1) {
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
      ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
    } else if (fr === 2) {
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      ctx.fillStyle = '#3a2412';
      ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
    } else {
      ctx.fillRect(Math.round(x) + 1, Math.round(y), 1, 2);
      ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

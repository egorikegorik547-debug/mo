/** Реквизит зданий — выступающие детали, по которым постройку узнаёшь с одного взгляда:
 *  лопасти мельницы, колесо лесопилки, брёвна, шкуры, стога сена и вывески с иконкой товара. */
import type { Building, Game } from './game';
import { SPEC_STYLE, ARCH } from './specbuild';
import { windAt } from './fx';

type Ctx = CanvasRenderingContext2D;

const r = (ctx: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

interface Icon {
  rows: string[];
  pal: Record<string, string>;
}

const ICONS: Record<string, Icon> = {
  gear: { rows: ['...a...', '.a.a.a.', '..aaa..', 'aaa.aaa', '..aaa..', '.a.a.a.', '...a...'], pal: { a: '#3e4252' } },
  hammer: { rows: ['aaaaa..', 'aaaaa..', '..bb...', '..bb...', '..bb...', '..bb...'], pal: { a: '#5a6078', b: '#7a4a22' } },
  anvil: { rows: ['bbbbbbb', '.aaaaaa', '..aaa..', '..aaa..', '.aaaaa.', 'aaaaaaa'], pal: { a: '#2e323e', b: '#8a90a0' } },
  coin: { rows: ['.aaaaa.', 'abbbbba', 'abbcbba', 'abbcbba', 'abbbbba', '.aaaaa.'], pal: { a: '#b87a14', b: '#f6d44a', c: '#fff2a0' } },
  book: { rows: ['aaaaaaa', 'abbbbba', 'abcccba', 'abbbbba', 'abcccba', 'aaaaaaa'], pal: { a: '#2a4e9a', b: '#f0e8cc', c: '#d8403a' } },
  sword: { rows: ['...b...', '...b...', '...b...', '...b...', '..aaa..', '...a...', '...a...'], pal: { a: '#8a5a22', b: '#d8dce8' } },
  mug: { rows: ['.bbbb..', '.aaaaa.', '.acccaa', '.acccaa', '.acccaa', '.aaaaa.'], pal: { a: '#a8702a', b: '#fff6d8', c: '#e8a020' } },
  crate: { rows: ['aaaaaaa', 'abbbbba', 'abccbba', 'abbcbba', 'abbbbba', 'aaaaaaa'], pal: { a: '#5a3a1e', b: '#a8794a', c: '#c89a64' } },
  shoe: { rows: ['a.....a', 'a.....a', 'a.....a', 'aa...aa', '.aa.aa.', '..aaa..'], pal: { a: '#6a7080' } },
  pick: { rows: ['.aaaaa.', 'a..b..a', '...b...', '...b...', '...b...', '...b...'], pal: { a: '#7a8090', b: '#7a4a22' } },
  saw: { rows: ['.a.a.a.', 'aaaaaaa', '.aabaa.', 'aabbbaa', '.aabaa.', '.a.a.a.'], pal: { a: '#aab0c0', b: '#5a6070' } },
  wheat: { rows: ['..a.a..', '.a.a.a.', '..aaa..', '...b...', '...b...', '..bbb..'], pal: { a: '#e8c040', b: '#6a8a30' } },
};

/** Какая вывеска висит над мастерской: по типу постройки или по архетипу особой постройки. */
const SIGN: Record<string, string> = {
  workshop: 'gear',
  shop: 'hammer',
  forge: 'anvil',
  smelter: 'anvil',
  foundry: 'anvil',
  factory: 'gear',
  market: 'coin',
  bank: 'coin',
  library: 'book',
  lib: 'book',
  school: 'book',
  barracks: 'sword',
  gunsmith: 'sword',
  bowyer: 'sword',
  armory: 'sword',
  siegeworks: 'gear',
  tavern: 'mug',
  storage: 'crate',
  ware: 'crate',
  stable: 'shoe',
  mine: 'pick',
  saw: 'saw',
  mill: 'wheat',
};

function drawSign(ctx: Ctx, g: Game, b: Building, dx: number, dy: number, w: number, h: number, icon: string) {
  const ic = ICONS[icon];
  if (!ic) return;
  const right = b.id % 2 === 0;
  const sway = Math.round(Math.sin(g.waterT * 1.7 + b.id * 1.3) * 0.7);
  const bx = (right ? dx + w - 3 : dx - 7) + sway;
  const by = Math.max(dy + 6, dy + h - 27);
  const poleX = right ? dx + w - 6 : dx + 1;
  // кронштейн
  r(ctx, Math.min(poleX, bx + 4), by - 2, Math.abs(poleX - (bx + 4)) + 2, 1, '#3a2438');
  r(ctx, bx + 1, by - 1, 1, 1, '#6a5a6a');
  r(ctx, bx + 7, by - 1, 1, 1, '#6a5a6a');
  // доска
  r(ctx, bx, by, 9, 9, '#4a2a34');
  r(ctx, bx + 1, by + 1, 7, 7, '#d8b078');
  r(ctx, bx + 1, by + 1, 7, 1, '#ecd0a0');
  r(ctx, bx + 1, by + 7, 7, 1, '#b08a58');
  const ox = bx + 1 + Math.floor((7 - ic.rows[0].length) / 2);
  const oy = by + 1 + Math.floor((7 - ic.rows.length) / 2);
  ic.rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const c = row[xx];
      if (c !== '.') r(ctx, ox + xx, oy + yy, 1, 1, ic.pal[c] ?? '#000');
    }
  });
  // мягкая тень под вывеской
  ctx.globalAlpha = 0.25;
  r(ctx, bx + 1, by + 9, 8, 1, '#141030');
  ctx.globalAlpha = 1;
}

function drawBlades(ctx: Ctx, g: Game, b: Building, hx: number, hy: number) {
  const wind = windAt(g, hx);
  const spin = g.waterT * (0.55 + wind * 1.1) + b.id;
  const L = 17;
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // паруса — полотно с одной стороны жерди
    for (let rr = 6; rr <= L; rr++) {
      for (let o = 1; o <= 3; o++) {
        const x = hx + c * rr - s * o;
        const y = hy + s * rr + c * o;
        r(ctx, x, y, 1, 1, o === 3 || rr === L ? '#c4b48a' : (rr + o) % 4 === 0 ? '#d8cca8' : '#f2e8cc');
      }
    }
    for (let rr = 1; rr <= L; rr++) r(ctx, hx + c * rr, hy + s * rr, 1, 1, rr % 2 ? '#7a4e26' : '#5a3818');
  }
  r(ctx, hx - 1, hy - 1, 3, 3, '#3a2818');
  r(ctx, hx, hy, 1, 1, '#c8a060');
}

function drawWheel(ctx: Ctx, g: Game, b: Building, cx: number, cy: number) {
  const spin = g.waterT * 1.6 + b.id;
  const R = 5;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    r(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1, 1, '#4a2e18');
  }
  for (let k = 0; k < 6; k++) {
    const a = spin + (k * Math.PI) / 3;
    for (let rr = 1; rr <= R; rr++) r(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1, 1, '#8a6238');
    r(ctx, cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1), 1, 1, '#c89a64');
  }
  r(ctx, cx, cy, 1, 1, '#d8aa72');
  // брызги внизу
  const f = Math.floor(g.waterT * 8 + b.id) & 3;
  r(ctx, cx - 3 + f, cy + R + 2, 1, 1, '#bfe6ff');
  r(ctx, cx + 1 - f, cy + R + 3, 1, 1, '#8ac4ea');
}

function drawLogs(ctx: Ctx, g: Game, x0: number, base: number) {
  const n = Math.max(1, Math.min(3, Math.round((g.res.wood / Math.max(1, g.capOf())) * 4)));
  for (let row = 0; row < n; row++) {
    const cnt = n + 1 - row;
    const wRow = cnt * 5;
    for (let i = 0; i < cnt; i++) {
      const x = x0 + i * 5 + (n - row) * 2 - Math.floor(wRow / 2) + 6;
      const y = base - 2 - row * 2;
      r(ctx, x, y, 5, 2, '#6a4224');
      r(ctx, x, y, 5, 1, '#9a6c3c');
      r(ctx, x + 4, y, 1, 2, '#d8aa72');
      r(ctx, x + 4, y, 1, 1, '#f0cc94');
    }
  }
  ctx.globalAlpha = 0.3;
  r(ctx, x0 + 1, base, 14, 1, '#141030');
  ctx.globalAlpha = 1;
}

function drawHides(ctx: Ctx, g: Game, b: Building, x0: number, base: number) {
  // раскладушка-сушилка: две жерди и перекладина
  const top = base - 17;
  r(ctx, x0, top, 1, 17, '#5a3a22');
  r(ctx, x0 + 11, top, 1, 17, '#5a3a22');
  r(ctx, x0 - 1, top, 14, 1, '#7a5230');
  r(ctx, x0 - 1, top + 1, 14, 1, '#3e2612');
  const cols: [string, string][] = [
    ['#c8a070', '#e0bc8a'],
    ['#a47a50', '#c09468'],
    ['#d8c4a0', '#efe0c0'],
  ];
  for (let i = 0; i < 3; i++) {
    const sw = Math.round(Math.sin(g.waterT * 1.9 + i * 1.6 + b.id) * 0.7);
    const hx = x0 + 1 + i * 4;
    const len = 8 - (i === 1 ? 2 : 0);
    r(ctx, hx + sw, top + 2, 3, len, cols[i][0]);
    r(ctx, hx + sw, top + 2, 1, len, cols[i][1]);
    r(ctx, hx + sw + 2, top + 2, 1, len, '#6a4a3a');
    r(ctx, hx + sw + (i % 2), top + 2 + len, 2, 1, cols[i][0]);
    r(ctx, hx + sw + 1, top + 4, 1, 1, '#7a5a42');
  }
  ctx.globalAlpha = 0.28;
  r(ctx, x0 - 1, base, 14, 1, '#141030');
  ctx.globalAlpha = 1;
}

function drawHay(ctx: Ctx, x: number, base: number, k: number) {
  const rows = [1, 3, 5, 7, 8, 8];
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i];
    const y = base - rows.length + i - (k ? 0 : 1);
    const x0 = x - Math.floor(w / 2);
    r(ctx, x0, y, w, 1, '#d8aa30');
    r(ctx, x0, y, Math.max(1, Math.floor(w / 3)), 1, '#f6d870');
    r(ctx, x0 + w - Math.max(1, Math.floor(w / 3)), y, Math.max(1, Math.floor(w / 3)), 1, '#9a7840');
    if (i % 2 === 1) r(ctx, x0 + 2, y, 1, 1, '#a88428');
  }
  r(ctx, x - 1, base - rows.length - 1, 3, 1, '#c89c28');
  r(ctx, x, base - rows.length - 2, 1, 1, '#f6d870');
  ctx.globalAlpha = 0.35;
  r(ctx, x - 5, base, 11, 1, '#141030');
  ctx.globalAlpha = 1;
}

/** Рисует реквизит поверх готового здания. */
export function drawProps(ctx: Ctx, g: Game, b: Building, dx: number, dy: number, w: number, h: number) {
  const ss = SPEC_STYLE[b.type];
  const arch = ss?.arch ?? b.type;
  const spec = ss?.spec;
  const base = dy + h - 2;

  if (arch === 'mill') {
    const st = ARCH.mill?.style;
    const wallH = st?.wallH ?? 24;
    drawBlades(ctx, g, b, dx + Math.round((w - 1) / 2), dy + h - 3 - wallH - 2);
  }
  if (arch === 'saw') drawWheel(ctx, g, b, dx + w - 13, dy + h - 12);

  // стопки брёвен у лесорубов
  if ((spec === 'lumber' && ['saw', 'ware', 'shop', 'lodge', 'home', 'hut'].includes(arch)) || arch === 'saw') drawLogs(ctx, g, dx + w - 8, base);
  // шкуры у охотников
  if (arch === 'lodge') drawHides(ctx, g, b, dx - 12, base);
  // стога у ферм
  if (b.type === 'farm' || ['field', 'pasture', 'granary', 'stable', 'garden'].includes(arch)) {
    drawHay(ctx, dx + w - 5, base, 0);
    if (w > 36) drawHay(ctx, dx + 6, base + 1, 1);
  }
  // вывески
  const sign = SIGN[arch] ?? SIGN[b.type];
  if (sign && h > 24) drawSign(ctx, g, b, dx, dy, w, h, sign);
}

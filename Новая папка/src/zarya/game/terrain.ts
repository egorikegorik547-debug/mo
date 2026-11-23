import { B, BIOME_MINI, TH, TW } from './data';
import { hash2, ValueNoise } from './rng';
import { mk, type Cv } from './sprites';
import type { World } from './worldgen';

const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

const PAL: string[][] = [];
PAL[B.DEEP] = ['#1a548c', '#1f6199', '#256fa8', '#2f7fb8', '#3d90c8'];
PAL[B.WATER] = ['#2c88b8', '#3898c8', '#48aad8', '#62bee6', '#86d4f2'];
PAL[B.BEACH] = ['#dccb92', '#e6d6a0', '#eee0ae', '#f4e8be', '#faf0cc'];
PAL[B.DESERT] = ['#d4b06a', '#debc76', '#e8c884', '#f0d494', '#f8e0a4'];
PAL[B.STEPPE] = ['#85833a', '#96933f', '#a6a14c', '#b8b25a', '#c9c36c'];
PAL[B.FIELD] = ['#3f8a34', '#4e9d3d', '#5fb046', '#72c24f', '#8cd45e'];
PAL[B.FSTEPPE] = ['#548f38', '#64a040', '#76b248', '#8bc352', '#a0d260'];
PAL[B.OAK] = ['#2a6428', '#347432', '#40843a', '#4e9442', '#5ea44c'];
PAL[B.BIRCH] = ['#559a3c', '#66ab44', '#78bc4e', '#8ccc58', '#a2da68'];
PAL[B.AUTUMN] = ['#667430', '#768436', '#88883a', '#9a8e40', '#ac9c4a'];
PAL[B.TAIGA] = ['#295a46', '#336a50', '#3e7a5a', '#4a8c66', '#589c74'];
PAL[B.DARK] = ['#1b3834', '#24443e', '#2d5148', '#375f54', '#426d60'];
const RGB = PAL.map((p) => p.map(hex));
// ступени глубины воды: бирюзовое мелководье → средняя глубина → глубина → тёмная бездна
const TURQ = ['#52c6c4', '#66d4cc', '#7cdfd2', '#98e8d8', '#b8f0e0'].map(hex);
const ABYSS = ['#123a6c', '#164478', '#1a4e84', '#1f5890', '#25639d'].map(hex);
const WATER_RGB = RGB[B.WATER];
const DEEP_RGB = RGB[B.DEEP];

/** Расстояние (в тайлах) от каждой клетки воды до ближайшей суши. */
function shoreField(world: World): Uint8Array {
  const { w, h, biome } = world;
  const d = new Uint8Array(w * h).fill(255);
  const q: number[] = [];
  for (let i = 0; i < w * h; i++)
    if (biome[i] > B.WATER) {
      d[i] = 0;
      q.push(i);
    }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const x = i % w;
    const y = (i / w) | 0;
    const nd = d[i] + 1;
    if (nd > 9) continue;
    if (x > 0 && d[i - 1] > nd) ((d[i - 1] = nd), q.push(i - 1));
    if (x < w - 1 && d[i + 1] > nd) ((d[i + 1] = nd), q.push(i + 1));
    if (y > 0 && d[i - w] > nd) ((d[i - w] = nd), q.push(i - w));
    if (y < h - 1 && d[i + w] > nd) ((d[i + w] = nd), q.push(i + w));
  }
  for (let i = 0; i < w * h; i++) if (d[i] === 255) d[i] = 10;
  return d;
}

export function renderTerrain(world: World): Cv {
  const { w, h, biome, seed } = world;
  const W = w * TW;
  const H = h * TH;
  const c = mk(W, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const d = img.data;
  const nA = new ValueNoise(seed + 901);
  const nB = new ValueNoise(seed + 902);
  const nD = new ValueNoise(seed + 903);

  const shore = shoreField(world);
  world.shore = shore;
  const shoreAt = (px: number, py: number) => {
    const fx = px / TW - 0.5;
    const fy = py / TH - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = fx - x0;
    const ay = fy - y0;
    const g = (x: number, y: number) => shore[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
    return (g(x0, y0) * (1 - ax) + g(x0 + 1, y0) * ax) * (1 - ay) + (g(x0, y0 + 1) * (1 - ax) + g(x0 + 1, y0 + 1) * ax) * ay;
  };

  const bAt = (px: number, py: number) => {
    const tx = px < 0 ? 0 : px >= W ? w - 1 : Math.floor(px / TW);
    const ty = py < 0 ? 0 : py >= H ? h - 1 : Math.floor(py / TH);
    return biome[ty * w + tx];
  };

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const jx = Math.floor((hash2(px >> 1, py >> 1, seed + 11) - 0.5) * 7);
      const jy = Math.floor((hash2(px >> 1, py >> 1, seed + 12) - 0.5) * 5);
      const b = bAt(px + jx, py + jy);
      const fine = hash2(px, py, seed + 13);
      let idx: number;
      let pal: number[][] | null = null;
      if (b <= B.WATER) {
        const streak = nB.at(px / 15, py / 4.2);
        const v = streak + (fine - 0.5) * 0.22;
        idx = v < 0.3 ? 0 : v < 0.46 ? 1 : v < 0.62 ? 2 : v < 0.78 ? 3 : 4;
        // ступени глубины с шахматным дизерингом на границах
        const dd = shoreAt(px, py) + (nA.at(px / 9, py / 9) - 0.5) * 0.5;
        const chk = (px + py) & 1;
        const th = [1.15, 2.1, 3.5];
        let layer = dd < th[0] ? 0 : dd < th[1] ? 1 : dd < th[2] ? 2 : 3;
        for (let k = 0; k < 3; k++) if (Math.abs(dd - th[k]) < 0.16 && chk) layer = layer === k ? k + 1 : layer === k + 1 ? k : layer;
        if (b === B.DEEP && layer < 2) layer = 2;
        pal = layer === 0 ? TURQ : layer === 1 ? WATER_RGB : layer === 2 ? DEEP_RGB : ABYSS;
      } else {
        const lf = nA.fbm(px / 20, py / 15, 2);
        const v = (lf - 0.5) * 2.4 + 0.5 + (fine - 0.5) * 0.35;
        idx = v < 0.22 ? 0 : v < 0.4 ? 1 : v < 0.7 ? 2 : v < 0.86 ? 3 : 4;
        if (b === B.DESERT) {
          const dune = Math.sin((px * 0.32 + py * 1.15) / 7 + nD.at(px / 40, py / 30) * 9);
          if (dune > 0.84) idx = 4;
          else if (dune < -0.92) idx = 0;
          else if (idx === 0 || idx === 4) idx = 2;
        }
      }
      // дизеринг на стыках биомов: шахматный переход в 2–3 пикселя
      let bUse = b;
      if (b > B.WATER && pal === null) {
        const b2 = bAt(px + 2, py);
        const b3 = bAt(px - 2, py);
        const b4 = bAt(px, py + 2);
        const b5 = bAt(px, py - 2);
        const near2 = [b2, b3, b4, b5].find((q) => q !== b && q > B.WATER);
        if (near2 !== undefined) {
          if (((px + py) & 1) === 0) bUse = near2;
        } else {
          const f2 = [bAt(px + 4, py), bAt(px - 4, py), bAt(px, py + 4), bAt(px, py - 4)].find((q) => q !== b && q > B.WATER);
          if (f2 !== undefined && ((px + py) & 1) === 0 && ((px >> 1) + (py >> 1)) % 2 === 0) bUse = f2;
        }
      }
      let col = (pal ?? RGB[bUse])[idx];
      if (b === B.WATER) {
        // пена у берега
        const near = bAt(px - 3, py) > B.WATER || bAt(px + 3, py) > B.WATER || bAt(px, py - 2) > B.WATER || bAt(px, py + 2) > B.WATER;
        if (near) {
          const hv = hash2(px, py, seed + 14);
          if (hv < 0.5) col = [236, 248, 255];
          else if (hv < 0.8) col = [176, 232, 240];
        }
      } else if (b === B.BEACH && bUse === B.BEACH) {
        const wet = bAt(px - 3, py) <= B.WATER || bAt(px + 3, py) <= B.WATER || bAt(px, py - 2) <= B.WATER || bAt(px, py + 2) <= B.WATER;
        if (wet) col = [196, 178, 124];
      }
      const o = (py * W + px) * 4;
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // ---- Декор ----
  const f = (x: number, y: number, ww: number, hh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  };
  const f2 = f;
  const tuft = (x: number, y: number, c0: string, c1: string, c2: string) => {
    f(x, y, 1, 1, c0);
    f(x - 1, y - 1, 1, 1, c1);
    f(x + 1, y - 1, 1, 1, c1);
    f(x, y - 2, 1, 2, c2);
  };
  const flower = (x: number, y: number, col: string) => {
    f(x, y, 1, 1, '#3a8a30');
    f(x, y - 1, 1, 1, col);
    f(x - 1, y - 2, 1, 1, col);
    f(x + 1, y - 2, 1, 1, col);
    f(x, y - 2, 1, 1, '#ffe46a');
    f(x, y - 3, 1, 1, col);
  };
  const FLOWERS = ['#ffffff', '#ff8ac0', '#ffd23a', '#7ab4ff', '#ff6a5a', '#c89aff'];
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const b = biome[ty * w + tx];
      if (b <= B.WATER) continue;
      const k = (n: number) => hash2(tx, ty, seed + 40 + n);
      const rx = (n: number) => tx * TW + 2 + Math.floor(k(n) * (TW - 4));
      const ry = (n: number) => ty * TH + 3 + Math.floor(k(n + 50) * (TH - 4));
      switch (b) {
        case B.FIELD:
        case B.FSTEPPE: {
          const nt = Math.floor(k(1) * (b === B.FIELD ? 4 : 3));
          for (let i = 0; i < nt; i++) tuft(rx(2 + i), ry(2 + i), '#2f7a2c', '#4a9a3a', '#7ac850');
          if (k(9) < (b === B.FIELD ? 0.2 : 0.09)) flower(rx(10), ry(10), FLOWERS[Math.floor(k(11) * FLOWERS.length)]);
          if (b === B.FIELD && nD.at(tx / 5, ty / 5) > 0.6) {
            for (let i = 0; i < 6; i++) {
              const x = tx * TW + 1 + i * 2 + (k(20 + i) < 0.5 ? 0 : 1);
              const y = ty * TH + 4 + Math.floor(k(30 + i) * 6);
              f(x, y, 1, 3, '#a8b040');
              f(x, y - 1, 1, 2, '#e8c840');
              f(x, y - 2, 1, 1, '#fff0a0');
            }
          }
          break;
        }
        case B.STEPPE: {
          const nt = Math.floor(k(1) * 3.5);
          for (let i = 0; i < nt; i++) tuft(rx(2 + i), ry(2 + i), '#6a6428', '#b8ac58', '#e4d684');
          if (k(8) < 0.22) {
            const x = rx(9);
            const y = ry(9);
            f(x, y, 1, 1, '#8a8438');
            f(x, y - 1, 1, 1, '#d8cc7c');
            f(x, y - 2, 1, 1, '#ece4a8');
            f(x + 1, y - 3, 1, 1, '#f4eec0');
            f(x + 1, y - 4, 1, 1, '#f4eec0');
          }
          if (k(12) < 0.06) {
            const x = rx(12);
            const y = ry(12);
            f(x - 2, y - 1, 5, 2, '#7a8a58');
            f(x - 1, y - 2, 3, 1, '#9aaa70');
          }
          if (k(13) < 0.05) {
            f(rx(13), ry(13), 2, 1, '#8a8a90');
          }
          break;
        }
        case B.DESERT: {
          if (k(1) < 0.3) {
            const x = rx(2);
            const y = ry(2);
            f(x, y, 2, 1, '#a88650');
            f(x, y - 1, 1, 1, '#d8c08a');
          }
          if (k(3) < 0.1) {
            const x = rx(4);
            const y = ry(4);
            f(x, y, 1, 1, '#8a6a38');
            f(x - 1, y - 1, 1, 1, '#a8864e');
            f(x + 1, y - 1, 1, 1, '#a8864e');
          }
          if (k(5) < 0.03) {
            const x = rx(5);
            const y = ry(5);
            f(x, y, 4, 1, '#efe8d4');
            f(x + 1, y - 1, 1, 1, '#efe8d4');
          }
          break;
        }
        case B.BEACH: {
          if (k(1) < 0.18) f(rx(2), ry(2), 2, 1, '#fff4e0');
          if (k(3) < 0.1) f(rx(4), ry(4), 1, 1, '#ffb0c0');
          if (k(5) < 0.12) f(rx(6), ry(6), 2, 1, '#b8a878');
          break;
        }
        case B.OAK:
        case B.BIRCH:
        case B.AUTUMN:
        case B.TAIGA:
        case B.DARK: {
          const leaf = b === B.AUTUMN ? ['#e8821e', '#c8501c', '#e8c030'] : b === B.TAIGA ? ['#6a4a30', '#8a6a44', '#4a3a28'] : b === B.DARK ? ['#1a2a28', '#102020', '#2a4a44'] : ['#2a6a2a', '#7a5a30', '#8ab04a'];
          const nl = Math.floor(k(1) * (b === B.AUTUMN ? 7 : 4));
          for (let i = 0; i < nl; i++) {
            const x = rx(2 + i);
            const y = ry(2 + i);
            if (b === B.TAIGA || b === B.DARK) f(x, y, 2, 1, leaf[Math.floor(k(20 + i) * 3)]);
            else f(x, y, 1, 1, leaf[Math.floor(k(20 + i) * 3)]);
          }
          if (k(9) < 0.4) tuft(rx(10), ry(10), '#1f5a24', '#2f7a30', '#4a9a3c');
          if (b === B.TAIGA && k(14) < 0.25) f(rx(14), ry(14), 3, 2, '#5aa078');
          if (b === B.DARK && k(15) < 0.3) f(rx(15), ry(15), 3, 2, '#2e5a50');
          if (k(16) < (b === B.DARK ? 0.05 : 0.03)) {
            const x = rx(17);
            const y = ry(17);
            if (b === B.DARK) {
              f(x, y, 1, 2, '#9ad8e8');
              f(x - 1, y - 1, 3, 1, '#4ab8e0');
              f(x, y - 1, 1, 1, '#c8f4ff');
            } else {
              f(x, y, 1, 2, '#efe4c8');
              f(x - 1, y - 1, 3, 1, '#d8402a');
              f(x, y - 1, 1, 1, '#ffffff');
            }
          }
          if (b === B.OAK || b === B.BIRCH) {
            if (k(18) < 0.07) flower(rx(19), ry(19), FLOWERS[Math.floor(k(21) * FLOWERS.length)]);
          }
          break;
        }
      }
    }
  }

  /* ---- Стыки биомов: пучки травы и камушки поверх шва ---- */
  const GRASSY = new Set<number>([B.FIELD, B.FSTEPPE, B.OAK, B.BIRCH, B.AUTUMN, B.TAIGA, B.DARK]);
  const pebble = (x: number, y: number) => {
    f(x, y, 2, 1, '#9a9aa4');
    f(x, y - 1, 1, 1, '#c6c6d0');
    f(x + 1, y + 1, 1, 1, '#5a5a6a');
  };
  for (let ty = 1; ty < h - 1; ty++) {
    for (let tx = 1; tx < w - 1; tx++) {
      const b = biome[ty * w + tx];
      if (b <= B.WATER) continue;
      for (let side = 0; side < 2; side++) {
        const nx = tx + (side === 0 ? 1 : 0);
        const ny = ty + (side === 1 ? 1 : 0);
        const b2 = biome[ny * w + nx];
        if (b2 === b || b2 <= B.WATER) continue;
        const hh = hash2(tx * 2 + side, ty, seed + 610);
        if (hh > 0.62) continue;
        const along = Math.floor(hash2(tx, ty * 2 + side, seed + 611) * (side === 0 ? TH - 4 : TW - 4)) + 2;
        const sx = side === 0 ? (tx + 1) * TW + Math.floor((hash2(tx, ty, seed + 612) - 0.5) * 4) : tx * TW + along;
        const sy = side === 0 ? ty * TH + along : (ty + 1) * TH + Math.floor((hash2(tx, ty, seed + 613) - 0.5) * 3);
        const gb = GRASSY.has(b) ? b : GRASSY.has(b2) ? b2 : -1;
        const sandy = b === B.BEACH || b2 === B.BEACH || b === B.DESERT || b2 === B.DESERT || b === B.STEPPE || b2 === B.STEPPE;
        if (gb >= 0 && hh < 0.4) {
          const c = RGB[gb];
          const col = (i: number) => `rgb(${c[i][0]},${c[i][1]},${c[i][2]})`;
          tuft(sx, sy, col(0), col(3), col(4));
          if (hh < 0.18) tuft(sx + 2, sy + 1, col(0), col(2), col(4));
        } else if (sandy) pebble(sx, sy);
        else if (gb >= 0) tuft(sx, sy, '#2f7a2c', '#4a9a3a', '#7ac850');
      }
    }
  }

  /* ---- Отражения берега в воде ---- */
  for (let ty = 1; ty < h - 1; ty++) {
    for (let tx = 1; tx < w - 1; tx++) {
      const b = biome[ty * w + tx];
      if (b > B.WATER) continue;
      const nb = biome[(ty - 1) * w + tx];
      if (nb <= B.WATER) continue;
      const o = world.objs[(ty - 1) * w + tx];
      const tree = o && (o.kind === 'tree' || o.kind === 'palm');
      const base = hex(BIOME_MINI[nb]);
      const rows = tree ? 5 : 3;
      for (let r = 0; r < rows; r++) {
        const a = (tree ? 0.34 : 0.2) * (1 - r / (rows + 1));
        const col = tree ? `rgba(14,52,44,${a})` : `rgba(${base[0]},${base[1]},${base[2]},${a})`;
        const wob = Math.round(Math.sin(r * 1.7 + tx * 2.1) * 1.4);
        const x0 = tx * TW + 2 + wob;
        f2(x0, ty * TH + 1 + r * 2, TW - 5, 1, col);
      }
    }
  }

  /* ---- Рельеф: плато, уступы и лестницы ---- */
  const hi = world.high;
  const cl = world.cliff;
  for (let ty = 1; ty < h - 1; ty++) {
    for (let tx = 1; tx < w - 1; tx++) {
      const i = ty * w + tx;
      if (hi[i] > 0 && !cl[i]) f2(tx * TW, ty * TH, TW, TH, `rgba(255,244,190,${0.07 + hi[i] * 0.05})`);
    }
  }
  const STONE = ['#454a5e', '#5c6379', '#7a8196', '#9aa1b6', '#bcc3d4'];
  for (let ty = 1; ty < h - 1; ty++) {
    for (let tx = 1; tx < w - 1; tx++) {
      const i = ty * w + tx;
      const c = cl[i];
      if (!c) continue;
      const X = tx * TW;
      const Y = ty * TH;
      const b = biome[i];
      const gc = RGB[b > B.WATER ? b : B.FIELD];
      const lipHi = `rgb(${Math.min(255, gc[4][0] + 14)},${Math.min(255, gc[4][1] + 14)},${Math.min(255, gc[4][2] + 8)})`;
      const lipLo = `rgb(${gc[2][0]},${gc[2][1]},${gc[2][2]})`;
      if (c === 1) {
        // трава наверху (выступает неровным краем)
        f2(X, Y, TW, 3, lipHi);
        for (let x = 0; x < TW; x++) {
          const hz = hash2(tx * 16 + x, ty, seed + 620);
          if (hz < 0.5) f2(X + x, Y + 2, 1, 1, lipLo);
          if (hz < 0.18) f2(X + x, Y + 3, 1, 1, lipLo);
        }
        // каменная стенка с «кладкой»
        for (let y = 3; y < TH; y++) {
          for (let x = 0; x < TW; x++) {
            const row = Math.floor((y - 3) / 3);
            const brick = (x + (row % 2) * 4 + Math.floor(hash2(tx, row + ty * 7, seed + 621) * 4)) % 8 === 0;
            let k = 2;
            if ((y - 3) % 3 === 0) k = 3;
            else if ((y - 3) % 3 === 2) k = 1;
            if (brick) k = 1;
            if (x === 0) k = Math.min(4, k + 1);
            if (x === TW - 1) k = Math.max(0, k - 1);
            if (y >= TH - 2) k = Math.max(0, k - 1);
            if (hash2(tx * 16 + x, ty * 12 + y, seed + 622) < 0.07) k = Math.max(0, k - 1);
            f2(X + x, Y + y, 1, 1, STONE[k]);
          }
        }
        // сползшие камни у подножия
        if (hash2(tx, ty, seed + 623) < 0.5) {
          f2(X + 3 + Math.floor(hash2(tx, ty, seed + 624) * 8), Y + TH - 1, 3, 1, STONE[3]);
          f2(X + 4 + Math.floor(hash2(tx, ty, seed + 624) * 8), Y + TH - 2, 1, 1, STONE[4]);
        }
      } else {
        // лестница: ступени между двумя ярусами
        f2(X, Y, TW, TH, `rgb(${gc[1][0]},${gc[1][1]},${gc[1][2]})`);
        f2(X, Y, TW, 2, lipHi);
        for (let st = 0; st < 3; st++) {
          const y0 = Y + 2 + st * 3;
          f2(X + 3, y0, TW - 6, 1, '#d2c8b0');
          f2(X + 3, y0 + 1, TW - 6, 1, '#a89c84');
          f2(X + 3, y0 + 2, TW - 6, 1, '#6e6454');
        }
        f2(X + 1, Y + 2, 2, TH - 2, STONE[2]);
        f2(X + 1, Y + 2, 1, TH - 2, STONE[3]);
        f2(X + TW - 3, Y + 2, 2, TH - 2, STONE[1]);
        f2(X + TW - 2, Y + 2, 1, TH - 2, STONE[0]);
      }
      // ступенчатая тень на землю под уступом
      if (cl[i + w] === 0) {
        const sh = [0.34, 0.2, 0.09];
        for (let r = 0; r < 3; r++) {
          for (let x = 0; x < TW; x++) {
            if (r === 2 && (x & 1)) continue;
            f2(X + x, Y + TH + r, 1, 1, `rgba(24,18,70,${sh[r] * (c === 2 ? 0.55 : 1)})`);
          }
        }
      }
    }
  }
  return c;
}

export function renderMinimap(world: World): Cv {
  const { w, h, biome } = world;
  const c = mk(w, h);
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      g.fillStyle = BIOME_MINI[biome[y * w + x]];
      g.fillRect(x, y, 1, 1);
      const o = world.objs[y * w + x];
      if (o && o.kind === 'tree') {
        g.fillStyle = 'rgba(0,30,10,0.28)';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

/* ---------- Декор природы: камыш, кувшинки, стайки рыб, замшелые валуны, грибные полянки ---------- */

export const DECOR = { NONE: 0, REED: 1, LILY: 2, BOULDER: 3, MUSHROOM: 4, FISH: 5 } as const;
const decorCache = new WeakMap<object, Uint8Array>();

/** Карта декора по тайлам (детерминированно от карты мира). Рисуется в nature.ts. */
export function natureDecor(world: World): Uint8Array {
  const cached = decorCache.get(world.biome);
  if (cached) return cached;
  const { w, h, biome } = world;
  if (!world.shore) world.shore = shoreField(world);
  const shore = world.shore;
  const d = new Uint8Array(w * h);
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && biome[y * w + x] <= B.WATER;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const b = biome[i];
      const hh = hash2(x, y, 501);
      if (b > B.WATER) {
        const nearWater = isWater(x - 1, y) || isWater(x + 1, y) || isWater(x, y - 1) || isWater(x, y + 1);
        if (nearWater && b !== B.DESERT && hh < 0.6) {
          d[i] = DECOR.REED;
          continue;
        }
        const forest = b >= B.OAK && b <= B.DARK;
        if (forest) {
          // «поляны»: грибы собираются в пятна по крупной сетке
          const glade = hash2(x >> 3, y >> 3, 502) < 0.2;
          if (glade && hh < 0.07) d[i] = DECOR.MUSHROOM;
          else if (hash2(x, y, 503) < 0.012) d[i] = DECOR.BOULDER;
        } else if ((b === B.FSTEPPE || b === B.STEPPE || b === B.FIELD) && hash2(x, y, 504) < 0.0035) {
          d[i] = DECOR.BOULDER;
        }
      } else if (b === B.WATER) {
        const s = shore[i];
        if (s === 1 && hh < 0.3 && hash2(x >> 1, y >> 1, 505) < 0.7) d[i] = DECOR.LILY;
        else if (s >= 2 && s <= 6 && hash2(x >> 2, y >> 2, 506) < 0.2 && hh < 0.12 && isWater(x - 1, y) && isWater(x + 1, y) && isWater(x, y - 1) && isWater(x, y + 1)) d[i] = DECOR.FISH;
      }
    }
  }
  decorCache.set(world.biome, d);
  return d;
}

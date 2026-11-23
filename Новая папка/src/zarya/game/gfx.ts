/**
 * Общий «художественный» проход по спрайтам:
 *  1. Selective outlining — глухие тёмные контуры перекрашиваются в тёмный оттенок материала
 *     (синий для стали и камня, зелёный для листвы, бордовый для кожи, дерева и одежды).
 *  2. Hue shifting — тени уходят в холодный сине-фиолетовый, блики — в тёплый жёлто-оранжевый.
 *  3. Ambient occlusion — тёмная полоска в 1–2 пикселя у самого основания объекта.
 */
import { mk, type Cv } from './sprites';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (mx === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Цвет контура для заданного цвета материала (Selective Outlining). */
export function selColor(r: number, g: number, b: number): RGB {
  const [h, s, l] = rgbToHsl(r, g, b);
  const nl = Math.max(0.12, Math.min(0.3, l * 0.5));
  let th: number;
  let ts: number;
  if (s < 0.2 || (h >= 185 && h <= 270)) {
    // сталь, камень, вода, ткань — тёмно-синий
    th = 226;
    ts = 0.42;
  } else if (h >= 62 && h < 185) {
    // листва — тёмно-зелёный
    th = 148;
    ts = 0.5;
  } else {
    // кожа, дерево, одежда — тёплый бордовый
    th = 348;
    ts = 0.4;
  }
  // оттенок материала сохраняем наполовину — контур остаётся «родным»
  let dh = th - h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const hh = h + dh * 0.6;
  return hslToRgb(hh, Math.min(0.75, s * 0.45 + ts * 0.6), nl);
}

export function selHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [R, G, B] = selColor(r, g, b);
  return rgbToHex(R, G, B);
}

/** Затемнение/осветление со сдвигом оттенка: тени — в сине-фиолетовый, свет — в тёплый. */
export function shadeHue(hex: string, k: number): string {
  const [r0, g0, b0] = hexToRgb(hex);
  let r = r0 * k;
  let g = g0 * k;
  let b = b0 * k;
  const a = Math.min(1, Math.abs(1 - k) * 1.6);
  if (k < 1) {
    const t = a * 0.3;
    r += (58 * k - r) * t;
    g += (46 * k - g) * t;
    b += (128 * k - b) * t;
  } else if (k > 1) {
    const t = a * 0.26;
    r += (255 - r) * t;
    g += (212 - g) * t;
    b += (112 - b) * t;
  }
  return rgbToHex(r, g, b);
}

export interface FinishOpts {
  /** перекрасить тёмные контуры */
  selout?: boolean;
  /** сдвиг оттенка теней и бликов */
  grade?: boolean;
  /** контактная тень у основания */
  ao?: boolean;
  /** сила контактной тени */
  aoK?: number;
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function finishSprite(src: Cv, o: FinishOpts = {}): Cv {
  const { selout = true, grade = true, ao = true, aoK = 1 } = o;
  const w = src.width;
  const h = src.height;
  const g = src.getContext('2d')!;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const isDark = (x: number, y: number) => {
    if (A(x, y) < 200) return false;
    const i = (y * w + x) * 4;
    return luma(d[i], d[i + 1], d[i + 2]) < 66;
  };
  const out = new Uint8ClampedArray(d);

  if (selout) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isDark(x, y)) continue;
        // ищем ближайший «светлый» материал вокруг
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (A(xx, yy) < 200 || isDark(xx, yy)) continue;
            const i = (yy * w + xx) * 4;
            const wt = 3 - Math.max(Math.abs(dx), Math.abs(dy));
            sr += d[i] * wt;
            sg += d[i + 1] * wt;
            sb += d[i + 2] * wt;
            n += wt;
          }
        const i = (y * w + x) * 4;
        if (n === 0) {
          // одинокий тёмный пиксель (дверной проём, окно) — только холодный оттенок
          out[i] = Math.min(255, d[i] * 0.9 + 4);
          out[i + 1] = Math.min(255, d[i + 1] * 0.92 + 3);
          out[i + 2] = Math.min(255, d[i + 2] * 1.05 + 18);
          continue;
        }
        const [r, gg, b] = selColor(sr / n, sg / n, sb / n);
        out[i] = r;
        out[i + 1] = gg;
        out[i + 2] = b;
      }
    }
  }

  if (grade) {
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] < 200) continue;
      const r = out[i];
      const gg = out[i + 1];
      const b = out[i + 2];
      const L = luma(r, gg, b) / 255;
      if (L < 0.4) {
        const t = ((0.4 - L) / 0.4) * 0.24;
        out[i] = r + (r * 0.55 + 30 - r) * t;
        out[i + 1] = gg + (gg * 0.6 + 22 - gg) * t;
        out[i + 2] = b + (b * 1.1 + 70 - b) * t;
      } else if (L > 0.62) {
        const t = ((L - 0.62) / 0.38) * 0.22;
        out[i] = r + (255 - r) * t;
        out[i + 1] = gg + (222 - gg) * t;
        out[i + 2] = b + (130 - b) * t;
      }
    }
  }

  if (ao) {
    // нижняя граница непрозрачной части в каждой колонке
    const low = new Int16Array(w).fill(-1);
    let maxLow = -1;
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) {
        if (out[(y * w + x) * 4 + 3] >= 200) {
          low[x] = y;
          if (y > maxLow) maxLow = y;
          break;
        }
      }
    }
    const mixPx = (x: number, y: number, k: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (out[i + 3] < 200) return;
      out[i] += (22 - out[i]) * k;
      out[i + 1] += (18 - out[i + 1]) * k;
      out[i + 2] += (58 - out[i + 2]) * k;
    };
    for (let x = 0; x < w; x++) {
      const y = low[x];
      if (y < 0 || y < maxLow - 2) continue;
      mixPx(x, y, 0.34 * aoK);
      mixPx(x, y - 1, 0.18 * aoK);
      // полоска на землю под основанием
      const gy = y + 1;
      if (gy < h) {
        const i = (gy * w + x) * 4;
        if (out[i + 3] < 120) {
          const a0 = out[i + 3];
          const na = Math.min(255, Math.max(a0, 96 * aoK));
          out[i] = 14;
          out[i + 1] = 12;
          out[i + 2] = 40;
          out[i + 3] = na;
        }
      }
    }
  }

  img.data.set(out);
  const res = mk(w, h);
  res.getContext('2d')!.putImageData(img, 0, 0);
  return res;
}

/** Дешёвый общий «прогон» палитры без контуров (для иконок на HUD и т.п.). */
export function hueGradeOnly(src: Cv): Cv {
  return finishSprite(src, { selout: false, ao: false, grade: true });
}

/* Процедурный звуковой движок: эффекты, окружение и эволюционирующая музыка на Web Audio (без внешних файлов). */

export type Sfx =
  | 'click' | 'select' | 'chop' | 'mine' | 'gather' | 'hammer' | 'drop' | 'coin' | 'place' | 'built' | 'research'
  | 'birth' | 'warn' | 'alarm' | 'horn' | 'battle' | 'victory' | 'defeat' | 'fanfare' | 'train' | 'tier'
  | 'cart' | 'freeze' | 'parchment' | 'mystic' | 'treefall';
export type MusicMode = 'menu' | 'game' | 'war' | null;

/** Контекст музыки: ранг поселения, прогресс эпох и специализация игрока */
export interface MusicOpts {
  tier?: number;
  epoch?: number;
  spec?: string;
}
/** Окружение для живого звукового фона */
export interface AmbEnv {
  /** 0 весна, 1 лето, 2 осень, 3 зима */
  season?: number;
  rain?: number;
  zoom?: number;
  forge?: boolean;
  market?: boolean;
}

const MIN_GAP: Partial<Record<Sfx, number>> = {
  chop: 0.09, mine: 0.09, gather: 0.15, hammer: 0.12, drop: 0.08, coin: 0.08, click: 0.03, select: 0.05,
  treefall: 0.18, cart: 0.9, freeze: 3, parchment: 0.5, mystic: 2,
};
const SCALES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
type ScaleName = keyof typeof SCALES;

/** Лад по специализации: мирные — эолийский, ремесло и торг — дорийский, воины и шахтёры — фригийский */
const SPEC_SCALE: Record<string, ScaleName> = {
  farmer: 'aeolian', lumber: 'aeolian', sage: 'aeolian',
  trader: 'dorian', smith: 'dorian', factory: 'dorian',
  warrior: 'phrygian', miner: 'phrygian',
};
const SPEC_ROOT: Record<string, number> = { farmer: 45, lumber: 43, sage: 50, trader: 48, smith: 47, factory: 46, warrior: 46, miner: 41 };
const SPEC_BPM: Record<string, number> = { farmer: 0, lumber: -2, sage: -4, trader: 4, smith: 2, factory: 6, warrior: 8, miner: -2 };

interface MusicCfg {
  bpm: number;
  root: number;
  scale: number[];
  scaleName: ScaleName;
  prog: number[];
  /** 0 нет, 1 лёгкие, 2 боевые, 3 минималистичный бубен */
  drums: 0 | 1 | 2 | 3;
  melody: number;
  lute: number;
  pad: number;
  brass: boolean;
  /** 0 нет, 1 корневая нота, 2 «шагающий» бас */
  bass: 0 | 1 | 2;
  horn: number;
  reed: number;
  timp: boolean;
  stage: number;
}
const CFG: Record<'menu' | 'game' | 'war', MusicCfg> = {
  menu: { bpm: 68, root: 50, scale: SCALES.aeolian, scaleName: 'aeolian', prog: [0, 6, 5, 6, 0, 3, 5, 6], drums: 1, melody: 0.85, lute: 1, pad: 1, brass: false, bass: 1, horn: 0, reed: 0, timp: false, stage: 0 },
  game: { bpm: 56, root: 45, scale: SCALES.aeolian, scaleName: 'aeolian', prog: [0, 5, 2, 6, 0, 3, 5, 4], drums: 0, melody: 0.5, lute: 0.7, pad: 1, brass: false, bass: 1, horn: 0, reed: 0, timp: false, stage: 0 },
  war: { bpm: 94, root: 50, scale: SCALES.phrygian, scaleName: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 3, 6], drums: 2, melody: 0.35, lute: 0.5, pad: 0.8, brass: true, bass: 2, horn: 0, reed: 0, timp: true, stage: 0 },
};
/** Три разных прогрессии под лады, чтобы специализации звучали по-разному */
const PROGS: Record<ScaleName, number[]> = {
  aeolian: [0, 5, 2, 6, 0, 3, 5, 4],
  dorian: [0, 3, 0, 4, 1, 3, 4, 0],
  phrygian: [0, 1, 0, 6, 0, 1, 3, 6],
};

/** Стадия 0..5 из ранга поселения и прогресса эпох */
function stageOf(o: MusicOpts): number {
  const a = Math.min(1, (o.epoch ?? 0) / 9);
  const b = Math.min(1, (o.tier ?? 0) / 7);
  const lvl = Math.max(a, b) * 0.6 + Math.min(a, b) * 0.4;
  return Math.max(0, Math.min(5, Math.floor(lvl * 5.99)));
}

function buildCfg(mode: 'menu' | 'game' | 'war', o: MusicOpts): MusicCfg {
  const st = stageOf(o);
  const spec = o.spec ?? 'farmer';
  const c: MusicCfg = { ...CFG[mode], stage: st };
  if (mode === 'menu') return c;
  const sn: ScaleName = mode === 'war' ? 'phrygian' : SPEC_SCALE[spec] ?? 'aeolian';
  c.scaleName = sn;
  c.scale = SCALES[sn];
  c.root = SPEC_ROOT[spec] ?? 45;
  c.bpm += SPEC_BPM[spec] ?? 0;
  if (mode === 'game') {
    c.prog = PROGS[sn];
    // эволюция: барабан, лютня, флейта → бас → пэд и тростник → духовые → полный оркестр
    c.drums = st <= 1 ? 3 : 1;
    c.lute = st <= 1 ? 0.8 : 0.7;
    c.pad = [0, 0.45, 0.8, 1, 1.1, 1.2][st];
    c.bass = st === 0 ? 0 : st <= 2 ? 1 : 2;
    c.reed = st >= 2 ? [0, 0, 0.5, 0.7, 1, 1][st] : 0;
    c.horn = st >= 3 ? [0, 0, 0, 0.5, 0.8, 1][st] : 0;
    c.timp = st >= 5;
    c.melody = [0.5, 0.55, 0.6, 0.6, 0.65, 0.7][st];
    c.bpm += st * 2;
  } else {
    c.prog = PROGS.phrygian;
    c.horn = 0.6 + st * 0.08;
    c.reed = st >= 3 ? 0.6 : 0;
  }
  return c;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  alarmBus!: GainNode;
  verb!: ConvolverNode;
  verbSend!: GainNode;
  noiseBuf!: AudioBuffer;
  musicVol = 0.55;
  sfxVol = 0.8;
  mode: MusicMode = null;
  private cfg: MusicCfg = CFG.menu;
  private themeKey = '';
  private lastOpts: MusicOpts = {};
  private themeBus: GainNode | null = null;
  private last: Partial<Record<Sfx, number>> = {};
  private timer = 0;
  private nextT = 0;
  private step = 0;
  private melodyQ: { t: number; midi: number; dur: number }[] = [];
  private birdT = 3;
  private cricketT = 0;
  private owlT = 12;
  private wolfT = 40;
  private forgeT = 2;
  private chatT = 1;
  private ambOn = false;
  /** тревога: целевая и текущая интенсивность 0..1, время следующего удара */
  private alarmTarget = 0;
  private alarmK = 0;
  private alarmNext = 0;
  private alarmBeat = 0;
  private rainG: GainNode | null = null;
  private rainG2: GainNode | null = null;
  private windG: GainNode | null = null;
  private humG: GainNode | null = null;

  dispose() {
    window.clearInterval(this.timer);
  }

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem('dq11.audio') || '{}');
      if (typeof s.m === 'number') this.musicVol = s.m;
      if (typeof s.s === 'number') this.sfxVol = s.s;
    } catch {
      /* ignore */
    }
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** вызывается по жесту пользователя */
  unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  private init() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3.5;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.alarmBus = ctx.createGain();
    this.alarmBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.alarmBus.connect(this.master);
    this.applyVol();
    // шум
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // реверб
    const rl = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < rl; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.55;
    this.verb.connect(this.verbSend);
    this.verbSend.connect(this.master);
    this.startAmbience();
    this.timer = window.setInterval(() => this.schedule(), 90);
    this.nextT = ctx.currentTime + 0.2;
    // если режим музыки был задан до разблокировки звука — запустить тему сейчас
    if (this.mode) {
      const m = this.mode;
      this.mode = null;
      this.music(m, this.lastOpts);
    }
  }

  setVolumes(m: number, s: number) {
    this.musicVol = m;
    this.sfxVol = s;
    this.applyVol();
    try {
      localStorage.setItem('dq11.audio', JSON.stringify({ m, s }));
    } catch {
      /* ignore */
    }
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.sfxVol * (this.ambOn ? 0.9 : 0), t, 0.6);
  }

  /* ---------- Примитивы ---------- */

  private env(g: GainNode, t: number, peak: number, att: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, att: number, out: AudioNode, send = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, att, dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    if (send > 0) this.sendVerb(g, send);
    src.start(t, Math.random() * 1.5, att + dur + 0.05);
  }

  private osc(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, att: number, out: AudioNode, send = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, att, dur);
    o.connect(g);
    g.connect(out);
    if (send > 0) this.sendVerb(g, send);
    o.start(t);
    o.stop(t + att + dur + 0.05);
  }

  private sendVerb(src: AudioNode, amt: number) {
    const s = this.ctx!.createGain();
    s.gain.value = amt;
    src.connect(s);
    s.connect(this.verb);
  }

  private bell(t: number, f: number, peak: number, dec: number, out: AudioNode, send = 0.5) {
    const parts = [
      [1, 1],
      [2.0, 0.5],
      [2.76, 0.38],
      [4.07, 0.2],
      [5.4, 0.12],
    ];
    for (const [r, a] of parts) this.osc(t, 'sine', f * r, f * r, dec / (0.7 + r * 0.3), peak * a, 0.003, out, send);
  }

  private brass(t: number, f: number, dur: number, peak: number, out: AudioNode, send = 0.35) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.exponentialRampToValueAtTime(2000, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    g.gain.setValueAtTime(peak, t + Math.max(0.07, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    lp.connect(g);
    g.connect(out);
    this.sendVerb(g, send);
  }

  /* ---------- Эффекты ---------- */

  /** lp — частота low-pass (Гц): чем дальше источник от камеры, тем глуше звук */
  play(name: Sfx, opts: { vol?: number; pan?: number; lp?: number } = {}) {
    if (!this.ctx || !this.running || this.sfxVol <= 0) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.05;
    if (this.last[name] !== undefined && now - this.last[name]! < gap) return;
    this.last[name] = now;
    const out = ctx.createGain();
    out.gain.value = opts.vol ?? 1;
    let node: AudioNode = out;
    if (opts.lp !== undefined && opts.lp < 17000) {
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = Math.max(500, opts.lp);
      lpf.Q.value = 0.5;
      out.connect(lpf);
      node = lpf;
    }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));
      node.connect(p);
      node = p;
    }
    node.connect(this.sfxBus);
    const t = now + 0.005;
    const pv = 0.9 + Math.random() * 0.25;
    switch (name) {
      case 'chop':
        this.thock(t, pv, out, 1);
        this.noise(t + 0.07, 0.07, 'bandpass', 1400 * pv, 1, 0.12, 0.004, out);
        break;
      case 'hammer':
        this.thock(t, pv * 1.35, out, 0.7);
        this.osc(t, 'sine', 2100 * pv, 2100 * pv, 0.12, 0.05, 0.002, out);
        this.thock(t + 0.12, pv * 1.45, out, 0.55);
        break;
      case 'mine':
        this.noise(t, 0.04, 'highpass', 3200, 0.7, 0.45, 0.001, out);
        this.osc(t, 'sine', 1700 * pv, 1700 * pv, 0.28, 0.22, 0.001, out, 0.15);
        this.osc(t, 'sine', 2650 * pv, 2650 * pv, 0.18, 0.12, 0.001, out, 0.15);
        this.osc(t, 'sine', 140, 70, 0.1, 0.35, 0.002, out);
        break;
      case 'gather':
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.06, 0.07, 'bandpass', 2600 + Math.random() * 1500, 0.8, 0.16, 0.012, out);
        break;
      case 'drop':
        this.osc(t, 'sine', 120, 55, 0.14, 0.5, 0.002, out);
        this.noise(t, 0.09, 'lowpass', 520, 0.8, 0.3, 0.003, out);
        break;
      case 'coin':
        this.osc(t, 'sine', 2093, 2093, 0.3, 0.16, 0.002, out, 0.3);
        this.osc(t + 0.07, 'sine', 3136, 3136, 0.45, 0.14, 0.002, out, 0.3);
        break;
      case 'click':
        this.noise(t, 0.015, 'highpass', 1800, 0.7, 0.12, 0.001, out);
        this.osc(t, 'sine', 950, 620, 0.03, 0.09, 0.001, out);
        break;
      case 'select':
        this.osc(t, 'triangle', 1320, 1100, 0.04, 0.07, 0.001, out);
        break;
      case 'place':
        this.thock(t, 0.85, out, 0.9);
        this.thock(t + 0.09, 0.75, out, 0.7);
        break;
      case 'built':
        this.thock(t, 1.1, out, 0.7);
        [659, 880, 1318].forEach((f, i) => this.bell(t + 0.12 + i * 0.12, f, 0.2, 1.4, out, 0.5));
        break;
      case 'research':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.bell(t + i * 0.11, f, 0.18, 1.8, out, 0.7));
        break;
      case 'birth':
        this.bell(t, 880, 0.14, 1.2, out, 0.6);
        this.bell(t + 0.14, 1175, 0.12, 1.4, out, 0.6);
        break;
      case 'warn':
        this.osc(t, 'triangle', 262, 233, 0.16, 0.25, 0.01, out);
        this.osc(t + 0.17, 'triangle', 220, 196, 0.22, 0.25, 0.01, out);
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) {
          this.bell(t + i * 0.32, 392, 0.25, 0.9, out, 0.4);
          this.noise(t + i * 0.32, 0.05, 'highpass', 2500, 1, 0.2, 0.001, out);
        }
        break;
      case 'horn':
        this.brass(t, 98, 1.3, 0.34, out, 0.5);
        this.brass(t + 1.1, 147, 1.0, 0.3, out, 0.5);
        this.osc(t + 0.01, 'sine', 70, 55, 0.5, 0.5, 0.01, out);
        break;
      case 'battle':
        this.osc(t, 'sine', 80, 45, 0.4, 0.6, 0.003, out);
        this.noise(t, 1.6, 'bandpass', 700, 0.5, 0.1, 0.5, out, 0.2);
        for (let i = 0; i < 12; i++) {
          const tt = t + 0.05 + i * 0.13 + Math.random() * 0.08;
          this.noise(tt, 0.1, 'bandpass', 2000 + Math.random() * 2500, 1.4, 0.35, 0.001, out, 0.12);
          this.osc(tt, 'sine', 1200 + Math.random() * 2600, 1200 + Math.random() * 2600, 0.18, 0.1, 0.001, out, 0.15);
          if (i % 3 === 0) this.thock(tt + 0.03, 0.6, out, 0.6);
        }
        break;
      case 'victory':
        [392, 494, 587, 784].forEach((f, i) => this.brass(t + i * 0.2, f, i === 3 ? 1.2 : 0.22, 0.2, out, 0.5));
        break;
      case 'defeat':
        [220, 196, 165, 131].forEach((f, i) => this.brass(t + i * 0.45, f, 0.5, 0.18, out, 0.6));
        break;
      case 'fanfare':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.brass(t + i * 0.14, f, i === 4 ? 1.3 : 0.18, 0.17, out, 0.55));
        this.bell(t + 0.7, 1046, 0.2, 2.2, out, 0.7);
        break;
      case 'tier':
        [523, 659, 784].forEach((f, i) => this.brass(t + i * 0.16, f, i === 2 ? 0.9 : 0.15, 0.15, out, 0.5));
        [1046, 1318].forEach((f, i) => this.bell(t + 0.45 + i * 0.12, f, 0.16, 1.8, out, 0.7));
        break;
      case 'train':
        this.noise(t, 0.28, 'highpass', 4000, 0.6, 0.18, 0.12, out);
        this.noise(t + 0.3, 0.05, 'highpass', 3000, 1, 0.4, 0.001, out);
        this.osc(t + 0.3, 'sine', 2400, 2400, 0.4, 0.15, 0.001, out, 0.2);
        break;
      case 'cart': {
        // выезд каравана: скрип колёс, топот копыт и бубенец упряжи
        this.noise(t, 1.1, 'bandpass', 210, 1.4, 0.2, 0.25, out);
        this.osc(t + 0.05, 'sawtooth', 190 * pv, 150 * pv, 0.5, 0.035, 0.12, out);
        this.osc(t + 0.5, 'sawtooth', 160 * pv, 210 * pv, 0.35, 0.03, 0.1, out);
        const pat = [0, 0.15, 0.33, 0.48, 0.66, 0.81, 0.99, 1.14];
        pat.forEach((o, i) => {
          const k = i % 2 ? 0.7 : 1;
          this.noise(t + o, 0.05, 'bandpass', 1500 * pv * (i % 2 ? 0.85 : 1), 1.2, 0.5 * k, 0.001, out);
          this.osc(t + o, 'sine', 190 * pv, 100, 0.07, 0.34 * k, 0.001, out);
        });
        for (let i = 0; i < 5; i++) this.osc(t + 0.1 + i * 0.21, 'sine', 3900 + (i % 2) * 520, 3900 + (i % 2) * 520, 0.16, 0.04, 0.002, out, 0.3);
        break;
      }
      case 'freeze': {
        // замерзание воды: хруст льда, стеклянный перезвон и глухой треск
        this.osc(t, 'sine', 420, 80, 0.5, 0.45, 0.004, out, 0.4);
        this.noise(t, 0.35, 'lowpass', 450, 0.8, 0.35, 0.01, out, 0.3);
        for (let i = 0; i < 16; i++) this.noise(t + 0.05 + Math.random() * 1.5, 0.012 + Math.random() * 0.02, 'highpass', 3500 + Math.random() * 4500, 1.2, 0.2 + Math.random() * 0.3, 0.001, out, 0.15);
        [2093, 2637, 3136, 3951].forEach((f, i) => this.bell(t + 0.12 + i * 0.1, f, 0.075, 1.8, out, 0.8));
        this.noise(t + 0.2, 1.3, 'highpass', 6500, 0.6, 0.05, 0.5, out, 0.4);
        break;
      }
      case 'parchment': {
        // шелест пергамента
        this.noise(t, 0.34, 'bandpass', 3400 * pv, 0.5, 0.2, 0.06, out);
        for (let i = 0; i < 7; i++) this.noise(t + 0.03 + i * 0.045 + Math.random() * 0.03, 0.03 + Math.random() * 0.03, 'highpass', 4800 + Math.random() * 2600, 0.8, 0.1 + Math.random() * 0.16, 0.002, out);
        this.noise(t + 0.3, 0.2, 'bandpass', 1900, 0.7, 0.07, 0.04, out);
        break;
      }
      case 'mystic': {
        // мистический гул при захвате Чуда
        const base = 98;
        [1, 1.5, 2.002, 3.0, 4.01].forEach((r, i) => {
          this.osc(t, 'sine', base * r, base * r * 1.003, 3.4, 0.2 / (1 + i * 0.5), 0.9, out, 0.7);
        });
        this.osc(t, 'sine', 49, 49, 3.4, 0.38, 0.7, out);
        const trem = ctx.createOscillator();
        trem.frequency.value = 5.5;
        const td = ctx.createGain();
        td.gain.value = 0.08;
        trem.connect(td);
        td.connect(out.gain);
        trem.start(t);
        trem.stop(t + 4.4);
        [784, 1175, 1568, 1760, 2349].forEach((f, i) => this.bell(t + 0.6 + i * 0.32, f, 0.085, 2.6, out, 0.9));
        this.noise(t, 3.2, 'bandpass', 900, 3, 0.05, 1.2, out, 0.6);
        break;
      }
      case 'treefall': {
        // треск ствола, свист, глухой удар о землю и шелест листвы
        this.noise(t, 0.05, 'bandpass', 1100, 2.5, 0.8, 0.001, out);
        this.noise(t + 0.06, 0.04, 'bandpass', 1500, 2.5, 0.6, 0.001, out);
        this.osc(t, 'sawtooth', 210 * pv, 110 * pv, 0.4, 0.09, 0.03, out);
        this.noise(t + 0.1, 0.4, 'bandpass', 520, 1.2, 0.18, 0.28, out);
        this.noise(t + 0.15, 0.4, 'highpass', 3000, 0.7, 0.1, 0.3, out);
        this.osc(t + 0.52, 'sine', 95, 36, 0.38, 0.85, 0.003, out);
        this.noise(t + 0.52, 0.28, 'lowpass', 380, 0.8, 0.6, 0.004, out);
        this.noise(t + 0.55, 0.55, 'highpass', 4200, 0.6, 0.17, 0.05, out);
        break;
      }
    }
  }

  private thock(t: number, p: number, out: AudioNode, a: number) {
    this.noise(t, 0.075, 'bandpass', 750 * p, 0.9, 0.95 * a, 0.002, out, 0.05);
    this.osc(t, 'sine', 200 * p, 70 * p, 0.1, 0.7 * a, 0.002, out);
    this.noise(t, 0.02, 'highpass', 2600, 0.7, 0.22 * a, 0.001, out);
  }

  /* ---------- Окружение ---------- */

  private startAmbience() {
    const ctx = this.ctx!;
    const mk = (type: BiquadFilterType, f: number, q: number, g: number, lfo: number, lfoDepth: number, to: AudioNode = this.ambBus) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = type;
      bp.frequency.value = f;
      bp.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = g;
      const l = ctx.createOscillator();
      l.frequency.value = lfo;
      const ld = ctx.createGain();
      ld.gain.value = lfoDepth;
      l.connect(ld);
      ld.connect(gain.gain);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(to);
      src.start(0, Math.random() * 1.5);
      l.start();
      return { gain, bp, l, ld };
    };
    mk('bandpass', 380, 0.4, 0.05, 0.07, 0.03); // ветер
    mk('lowpass', 650, 0.7, 0.035, 0.13, 0.025); // вода

    // дождь: шипение капель + глухой шум по листве
    this.rainG = ctx.createGain();
    this.rainG.gain.value = 0;
    this.rainG.connect(this.ambBus);
    mk('bandpass', 5600, 0.45, 1, 0.3, 0.12, this.rainG);
    mk('highpass', 2400, 0.5, 0.35, 0.9, 0.1, this.rainG);
    this.rainG2 = ctx.createGain();
    this.rainG2.gain.value = 0;
    this.rainG2.connect(this.ambBus);
    mk('lowpass', 800, 0.6, 1, 0.2, 0.15, this.rainG2);

    // зимний ветер: свистящий порыв с плавающим тоном
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    this.windG.connect(this.ambBus);
    const w1 = mk('bandpass', 620, 5, 0.65, 0.17, 0.35, this.windG);
    const fl = ctx.createOscillator();
    fl.frequency.value = 0.11;
    const fd = ctx.createGain();
    fd.gain.value = 260;
    fl.connect(fd);
    fd.connect(w1.bp.frequency);
    fl.start();
    mk('bandpass', 1250, 7, 0.28, 0.23, 0.2, this.windG);
    mk('lowpass', 300, 0.7, 0.5, 0.09, 0.3, this.windG);

    // живой гул деревни: низкий говор + формантный «рыночный» шум
    this.humG = ctx.createGain();
    this.humG.gain.value = 0;
    this.humG.connect(this.ambBus);
    mk('bandpass', 420, 0.9, 0.55, 0.37, 0.25, this.humG);
    mk('bandpass', 950, 3, 0.2, 0.61, 0.15, this.humG);
  }

  private panned(pan: number, gain: number): GainNode {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = gain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      p.connect(this.ambBus);
    } else out.connect(this.ambBus);
    return out;
  }

  /** сова: «у-ху» */
  private owl(t: number) {
    const out = this.panned(Math.random() * 1.4 - 0.7, 0.2);
    const rep = Math.random() < 0.5 ? 2 : 1;
    for (let r = 0; r < rep; r++) {
      const o = t + r * 1.15;
      this.osc(o, 'sine', 430, 400, 0.12, 0.5, 0.025, out, 0.45);
      this.osc(o + 0.3, 'sine', 360, 310, 0.5, 0.6, 0.06, out, 0.5);
      this.noise(o + 0.3, 0.4, 'bandpass', 700, 2, 0.04, 0.08, out, 0.3);
    }
  }

  /** далёкий волчий вой */
  private howl(t: number) {
    const ctx = this.ctx!;
    const out = this.panned(Math.random() * 1.6 - 0.8, 0.13);
    const dur = 2.6 + Math.random() * 0.8;
    const f0 = 280 + Math.random() * 60;
    for (const [type, mul, a] of [['triangle', 1, 1], ['sine', 2, 0.3]] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * mul, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 2.05 * mul, t + 0.9);
      o.frequency.setValueAtTime(f0 * 2.05 * mul, t + 1.0);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.55 * mul, t + dur);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const ld = ctx.createGain();
      ld.gain.setValueAtTime(0, t);
      ld.gain.linearRampToValueAtTime(14, t + 1.4);
      lfo.connect(ld);
      ld.connect(o.detune);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.7);
      g.gain.setValueAtTime(a * 0.85, t + dur * 0.62);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
      o.connect(g);
      g.connect(out);
      this.sendVerb(g, 0.9);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.5);
      lfo.stop(t + dur + 0.5);
    }
    this.noise(t, dur, 'bandpass', 1300, 1.5, 0.05, 0.8, out, 0.5);
  }

  /** отдалённый гром */
  private thunder(t: number) {
    const out = this.panned(Math.random() * 1.2 - 0.6, 0.5);
    this.noise(t, 2.8, 'lowpass', 190, 0.9, 0.45, 0.35, out, 0.5);
    this.noise(t + 0.6, 2.2, 'lowpass', 130, 0.9, 0.35, 0.5, out, 0.4);
    this.osc(t, 'sine', 55, 32, 2.2, 0.4, 0.3, out);
  }

  /** dt в секундах; play — идёт ли игра; night 0..1 */
  ambience(dt: number, play: boolean, night: number, fireNear: boolean, env: AmbEnv = {}) {
    if (!this.ctx || !this.running) return;
    if (play !== this.ambOn) {
      this.ambOn = play;
      this.applyVol();
    }
    // погодные слои — плавно приближаем к цели
    const now = this.ctx.currentTime;
    const rain = play && env.season === 2 ? Math.max(0, Math.min(1, env.rain ?? 0)) : 0;
    const winter = play && env.season === 3;
    const vk = play && (env.zoom ?? 0) >= 3 ? ((env.zoom ?? 3) >= 4 ? 1 : 0.65) : 0;
    this.rainG?.gain.setTargetAtTime(rain * 0.26, now, 0.9);
    this.rainG2?.gain.setTargetAtTime(rain * 0.2, now, 1.2);
    this.windG?.gain.setTargetAtTime(winter ? 0.2 : 0, now, 1.6);
    this.humG?.gain.setTargetAtTime(vk * 0.055, now, 1.0);
    if (!play) return;
    const t = now + 0.01;
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 3 + Math.random() * 7;
      if (night < 0.45 && rain < 0.3 && !winter && this.sfxVol > 0) {
        const n = 2 + Math.floor(Math.random() * 4);
        const base = 2800 + Math.random() * 1800;
        const out = this.panned(Math.random() * 1.6 - 0.8, 0.22);
        for (let i = 0; i < n; i++) this.osc(t + i * 0.11, 'sine', base, base * (1.25 + Math.random() * 0.4), 0.07, 0.35, 0.01, out, 0.15);
      }
    }
    this.cricketT -= dt;
    if (night > 0.5 && this.cricketT <= 0 && this.sfxVol > 0 && !winter && rain < 0.4) {
      this.cricketT = 0.55;
      const o = this.ctx.createOscillator();
      o.frequency.value = 4300 + Math.random() * 300;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 4; i++) {
        g.gain.setValueAtTime(0.025 * night, t + i * 0.07);
        g.gain.setValueAtTime(0, t + i * 0.07 + 0.035);
      }
      o.connect(g);
      g.connect(this.ambBus);
      o.start(t);
      o.stop(t + 0.35);
    }
    // ночная живность: редкая сова и ещё более редкий волк
    if (night > 0.55 && this.sfxVol > 0) {
      this.owlT -= dt;
      this.wolfT -= dt;
      if (this.owlT <= 0) {
        this.owlT = 20 + Math.random() * 25;
        if (rain < 0.5) this.owl(t);
      }
      if (this.wolfT <= 0) {
        this.wolfT = 45 + Math.random() * 50;
        this.howl(t);
      }
    }
    // гром в сильный дождь
    if (rain > 0.7 && this.sfxVol > 0 && Math.random() < dt * 0.02) this.thunder(t);
    if (fireNear && Math.random() < dt * 9 && this.sfxVol > 0) {
      const o = this.ctx.createGain();
      o.gain.value = 0.25;
      o.connect(this.ambBus);
      this.noise(t, 0.015 + Math.random() * 0.02, 'highpass', 1800 + Math.random() * 3000, 0.8, 0.3 * Math.random() + 0.05, 0.001, o);
    }
    // вблизи — кузница и рынок
    if (vk > 0 && this.sfxVol > 0) {
      this.forgeT -= dt;
      this.chatT -= dt;
      if (this.forgeT <= 0) {
        this.forgeT = 1.6 + Math.random() * 3;
        if (env.forge) {
          const o = this.panned(Math.random() * 1.2 - 0.6, 0.16 * vk);
          const p = 0.9 + Math.random() * 0.2;
          this.noise(t, 0.04, 'highpass', 3000, 0.8, 0.5, 0.001, o);
          this.osc(t, 'sine', 1850 * p, 1850 * p, 0.35, 0.22, 0.001, o, 0.2);
          this.osc(t, 'sine', 2900 * p, 2900 * p, 0.2, 0.1, 0.001, o, 0.2);
          this.osc(t, 'sine', 150, 80, 0.08, 0.3, 0.002, o);
          if (Math.random() < 0.6) {
            this.osc(t + 0.42, 'sine', 1650 * p, 1650 * p, 0.28, 0.16, 0.001, o, 0.2);
            this.noise(t + 0.42, 0.03, 'highpass', 3000, 0.8, 0.35, 0.001, o);
          }
        }
      }
      if (this.chatT <= 0) {
        this.chatT = 0.9 + Math.random() * 2.4;
        const o = this.panned(Math.random() * 1.6 - 0.8, 0.1 * vk);
        const syl = 2 + Math.floor(Math.random() * 3);
        const base = 380 + Math.random() * 500;
        for (let i = 0; i < syl; i++) this.noise(t + i * 0.17, 0.1 + Math.random() * 0.06, 'bandpass', base * (0.8 + Math.random() * 0.5), 5, 0.5, 0.03, o, 0.15);
        if (env.market && Math.random() < 0.18) {
          this.osc(t + 0.2, 'sine', 3136, 3136, 0.25, 0.1, 0.002, o, 0.3);
          this.osc(t + 0.27, 'sine', 4186, 4186, 0.3, 0.08, 0.002, o, 0.3);
        }
      }
    }
  }

  /* ---------- Музыка ---------- */

  /** Сменить тему. Переходы — плавный кроссфейд, а не обрыв в тишину. Если режим тот же, а меняется только стадия
   *  (ранг/эпоха), слои подключаются «на лету» с началом следующего такта. */
  music(mode: MusicMode, opts: MusicOpts = {}) {
    this.lastOpts = opts;
    if (!mode) {
      if (this.mode) {
        this.mode = null;
        this.fadeTheme();
      }
      return;
    }
    const cfg = buildCfg(mode, opts);
    const key = `${mode}:${cfg.scaleName}:${cfg.root}`;
    if (mode === this.mode && key === this.themeKey) {
      this.cfg = cfg;
      return;
    }
    this.mode = mode;
    this.cfg = cfg;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const old = this.themeBus;
    const nb = ctx.createGain();
    nb.gain.setValueAtTime(0.0001, t);
    nb.gain.setTargetAtTime(1, t, 1.0);
    nb.connect(this.musicBus);
    if (old) this.retire(old, 0.9);
    this.themeBus = nb;
    this.themeKey = key;
    this.step = 0;
    this.melodyQ = [];
    this.nextT = Math.max(this.nextT, t + 0.15);
  }

  private fadeTheme() {
    if (!this.ctx || !this.themeBus) return;
    this.retire(this.themeBus, 1.3);
    this.themeBus = null;
    this.themeKey = '';
  }

  private retire(bus: GainNode, tau: number) {
    const t = this.ctx!.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
    bus.gain.setTargetAtTime(0, t, tau);
    window.setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* ignore */
      }
    }, tau * 7000);
  }

  /** Слой тревоги: пульсирующий бас поверх текущей темы. level 0..1 */
  alarm(level: number) {
    this.alarmTarget = Math.max(0, Math.min(1, level));
  }

  private alarmPulse(t: number, n: number) {
    const out = this.alarmBus;
    const base = (this.cfg.root || 45) - 12;
    const f = mtof(base);
    const hit = (tt: number, k: number) => {
      this.osc(tt, 'sine', f * 1.5, f * 0.9, 0.38, 0.55 * k, 0.012, out);
      this.osc(tt, 'sine', f * 0.5, f * 0.5, 0.45, 0.4 * k, 0.015, out);
      const ctx = this.ctx!;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, tt);
      lp.frequency.exponentialRampToValueAtTime(110, tt + 0.35);
      const g = ctx.createGain();
      this.env(g, tt, 0.16 * k, 0.01, 0.34);
      for (const det of [0, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(tt);
        o.stop(tt + 0.5);
      }
      lp.connect(g);
      g.connect(out);
    };
    hit(t, 1);
    hit(t + 0.2, 0.55); // «двойной удар» сердца
    if (n % 4 === 2) {
      // острый малосекундовый диссонанс над басом
      this.osc(t, 'triangle', mtof(base + 12 + 1), mtof(base + 12 + 1), 0.7, 0.09, 0.05, out, 0.3);
      this.osc(t, 'triangle', mtof(base + 12), mtof(base + 12), 0.7, 0.08, 0.05, out, 0.3);
    }
    if (n % 8 === 6) this.osc(t, 'sawtooth', mtof(base + 18), mtof(base + 17), 0.35, 0.03, 0.02, out, 0.4);
  }

  private deg(d: number): number {
    const sc = this.cfg.scale;
    const o = Math.floor(d / 7);
    return this.cfg.root + sc[((d % 7) + 7) % 7] + 12 * o;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    // тревога живёт независимо от темы
    this.alarmK += (this.alarmTarget - this.alarmK) * 0.12;
    if (this.alarmK < 0.01 && this.alarmTarget === 0) this.alarmK = 0;
    this.alarmBus.gain.setTargetAtTime(this.alarmK * Math.min(1, this.musicVol * 1.3) * 1.1, ctx.currentTime, 0.25);
    if (ctx.state === 'running' && this.alarmK > 0.03 && this.musicVol > 0.001) {
      const beat = 60 / (96 + 24 * this.alarmK);
      if (this.alarmNext < ctx.currentTime) this.alarmNext = ctx.currentTime + 0.05;
      while (this.alarmNext < ctx.currentTime + 0.4) {
        this.alarmPulse(this.alarmNext, this.alarmBeat++);
        this.alarmNext += beat;
      }
    }
    if (ctx.state !== 'running' || !this.mode || !this.themeBus || this.musicVol <= 0.001) {
      this.nextT = Math.max(this.nextT, ctx.currentTime);
      return;
    }
    while (this.nextT < ctx.currentTime + 0.4) {
      this.beat(this.nextT, this.step);
      this.nextT += 60 / this.cfg.bpm / 2; // восьмая
      this.step++;
    }
  }

  private beat(t: number, step: number) {
    const c = this.cfg;
    const eighth = 60 / c.bpm / 2;
    const bar = Math.floor(step / 8);
    const inBar = step % 8;
    const d = c.prog[bar % c.prog.length];
    const chord = [d, d + 2, d + 4].map((x) => this.deg(x));
    const out = this.themeBus!;
    if (inBar === 0) {
      // пэд
      if (c.pad > 0) {
        for (const m of [chord[0] + 12, chord[1] + 12, chord[2] + 12]) this.pad(t, mtof(m), eighth * 8, 0.035 * c.pad, out);
      }
      // бас: с ростом эпох — корневая нота, затем «шагающий» бас с виолончельным слоем
      if (c.bass > 0) {
        this.osc(t, 'triangle', mtof(chord[0] - 12), mtof(chord[0] - 12), eighth * 6, c.bass === 2 ? 0.3 : 0.24, 0.02, out);
        if (c.bass === 2) this.cello(t, mtof(chord[0] - 12), eighth * 5, 0.07 + c.stage * 0.006, out);
      }
      if (c.brass) this.brass(t, mtof(chord[0] - 12), eighth * 6, 0.07, out, 0.4);
      // духовые: мягкий горн удерживает аккорд, на высоких эпохах — квинта
      if (c.horn > 0 && (bar % 2 === 0 || c.brass)) {
        this.horn(t, mtof(chord[0]), eighth * 7, 0.07 * c.horn, out);
        if (c.horn > 0.7) this.horn(t + 0.02, mtof(chord[2]), eighth * 7, 0.05 * c.horn, out);
      }
      if (c.timp && bar % (c.brass ? 1 : 2) === 0) this.drum(t, 0.7, 52, out);
      // мелодия: каждые два такта
      if (bar % 2 === 0 && Math.random() < c.melody) this.makePhrase(t, eighth, d);
    }
    if (c.bass === 2 && !c.brass) {
      if (inBar === 2) this.osc(t, 'triangle', mtof(chord[2] - 12), mtof(chord[2] - 12), eighth * 1.6, 0.17, 0.01, out);
      if (inBar === 4) this.osc(t, 'triangle', mtof(chord[0] - 12), mtof(chord[0] - 12), eighth * 1.6, 0.17, 0.01, out);
      if (inBar === 6) this.osc(t, 'triangle', mtof(chord[1] - 12), mtof(chord[1] - 12), eighth * 1.6, 0.15, 0.01, out);
    }
    // тростниковые духовые (кларнет/гобой) — встречные фразы
    if (c.reed > 0) {
      if (inBar === 4 && bar % 2 === 1 && Math.random() < 0.8 * c.reed) this.reed(t, mtof(chord[1] + 12), eighth * 3, 0.055 * c.reed, out);
      if (inBar === 6 && bar % 2 === 1 && Math.random() < 0.45 * c.reed) this.reed(t, mtof(chord[2] + 12), eighth * 2, 0.045 * c.reed, out);
    }
    // лютня
    if (c.lute > 0) {
      const pat = [0, 1, 2, 1, 0, 1, 2, 1];
      const skip = Math.random() > 0.75 * c.lute + 0.2;
      if (!skip) {
        const idx = pat[inBar];
        const hi = inBar === 3 || inBar === 7 ? 12 : 0;
        this.pluck(t + Math.random() * 0.012, mtof(chord[idx] + 12 + hi), 0.14 * (inBar % 2 ? 0.7 : 1), out);
      }
    }
    // ударные
    if (c.drums === 1) {
      if (inBar === 0) this.drum(t, 0.55, 95, out);
      if (inBar === 4) this.drum(t, 0.38, 80, out);
      if (inBar === 6 && Math.random() < 0.4) this.drum(t, 0.2, 110, out);
      if (inBar % 2 === 1) this.noise(t, 0.04, 'highpass', 6500, 0.7, 0.025, 0.002, out);
    } else if (c.drums === 2) {
      if (inBar % 2 === 0) this.drum(t, inBar === 0 ? 0.95 : 0.65, 70, out);
      if (inBar === 3 || inBar === 7) this.drum(t, 0.35, 100, out);
      if (inBar === 5) this.drum(t, 0.3, 90, out);
    } else if (c.drums === 3) {
      // начало игры: одинокий бубен на сильные доли
      if (inBar === 0) this.drum(t, 0.36, 100, out);
      if (inBar === 4) this.drum(t, 0.22, 88, out);
      if (inBar === 7 && Math.random() < 0.25) this.drum(t, 0.12, 115, out);
    }
    // мелодия
    while (this.melodyQ.length && this.melodyQ[0].t <= t + eighth * 0.5) {
      const n = this.melodyQ.shift()!;
      this.flute(Math.max(t, n.t), mtof(n.midi), n.dur, c.brass ? 0.1 : 0.16, out);
    }
  }

  private makePhrase(t: number, eighth: number, d: number) {
    const lens = [2, 2, 4, 3, 1, 2, 4, 2];
    let pos = 0;
    let deg = d + 7 + [0, 2, 4][Math.floor(Math.random() * 3)];
    const total = 16;
    this.melodyQ = [];
    let i = 0;
    while (pos < total - 1 && i < 7) {
      const len = lens[Math.floor(Math.random() * lens.length)];
      if (Math.random() < 0.12) {
        pos += len;
        continue;
      }
      this.melodyQ.push({ t: t + pos * eighth, midi: this.deg(deg), dur: Math.min(len, total - pos) * eighth * 0.95 });
      deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      deg = Math.max(d + 3, Math.min(d + 13, deg));
      pos += len;
      i++;
    }
  }

  /** мягкий горн: медленная атака, закрытый тембр */
  private horn(t: number, f: number, dur: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(1150, t + dur * 0.4);
    lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.28);
    g.gain.setValueAtTime(peak, t + Math.max(0.3, dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.5);
    }
    lp.connect(g);
    g.connect(out);
    this.sendVerb(g, 0.5);
  }

  /** тростниковый тембр (кларнет): нечётные гармоники, лёгкое вибрато */
  private reed(t: number, f: number, dur: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(3200, f * 5);
    lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.07);
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.08, dur - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.8 + Math.random();
    const ld = ctx.createGain();
    ld.gain.setValueAtTime(0, t);
    ld.gain.linearRampToValueAtTime(8, t + Math.min(0.4, dur));
    lfo.connect(ld);
    for (const [type, mul, a] of [['square', 1, 0.5], ['sine', 1, 0.6], ['triangle', 3, 0.15]] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      ld.connect(o.detune);
      const ga = ctx.createGain();
      ga.gain.value = a;
      o.connect(ga);
      ga.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
    lp.connect(g);
    g.connect(out);
    this.sendVerb(g, 0.6);
  }

  /** тёплый смычковый бас */
  private cello(t: number, f: number, dur: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.18);
    g.gain.setValueAtTime(peak, t + Math.max(0.2, dur - 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
    lp.connect(g);
    g.connect(out);
  }

  private pluck(t: number, f: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'triangle';
    o2.type = 'sawtooth';
    o1.frequency.value = f;
    o2.frequency.value = f;
    o2.detune.value = 4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(7000, f * 7), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.2), t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o1.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(out);
    this.sendVerb(g, 0.45);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.2);
    o2.stop(t + 1.2);
  }

  private pad(t: number, f: number, dur: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 850;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1.3);
    }
    lp.connect(g);
    g.connect(out);
    this.sendVerb(g, 0.6);
  }

  private flute(t: number, f: number, dur: number, peak: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.09);
    g.gain.setValueAtTime(peak * 0.9, t + Math.max(0.1, dur - 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random();
    const ld = ctx.createGain();
    ld.gain.setValueAtTime(0, t);
    ld.gain.linearRampToValueAtTime(7, t + Math.min(0.5, dur));
    lfo.connect(ld);
    for (const [type, mul, a] of [['sine', 1, 1], ['sine', 2, 0.22], ['triangle', 1, 0.2]] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      ld.connect(o.detune);
      const ga = ctx.createGain();
      ga.gain.value = a;
      o.connect(ga);
      ga.connect(g);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
    g.connect(out);
    this.sendVerb(g, 0.75);
    this.noise(t, dur, 'bandpass', f * 3, 1.2, peak * 0.18, 0.06, out);
  }

  private drum(t: number, peak: number, f: number, out: AudioNode) {
    this.osc(t, 'sine', f * 1.5, f * 0.6, 0.3, peak, 0.003, out, 0.25);
    this.noise(t, 0.12, 'lowpass', 500, 0.8, peak * 0.5, 0.002, out, 0.2);
  }
}

export const audio = new AudioEngine();

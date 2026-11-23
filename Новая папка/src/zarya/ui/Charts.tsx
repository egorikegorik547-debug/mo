import type { Sample } from '../game/extstate';

export interface Series {
  key: keyof Sample;
  label: string;
  color: string;
}

/** Простой пиксельный график по дням партии */
export function LineChart({ title, samples, series, suffix = '', height = 120 }: { title: string; samples: Sample[]; series: Series[]; suffix?: string; height?: number }) {
  const W = 320;
  const H = height;
  const pad = { l: 34, r: 8, t: 8, b: 18 };
  const data = samples.length >= 2 ? samples : [...samples, ...samples].slice(0, 2);
  const n = data.length;
  let max = 1;
  for (const s of series) for (const d of data) max = Math.max(max, Number(d[s.key]) || 0);
  max = niceMax(max);
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const d0 = data[0]?.day ?? 1;
  const d1 = data[n - 1]?.day ?? 1;
  return (
    <div className="px-inset flex flex-col gap-1 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-pixel text-[8px] text-[#ffe9a8]">{title}</span>
        <span className="flex gap-2 text-[11px]">
          {series.map((s) => (
            <span key={s.key} style={{ color: s.color }}>
              ■ {s.label}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ imageRendering: 'pixelated' }}>
        <rect x={0} y={0} width={W} height={H} fill="#140d08" />
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#3a2a1c" strokeWidth={1} strokeDasharray="3 3" />
            <text x={pad.l - 4} y={y(max * f) + 3} textAnchor="end" fontSize={9} fill="#a08868">
              {fmt(max * f)}
              {suffix}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 4} fontSize={9} fill="#a08868">
          день {d0}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize={9} fill="#a08868" textAnchor="end">
          день {d1}
        </text>
        {series.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={data.map((d, i) => `${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join(' ')} />
        ))}
      </svg>
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 10) return Math.max(5, Math.ceil(v / 5) * 5);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 3 ? 3 : m <= 5 ? 5 : 10) * p;
}
function fmt(v: number) {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10);
}

export function ProgressBar({ v, color, label, right }: { v: number; color: string; label?: string; right?: string }) {
  return (
    <div>
      {(label || right) && (
        <div className="flex justify-between text-[13px] text-[#e8d4a8]">
          <span>{label}</span>
          <b style={{ color }}>{right}</b>
        </div>
      )}
      <div className="px-bar mt-1 h-3">
        <i style={{ width: `${Math.max(0, Math.min(100, v * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

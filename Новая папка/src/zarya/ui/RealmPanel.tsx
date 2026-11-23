import { useState } from 'react';
import { ACHIEVEMENTS, loadGlobalAch } from '../game/achievements';
import { setEscort } from '../game/caravans';
import type { ChronEntry, ChronKind } from '../game/extstate';
import type { Game, Snapshot } from '../game/game';
import { TH, TW } from '../game/data';
import { SEASONS } from '../game/seasons';
import { VICTORY_INFO, WIN_GOLD, WIN_GOODS, WIN_SHARE } from '../game/victory';
import { LineChart, ProgressBar } from './Charts';

export type RealmTab = 'chron' | 'ach' | 'car' | 'rivals' | 'wonders' | 'victory';

const KIND_ICON: Record<ChronKind, string> = { info: '📜', good: '⭐', warn: '⚠️', war: '⚔️', peace: '🕊️', sci: '💡', gov: '👑', wonder: '✦', death: '🕯️', season: '🍃' };

/* ───────────── Летопись: текст и картинка ───────────── */

export function chronText(name: string, list: ChronEntry[]) {
  return `ЛЕТОПИСЬ ГОСУДАРСТВА «${name.toUpperCase()}»\n\n` + list.map((e) => `День ${e.day}: ${e.text}`).join('\n');
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Рисует свиток-летопись в PNG — чтобы делиться скриншотом */
export function chronImage(name: string, list: ChronEntry[], maxEntries = 46): string {
  const W = 900;
  const entries = list.length > maxEntries ? [...list.slice(0, 6), { day: 0, text: '…', kind: 'info' as ChronKind }, ...list.slice(-(maxEntries - 7))] : list;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = '22px "Pixelify Sans", Georgia, serif';
  let H = 190;
  const rows = entries.map((e) => {
    const lines = e.day ? wrap(probe, e.text, W - 250) : ['· · ·'];
    H += lines.length * 30 + 12;
    return { e, lines };
  });
  H += 70;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ecdcb0');
  bg.addColorStop(0.5, '#e0cd98');
  bg.addColorStop(1, '#d2bb82');
  c.fillStyle = '#2a1a0e';
  c.fillRect(0, 0, W, H);
  c.fillStyle = bg;
  c.fillRect(14, 14, W - 28, H - 28);
  c.strokeStyle = '#8a5a2a';
  c.lineWidth = 4;
  c.strokeRect(26, 26, W - 52, H - 52);
  c.strokeStyle = '#b8924a';
  c.lineWidth = 1;
  c.strokeRect(34, 34, W - 68, H - 68);
  c.textAlign = 'center';
  c.fillStyle = '#5a2a14';
  c.font = '14px "Press Start 2P", monospace';
  c.fillText('✦ ЛЕТОПИСЬ ГОСУДАРСТВА ✦', W / 2, 84);
  c.fillStyle = '#3a2412';
  c.font = '34px "Press Start 2P", monospace';
  c.fillText(`«${name.toUpperCase()}»`, W / 2, 138, W - 120);
  c.textAlign = 'left';
  let y = 190;
  for (const r of rows) {
    c.font = '20px "Pixelify Sans", Georgia, serif';
    if (r.e.day) {
      c.fillStyle = '#8a2a14';
      c.font = 'bold 20px "Pixelify Sans", Georgia, serif';
      c.fillText(`День ${r.e.day}`, 64, y);
    }
    c.fillStyle = '#3a2412';
    c.font = '22px "Pixelify Sans", Georgia, serif';
    for (const ln of r.lines) {
      c.fillText(ln, 190, y);
      y += 30;
    }
    y += 12;
  }
  c.textAlign = 'center';
  c.fillStyle = '#7a5a30';
  c.font = '12px "Press Start 2P", monospace';
  c.fillText('ЗАРЯ ПЛЕМЕНИ', W / 2, H - 52);
  return cv.toDataURL('image/png');
}

export function downloadChronImage(name: string, list: ChronEntry[]) {
  const a = document.createElement('a');
  a.href = chronImage(name, list);
  a.download = `letopis-${name}.png`;
  a.click();
}

/* ───────────── Вкладки ───────────── */

function seasonOfDay(day: number) {
  const di = day - 1;
  return { idx: Math.floor(di / 9) % 4, year: Math.floor(di / 36) + 1 };
}

function ChronTab({ snap }: { snap: Snapshot }) {
  const [copied, setCopied] = useState(false);
  const list = snap.ext.chron;
  const groups: { key: string; title: string; items: ChronEntry[] }[] = [];
  for (const e of list) {
    const s = seasonOfDay(e.day);
    const key = `${s.year}-${s.idx}`;
    let gr = groups[groups.length - 1];
    if (!gr || gr.key !== key) {
      gr = { key, title: `Год ${s.year} · ${SEASONS[s.idx].icon} ${SEASONS[s.idx].name}`, items: [] };
      groups.push(gr);
    }
    gr.items.push(e);
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(chronText(snap.name, list)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          className="px-btn px-2.5 py-1.5 text-[13px] font-bold"
        >
          {copied ? '✔ Скопировано' : '📋 Копировать текст'}
        </button>
        <button onClick={() => downloadChronImage(snap.name, list)} className="px-btn px-btn-gold px-2.5 py-1.5 text-[13px] font-bold">
          🖼 Сохранить свиток (PNG)
        </button>
        <span className="text-[12px] text-[#a08868]">Летопись пишется сама — делитесь ею со скриншотами!</span>
      </div>
      <div className="scroll-px min-h-0 flex-1 overflow-y-auto p-1">
        <div className="mx-auto max-w-[760px] px-6 py-5" style={{ background: 'linear-gradient(#ecdcb0,#dcc890)', boxShadow: '0 0 0 3px #2a1a0e, inset 0 0 0 3px #8a5a2a, inset 0 0 40px rgba(120,70,20,.35)', color: '#3a2412' }}>
          <div className="text-center">
            <div className="font-pixel text-[9px] tracking-widest" style={{ color: '#7a2a14' }}>
              ✦ ЛЕТОПИСЬ ГОСУДАРСТВА ✦
            </div>
            <div className="font-pixel mt-2 text-[17px]">«{snap.name.toUpperCase()}»</div>
            <div className="mx-auto mt-2 h-[3px] w-40" style={{ background: 'linear-gradient(90deg,transparent,#8a5a2a,transparent)' }} />
          </div>
          {groups.length === 0 && <div className="mt-6 text-center text-[16px] italic">Пока страницы пусты…</div>}
          {groups.map((gr) => (
            <div key={gr.key} className="mt-5">
              <div className="font-pixel mb-1 border-b-2 pb-1 text-[8px]" style={{ borderColor: '#b8924a', color: '#7a2a14' }}>
                {gr.title.toUpperCase()}
              </div>
              {gr.items.map((e, i) => (
                <div key={i} className="flex gap-3 py-[3px] text-[17px] leading-snug">
                  <span className="w-[72px] shrink-0 font-bold" style={{ color: '#8a2a14' }}>
                    День {e.day}
                  </span>
                  <span className="w-5 shrink-0 text-center">{KIND_ICON[e.kind]}</span>
                  <span style={{ fontWeight: e.kind === 'good' || e.kind === 'wonder' ? 700 : 500 }}>{e.text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AchTab({ snap }: { snap: Snapshot }) {
  const glob = loadGlobalAch();
  const got = Object.keys(snap.ext.ach).length;
  return (
    <div className="scroll-px min-h-0 flex-1 overflow-y-auto">
      <div className="mb-3 flex items-center justify-between text-[14px] text-[#e8d4a8]">
        <span>
          Получено в этой партии: <b className="text-[#ffe27a]">{got}</b> из {ACHIEVEMENTS.length}. Каждое достижение даёт постоянный бонус державе.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const day = snap.ext.ach[a.id];
          const [cur, max] = snap.ext.achProg[a.id] ?? [0, 1];
          return (
            <div key={a.id} className="px-inset flex flex-col gap-1.5 p-3" style={day != null ? { boxShadow: 'inset 0 0 0 2px #ffcf6a', background: 'linear-gradient(#3a2a12,#241a0c)' } : { opacity: 0.9 }}>
              <div className="flex items-center gap-2">
                <span className="text-[26px] leading-none" style={{ filter: day != null ? undefined : 'grayscale(1) brightness(0.6)' }}>
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-pixel text-[9px] leading-snug text-[#ffe9a8]">{a.name.toUpperCase()}</div>
                  <div className="text-[13px] text-[#c8b088]">{a.desc}</div>
                </div>
                {glob[a.id] ? <span className="font-pixel text-[7px] text-[#8aa8c8]" title="Раз получено за все партии">★{glob[a.id]}</span> : null}
              </div>
              <div className="text-[13px] font-bold" style={{ color: day != null ? '#9affaa' : '#a08868' }}>
                🎁 {a.bonus}
              </div>
              {day != null ? <div className="text-[12px] text-[#ffcf6a]">✔ Получено на {day}-й день</div> : <ProgressBar v={cur / max} color="#ffcf6a" right={`${cur}/${max}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarTab({ game, snap }: { game: Game; snap: Snapshot }) {
  const C = snap.ext.caravans;
  const prov = snap.towns.filter((t) => t.owner === 'player');
  return (
    <div className="scroll-px flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="px-inset p-3 text-[14px] leading-snug text-[#e8d4a8]">
        🐎 Раз в игровой день из каждой вашей провинции в столицу <b className="text-[#ffe9a8]">«{C.dest}»</b> выезжает повозка с налогами и ресурсами (70% дохода провинции едет караваном). В лесах, на враждебных землях и рядом с набегами её могут ограбить —
        тогда груз пропадёт. Отправьте <b className="text-[#ffe9a8]">охрану</b>: воины из гарнизона сопровождают караван, а патрули у дороги тоже помогают.
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
        <div className="px-inset p-2">
          ✅ Доставлено
          <div className="text-[20px] font-bold text-[#8aff9a]">{snap.ext.cnt.caravansDone}</div>
        </div>
        <div className="px-inset p-2">
          💀 Потеряно
          <div className="text-[20px] font-bold text-[#ff8a7a]">{snap.ext.cnt.caravansLost}</div>
        </div>
        <div className="px-inset p-2">
          🗡 Разбойников побеждено
          <div className="text-[20px] font-bold text-[#ffe27a]">{snap.ext.cnt.banditsKilled}</div>
        </div>
      </div>
      <div className="font-pixel text-[9px] text-[#ffcf6a]">ПРОВИНЦИИ И ОХРАНА</div>
      {prov.length === 0 && <div className="px-inset p-3 text-[14px] text-[#a08868]">Провинций пока нет — присоедините или захватите соседнее селение, и караваны поедут.</div>}
      {prov.map((t) => (
        <div key={t.id} className="px-inset flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-[160px] flex-1">
            <div className="text-[15px] font-bold text-[#ffe9a8]">
              {t.capital ? '★ ' : ''}
              {t.name}
            </div>
            <div className="text-[13px] text-[#c8b088]">{t.capital ? 'Столица — караван не нужен' : `Накоплено на отправку: ~${t.cargo}🪙`}</div>
          </div>
          {!t.capital && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-[#e8d4a8]">Охрана:</span>
              <button onClick={() => setEscort(game, t.id, t.escort - 1)} disabled={t.escort <= 0} className="px-btn font-pixel h-7 w-7 text-[11px]">
                −
              </button>
              <b className="w-14 text-center text-[16px] text-[#bfe0ff]">{t.escort} 🛡</b>
              <button onClick={() => setEscort(game, t.id, t.escort + 1)} disabled={t.escort >= 3} className="px-btn px-btn-green font-pixel h-7 w-7 text-[11px] text-white">
                +
              </button>
            </div>
          )}
          <button onClick={() => game.centerOn((t.x + 0.5) * TW, (t.y + 0.5) * TH)} className="px-btn px-2 py-1 text-[12px] font-bold">
            📍
          </button>
        </div>
      ))}
      <div className="font-pixel text-[9px] text-[#ffcf6a]">В ПУТИ СЕЙЧАС ({C.active.length})</div>
      {C.active.length === 0 && <div className="text-[13px] text-[#a08868]">Дорога пуста. Караваны выезжают в начале каждого дня.</div>}
      {C.active.map((c) => (
        <div key={c.id} className="px-inset flex flex-col gap-1 p-2.5" style={c.ambush ? { boxShadow: 'inset 0 0 0 2px #ff6a5a' } : undefined}>
          <div className="flex justify-between text-[13px] text-[#f3e3c0]">
            <span>
              {c.sea ? '⛵' : '🐎'} из «{c.from}» · груз ~{c.value}🪙 · охрана {c.escort}
            </span>
            {c.ambush && <b className="blink-px text-[#ff7a6a]">⚔ ЗАСАДА!</b>}
          </div>
          <ProgressBar v={c.progress} color="#ffcf6a" />
        </div>
      ))}
      {C.log.length > 0 && (
        <>
          <div className="font-pixel text-[9px] text-[#ffcf6a]">ПОСЛЕДНИЕ СОБЫТИЯ</div>
          {C.log.map((l, i) => (
            <div key={i} className="text-[13px]" style={{ color: l.ok ? '#9affaa' : '#ff9a8a' }}>
              {l.ok ? '✔' : '✖'} {l.text}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function RivalsTab({ snap }: { snap: Snapshot }) {
  const R = snap.ext.rivals;
  const strong = R.realms.filter((r) => r.strong);
  return (
    <div className="scroll-px flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="px-inset p-3 text-[14px] leading-snug text-[#e8d4a8]">
        🌐 Соседние селения живут своей жизнью: воюют между собой, заключают союзы и поглощают слабых. К 30–50 дню на карте вырастают <b className="text-[#ffb05a]">сильные державы</b> — с ними придётся конкурировать за земли. Сейчас сильных держав: <b className="text-[#ffe27a]">{strong.length}</b>.
      </div>
      <div className="font-pixel text-[9px] text-[#ffcf6a]">СИЛЫ НА КАРТЕ</div>
      {R.realms.length === 0 && <div className="text-[13px] text-[#a08868]">Независимых селений не осталось.</div>}
      {R.realms.map((r) => (
        <div key={r.rootId} className="px-inset flex flex-wrap items-center gap-3 p-3" style={r.strong ? { boxShadow: 'inset 0 0 0 2px #ffb05a' } : undefined}>
          <span className="text-[26px]">{r.strong ? '♛' : '🏘️'}</span>
          <div className="min-w-[180px] flex-1">
            <div className="text-[15px] font-bold" style={{ color: r.strong ? '#ffb05a' : '#ffe9a8' }}>
              {r.strong ? 'Держава ' : ''}«{r.name}»
            </div>
            <div className="text-[13px] text-[#c8b088]">{r.members.length ? `Подданные: ${r.members.join(', ')}` : 'Независимое селение'}</div>
          </div>
          <div className="text-right text-[13px] text-[#f3e3c0]">
            👥 {r.pop} · ⚔ {r.soldiers}
            <div className="text-[#ffcf6a]">сила {r.power}</div>
          </div>
        </div>
      ))}
      <div className="font-pixel text-[9px] text-[#ff9a8a]">ВОЙНЫ ({R.wars.length})</div>
      {R.wars.length === 0 && <div className="text-[13px] text-[#a08868]">Сейчас на карте мир.</div>}
      {R.wars.map((w, i) => (
        <div key={i} className="text-[14px] text-[#ffb0a0]">
          ⚔ «{w.a}» → «{w.b}» · сражений: {w.battles}
        </div>
      ))}
      <div className="font-pixel text-[9px] text-[#9affaa]">СОЮЗЫ ({R.allies.length})</div>
      {R.allies.length === 0 && <div className="text-[13px] text-[#a08868]">Союзов нет.</div>}
      {R.allies.map((w, i) => (
        <div key={i} className="text-[14px] text-[#b8f0b0]">
          🤝 «{w.a}» и «{w.b}»
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
        <div className="px-inset p-2">
          ⚔ Войн было
          <div className="text-[18px] font-bold text-[#ff9a8a]">{snap.ext.cnt.aiWars}</div>
        </div>
        <div className="px-inset p-2">
          🤝 Союзов
          <div className="text-[18px] font-bold text-[#9affaa]">{snap.ext.cnt.aiAlliances}</div>
        </div>
        <div className="px-inset p-2">
          ♛ Поглощений
          <div className="text-[18px] font-bold text-[#ffb05a]">{snap.ext.cnt.absorbed}</div>
        </div>
      </div>
    </div>
  );
}

function WondersTab({ game, snap, onClose }: { game: Game; snap: Snapshot; onClose: () => void }) {
  return (
    <div className="scroll-px flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="px-inset p-3 text-[14px] leading-snug text-[#e8d4a8]">
        ✦ На карте стоят древние чудеса и руины. Поставьте флаг на земле рядом с ними (кнопка «Земли» [L]) — владелец территории получает <b className="text-[#ffe9a8]">постоянный бонус ко всему государству</b>. Боты тоже занимают земли — поторопитесь.
      </div>
      {snap.ext.wonders.map((w) => (
        <div key={w.id} className="px-inset flex flex-wrap items-center gap-3 p-3" style={w.owner === 'player' ? { boxShadow: 'inset 0 0 0 2px #7dff8c' } : undefined}>
          <span className="px-inset flex h-12 w-12 items-center justify-center text-[28px]">{w.icon}</span>
          <div className="min-w-[200px] flex-1">
            <div className="text-[15px] font-bold text-[#ffe9a8]">{w.name}</div>
            <div className="text-[13px] text-[#c8b088]">{w.desc}</div>
            <div className="text-[13px] font-bold text-[#9affaa]">🎁 {w.bonus}</div>
          </div>
          <div className="text-right text-[13px]">
            {w.owner === 'player' ? <span className="text-[#7dff8c]">✔ ВАШЕ</span> : w.owner === 'bot' ? <span className="text-[#ff9a8a]">занято: {w.ownerName}</span> : <span className="text-[#ffe9a8]">не занято</span>}
            <button
              onClick={() => {
                game.centerOn((w.x + 0.5) * TW, (w.y + 0.5) * TH);
                onClose();
              }}
              className="px-btn mt-1 block px-2 py-1 text-[12px] font-bold"
            >
              📍 Показать
            </button>
          </div>
        </div>
      ))}
      {snap.ext.wonders.length === 0 && <div className="text-[14px] text-[#a08868]">На этой карте чудес нет.</div>}
    </div>
  );
}

function VictoryTab({ snap }: { snap: Snapshot }) {
  const P = snap.ext.prog;
  const done = snap.done.length;
  return (
    <div className="scroll-px flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="px-inset p-3 text-[14px] leading-snug text-[#e8d4a8]">🏁 Три пути к победе. Достигните любого — и партия завершится экраном итогов (потом можно продолжить играть).</div>
      {(['mil', 'eco', 'sci'] as const).map((k) => {
        const info = VICTORY_INFO[k];
        return (
          <div key={k} className="px-inset flex flex-col gap-2 p-3" style={{ boxShadow: `inset 0 0 0 2px ${info.color}66` }}>
            <div className="flex items-center gap-2">
              <span className="text-[26px]">{info.icon}</span>
              <div>
                <div className="font-pixel text-[10px] text-[#ffe9a8]">{info.name.toUpperCase()}</div>
                <div className="text-[13px] text-[#c8b088]">{info.desc}</div>
              </div>
            </div>
            {k === 'mil' && <ProgressBar v={P.mil / WIN_SHARE} color={info.color} label="Контроль над картой" right={`${Math.round(P.mil * 100)}% / ${WIN_SHARE * 100}%`} />}
            {k === 'eco' && (
              <>
                <ProgressBar v={P.gold} color={info.color} label="Золото" right={`${snap.res.gold} / ${WIN_GOLD}`} />
                <ProgressBar v={P.goods} color="#7fd8e0" label="Товары" right={`${snap.res.goods} / ${WIN_GOODS}`} />
              </>
            )}
            {k === 'sci' && <ProgressBar v={P.sci} color={info.color} label="Технологии" right={`${done} / ${P.sciTarget}`} />}
          </div>
        );
      })}
      <LineChart title="РОСТ ДЕРЖАВЫ" samples={snap.ext.samples} series={[{ key: 'pop', label: 'население', color: '#ffe27a' }, { key: 'techs', label: 'технологии', color: '#4aa8ff' }]} />
      <LineChart title="КОНТРОЛЬ НАД КАРТОЙ" samples={snap.ext.samples} suffix="%" series={[{ key: 'land', label: 'доля карты', color: '#e5484d' }]} />
    </div>
  );
}

/* ───────────── Панель ───────────── */

export function RealmPanel({ game, snap, tab, setTab, onClose }: { game: Game; snap: Snapshot; tab: RealmTab; setTab: (t: RealmTab) => void; onClose: () => void }) {
  const tabs: { id: RealmTab; name: string; icon: string; badge?: number }[] = [
    { id: 'chron', name: 'Летопись', icon: '📖' },
    { id: 'ach', name: 'Достижения', icon: '🏆', badge: Object.keys(snap.ext.ach).length },
    { id: 'car', name: 'Караваны', icon: '🐎', badge: snap.ext.caravans.active.length },
    { id: 'rivals', name: 'Державы ИИ', icon: '🌐' },
    { id: 'wonders', name: 'Чудеса', icon: '✦' },
    { id: 'victory', name: 'Победа', icon: '🏁' },
  ];
  const s = snap.ext.season;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="px-panel flex h-[min(92vh,820px)] w-full max-w-[1100px] flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-pixel text-[14px] text-[#ffe9a8]">ХРОНИКИ ДЕРЖАВЫ</h2>
            <div className="mt-1 text-[13px] text-[#c8b088]">
              {s.icon} {s.name}, день {s.dayIn} из 9 · год {s.year} · день партии {snap.day}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-btn flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-bold ${tab === t.id ? 'active' : ''}`}>
                <span>{t.icon}</span>
                {t.name}
                {t.badge ? <span className="font-pixel bg-[#0f0906] px-1 py-[2px] text-[7px] text-[#ffcf6a]">{t.badge}</span> : null}
              </button>
            ))}
            <button onClick={onClose} className="px-btn px-btn-red font-pixel px-3 py-2 text-[10px]">
              ✕
            </button>
          </div>
        </div>
        {tab === 'chron' && <ChronTab snap={snap} />}
        {tab === 'ach' && <AchTab snap={snap} />}
        {tab === 'car' && <CarTab game={game} snap={snap} />}
        {tab === 'rivals' && <RivalsTab snap={snap} />}
        {tab === 'wonders' && <WondersTab game={game} snap={snap} onClose={onClose} />}
        {tab === 'victory' && <VictoryTab snap={snap} />}
        <div className="mt-2 text-[12px] text-[#a08868]">
          Горячие клавиши: <b className="text-[#ffcf6a]">P</b> — хроники, <b className="text-[#ffcf6a]">U</b> — достижения.
        </div>
      </div>
    </div>
  );
}

void TH;

import { ACHIEVEMENTS } from '../game/achievements';
import type { Game, Snapshot } from '../game/game';
import { VICTORY_INFO } from '../game/victory';
import { LineChart } from './Charts';
import { chronText, downloadChronImage } from './RealmPanel';

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="px-inset flex items-center gap-2 px-3 py-2">
      <span className="text-[22px]">{icon}</span>
      <div className="leading-tight">
        <div className="text-[18px] font-bold text-[#fff3d0]">{value}</div>
        <div className="text-[12px] text-[#c8b088]">{label}</div>
      </div>
    </div>
  );
}

/** Итоги партии: победа или поражение, статистика и графики */
export function EndScreen({ snap, mode, onContinue, onMenu, game }: { game: Game; snap: Snapshot; mode: 'victory' | 'defeat'; onContinue?: () => void; onMenu: () => void }) {
  const X = snap.ext;
  const v = X.victory;
  const info = v ? VICTORY_INFO[v.type] : null;
  const samples = X.samples.length ? X.samples : [];
  const prov = snap.towns.filter((t) => t.owner === 'player').length;
  const wonders = X.wonders.filter((w) => w.owner === 'player').length;
  const hl = X.chron.filter((e) => ['good', 'war', 'wonder', 'gov', 'death'].includes(e.kind)).slice(-7);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3">
      <div className="px-panel scroll-px flex max-h-[96vh] w-full max-w-[1000px] flex-col gap-4 overflow-y-auto p-5">
        <div className="text-center">
          <div className="font-pixel text-[9px] tracking-[0.3em] text-[#ffcf6a]">{mode === 'victory' ? '★ ПОБЕДА ★' : '☠ КОНЕЦ ИСТОРИИ ☠'}</div>
          <h2 className="px-title mt-2 text-[20px] leading-snug sm:text-[28px]" style={{ color: mode === 'victory' ? undefined : '#ff9a8a' }}>
            {mode === 'victory' && info ? `${info.icon} ${info.name.toUpperCase()}` : 'ПЛЕМЯ ИСЧЕЗЛО'}
          </h2>
          <p className="mx-auto mt-2 max-w-[640px] text-[16px] text-[#e8d4a8]">
            {mode === 'victory' && info ? `«${snap.name}» вошло в историю на ${v!.day}-й день (год ${snap.ext.season.year}). ${info.desc}` : 'Без еды и людей история закончилась. Но новое селение уже ждёт на другой земле.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon="📅" label="Дней прожито" value={snap.day} />
          <Stat icon="👥" label="Население" value={snap.pop} />
          <Stat icon="🏘️" label="Провинций" value={prov} />
          <Stat icon="💡" label="Технологий" value={snap.done.length} />
          <Stat icon="💰" label="Золото" value={snap.res.gold} />
          <Stat icon="📦" label="Товары" value={snap.res.goods} />
          <Stat icon="🗺️" label="Контроль карты" value={`${Math.round(X.prog.mil * 100)}%`} />
          <Stat icon="⚔️" label="Побед в боях" value={X.cnt.battlesWon} />
          <Stat icon="🏴" label="Захвачено силой" value={X.cnt.conquered} />
          <Stat icon="🤝" label="Присоединено мирно" value={X.cnt.peace} />
          <Stat icon="🐎" label="Караванов доставлено" value={`${X.cnt.caravansDone} (−${X.cnt.caravansLost})`} />
          <Stat icon="🏆" label="Достижений" value={`${Object.keys(X.ach).length}/${ACHIEVEMENTS.length}`} />
          <Stat icon="✦" label="Чудес во владении" value={wonders} />
          <Stat icon="🗡" label="Разбойников разбито" value={X.cnt.banditsKilled} />
          <Stat icon="✊" label="Бунтов подавлено" value={X.cnt.riots} />
          <Stat icon="♛" label="Поглощений ИИ" value={X.cnt.absorbed} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LineChart title="НАСЕЛЕНИЕ И ПРОВИНЦИИ" samples={samples} series={[{ key: 'pop', label: 'жители', color: '#ffe27a' }, { key: 'prov', label: 'провинции', color: '#7dff8c' }]} />
          <LineChart title="КАЗНА" samples={samples} series={[{ key: 'gold', label: 'золото', color: '#f2c94c' }, { key: 'goods', label: 'товары', color: '#7fd8e0' }]} />
          <LineChart title="НАУКА" samples={samples} series={[{ key: 'techs', label: 'технологии', color: '#4aa8ff' }]} />
          <LineChart title="ТЕРРИТОРИЯ И АРМИЯ" samples={samples} series={[{ key: 'land', label: '% карты', color: '#e5484d' }, { key: 'army', label: 'воины', color: '#c0a0ff' }]} />
        </div>

        {hl.length > 0 && (
          <div className="px-inset p-3">
            <div className="font-pixel mb-2 text-[8px] text-[#ffcf6a]">ВЕХИ ЛЕТОПИСИ</div>
            {hl.map((e, i) => (
              <div key={i} className="text-[14px] text-[#f3e3c0]">
                <b className="text-[#ffcf6a]">День {e.day}:</b> {e.text}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {mode === 'victory' && onContinue && (
            <button onClick={onContinue} className="px-btn px-btn-green font-pixel px-4 py-3 text-[11px] text-white">
              ▶ ПРОДОЛЖИТЬ ИГРУ
            </button>
          )}
          <button onClick={() => downloadChronImage(snap.name, X.chron)} className="px-btn font-pixel px-4 py-3 text-[10px]">
            🖼 ЛЕТОПИСЬ (PNG)
          </button>
          <button onClick={() => navigator.clipboard?.writeText(chronText(snap.name, X.chron))} className="px-btn font-pixel px-4 py-3 text-[10px]">
            📋 КОПИРОВАТЬ
          </button>
          <button onClick={onMenu} className="px-btn px-btn-gold font-pixel px-4 py-3 text-[11px]">
            ⌂ В ГЛАВНОЕ МЕНЮ
          </button>
        </div>
      </div>
      <span className="hidden">{game.name}</span>
    </div>
  );
}

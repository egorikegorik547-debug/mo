import { useCallback, useEffect, useState } from 'react';
import type { Game } from '../game/game';
import { SPECS, type SpecId } from '../game/meta';
import { SLOT_IDS, deleteSave, listSaves, loadGame, saveGame, type SaveMeta } from '../game/saves';

const NAMES: Record<string, string> = { auto: '⟳ Автосохранение', s1: 'Слот 1', s2: 'Слот 2', s3: 'Слот 3' };

const fmtDate = (t: number) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function SavesModal({ game, canSave, onClose, onLoaded }: { game: Game; canSave: boolean; onClose: () => void; onLoaded: () => void }) {
  const [metas, setMetas] = useState<Record<string, SaveMeta>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    listSaves().then(setMetas);
  }, []);
  useEffect(refresh, [refresh]);

  const run = async (id: string, kind: 'save' | 'load' | 'del') => {
    setBusy(id + kind);
    setNote(null);
    try {
      if (kind === 'save') {
        await saveGame(game, id);
        setNote({ ok: true, text: `Сохранено: ${NAMES[id]}` });
      } else if (kind === 'load') {
        const ok = await loadGame(game, id);
        if (!ok) setNote({ ok: false, text: 'Сохранение не найдено или повреждено' });
        else {
          onLoaded();
          return;
        }
      } else {
        await deleteSave(id);
      }
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Ошибка' });
    }
    setBusy(null);
    refresh();
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="px-panel scroll-px flex max-h-[92vh] w-full max-w-[620px] flex-col gap-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[14px] text-[#ffe9a8]">💾 СОХРАНЕНИЯ</h2>
          <button onClick={onClose} className="px-btn px-btn-red font-pixel px-3 py-2 text-[10px]">
            ✕
          </button>
        </div>
        <div className="text-[13px] text-[#c8b088]">Автосохранение пишется каждые 45 секунд и при закрытии вкладки. Файлы лежат в браузере (IndexedDB) — даже случайное обновление страницы не страшно.</div>
        {SLOT_IDS.map((id) => {
          const m = metas[id];
          const isAuto = id === 'auto';
          return (
            <div key={id} className="px-inset flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-[200px] flex-1">
                <div className="font-pixel text-[9px] text-[#ffcf6a]">{NAMES[id].toUpperCase()}</div>
                {m ? (
                  <div className="mt-1 text-[14px] leading-snug text-[#f3e3c0]">
                    {SPECS[m.spec as SpecId]?.icon} <b>{m.name}</b> · {m.tier}
                    <br />
                    День {m.day} · {m.season} · 👥 {m.pop} · 🏘 {m.prov}
                    <div className="text-[12px] text-[#a08868]">
                      {fmtDate(m.at)} · {Math.max(1, Math.round(m.size / 1024))} КБ
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-[14px] text-[#a08868]">— пусто —</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {canSave && !isAuto && (
                  <button disabled={!!busy} onClick={() => run(id, 'save')} className="px-btn px-btn-gold px-3 py-1.5 text-[13px] font-bold">
                    {busy === id + 'save' ? '…' : '💾 Сохранить'}
                  </button>
                )}
                <button disabled={!m || !!busy} onClick={() => run(id, 'load')} className="px-btn px-btn-green px-3 py-1.5 text-[13px] font-bold text-white">
                  {busy === id + 'load' ? '…' : '📂 Загрузить'}
                </button>
                {!isAuto && m && (
                  <button disabled={!!busy} onClick={() => run(id, 'del')} className="px-btn px-btn-red px-3 py-1 text-[12px] font-bold">
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {note && <div className="text-[14px]" style={{ color: note.ok ? '#8aff9a' : '#ff9a8a' }}>{note.text}</div>}
      </div>
    </div>
  );
}

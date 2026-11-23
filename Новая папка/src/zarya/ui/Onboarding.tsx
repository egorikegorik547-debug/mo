import { useEffect, useRef, useState } from 'react';
import { BUILDINGS } from '../game/data';
import type { Game, Snapshot } from '../game/game';
import { TECH_BY_ID } from '../game/techs';

/* ───────────── Хранилище «уже показывали» ───────────── */

const HINT_KEY = 'zarya_hints_seen';
const TUT_DONE_KEY = 'zarya_tutorial_done';

export function loadSeenHints(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(HINT_KEY) || '{}');
  } catch {
    return {};
  }
}
export function saveSeenHint(id: string) {
  try {
    const s = loadSeenHints();
    s[id] = true;
    localStorage.setItem(HINT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function resetSeenHints() {
  try {
    localStorage.removeItem(HINT_KEY);
  } catch {
    /* ignore */
  }
}
export function loadTutorialPref(): boolean {
  try {
    const v = localStorage.getItem('zarya_tutorial_mode');
    if (v === null) return localStorage.getItem(TUT_DONE_KEY) !== '1';
    return v === '1';
  } catch {
    return true;
  }
}
export function saveTutorialPref(on: boolean) {
  try {
    localStorage.setItem('zarya_tutorial_mode', on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const Key = ({ k }: { k: string }) => <span className="font-pixel mx-0.5 inline-block bg-[#0f0906] px-1.5 py-[3px] align-middle text-[8px] text-[#ffcf6a]">{k}</span>;

/* ───────────── Шаги обучения ───────────── */

interface Step {
  id: string;
  icon: string;
  title: string;
  text: React.ReactNode;
  keys: string[];
  done: (s: Snapshot) => boolean;
  /** подсветка кнопок HUD (data-tut) */
  target: (s: Snapshot, g: Game) => string[];
  need?: string;
  subs?: (s: Snapshot, g: Game) => { t: string; ok: boolean }[];
}

const hasB = (g: Game, id: string) => g.buildings.some((b) => b.type === id);

export const STEPS: Step[] = [
  {
    id: 'select',
    icon: '👥',
    title: 'Выделите жителей',
    text: 'Кликните по человеку, обведите группу рамкой или нажмите кнопку «Все».',
    keys: ['ЛКМ', 'рамка', 'G'],
    done: (s) => s.tut.sel,
    target: () => ['all'],
  },
  {
    id: 'chop',
    icon: '🪓',
    title: 'Добудьте дерево',
    text: 'Выделенных людей отправьте рубить: ПКМ по дереву — или инструмент «Рубить» и рамка по лесу.',
    keys: ['ПКМ', 'Q'],
    done: (s) => s.tut.chop,
    target: (s) => (s.selCount ? ['chop'] : ['all']),
  },
  {
    id: 'gather',
    icon: '🫐',
    title: 'Соберите еду',
    text: 'Без еды племя вымрет. ПКМ по кусту с красными ягодами — или инструмент «Ягоды».',
    keys: ['ПКМ', 'E'],
    done: (s) => s.tut.gather,
    target: (s) => (s.selCount ? ['gather'] : ['all']),
  },
  {
    id: 'tech',
    icon: '💡',
    title: 'Первая технология',
    text: 'Откройте древо знаний и запустите изучение «Шалаша» (он нужен для жилья) или «Огня».',
    keys: ['T'],
    done: (s) => s.tut.tech,
    target: () => ['tree'],
  },
  {
    id: 'shelter',
    icon: '⛺',
    title: 'Постройте Шалаш',
    text: 'Жильё → рост населения: пока в шалашах есть места, в племени рождаются дети. Меню стройки → «Жильё» → Шалаш.',
    keys: ['B'],
    need: BUILDINGS.shelter?.req ?? undefined,
    done: (s) => s.tut.shelter,
    target: (s) => (s.done.includes('shelter') ? ['build', 'cat-home', 'b-shelter'] : ['tree']),
  },
  {
    id: 'auto',
    icon: '⚡',
    title: 'Авто-распределение',
    text: 'Когда появились свободные руки, нажмите «Авто»: работа раздастся сама, по нехватке ресурсов.',
    keys: ['J'],
    done: (s) => s.tut.auto,
    target: () => ['auto'],
  },
  {
    id: 'workshop',
    icon: '🔨',
    title: 'Мастерская и крафт',
    text: 'Постройте Мастерскую, затем в окне «Жизнь» закажите первый предмет — корзину или топор.',
    keys: ['B', 'N'],
    need: BUILDINGS.workshop?.req ?? undefined,
    done: (s) => s.tut.craft,
    target: (s) => (s.tut.workshop ? ['life'] : ['build', 'cat-ind', 'b-workshop']),
    subs: (s, g) => [
      { t: 'Построить мастерскую', ok: s.tut.workshop || hasB(g, 'workshop') },
      { t: 'Заказать предмет', ok: s.tut.craft },
    ],
  },
  {
    id: 'stone',
    icon: '🪨',
    title: 'Камень и поля',
    text: 'Изучите «Каменные орудия» и добудьте первый камень (инструмент «Камень») — или постройте Поле.',
    keys: ['T', 'R'],
    need: 'stone_tools',
    done: (s) => s.tut.stone,
    target: (s) => (s.done.includes('stone_tools') ? ['mine', 'build'] : ['tree']),
    subs: (s) => [
      { t: 'Изучить «Каменные орудия»', ok: s.done.includes('stone_tools') },
      { t: 'Добыть камень или построить Поле', ok: s.tut.stone },
    ],
  },
  {
    id: 'army',
    icon: '⚔️',
    title: 'Армия и оборона',
    text: 'Постройте Казарму, сковайте оружие и обучите первого воина во вкладке «Война».',
    keys: ['B', 'V'],
    need: BUILDINGS.barracks?.req ?? undefined,
    done: (s) => s.tut.army,
    target: (_s, g) => (hasB(g, 'barracks') ? ['world'] : ['build', 'cat-war', 'b-barracks']),
    subs: (s, g) => [
      { t: 'Построить казарму', ok: hasB(g, 'barracks') },
      { t: 'Обучить воина', ok: s.tut.army },
    ],
  },
  {
    id: 'state',
    icon: '🏛️',
    title: 'Путь к государству',
    text: 'Откройте карту мира, улучшите отношения с соседом подарком — или захватите его селение. Два селения вместе — уже Государство!',
    keys: ['V'],
    done: (s) => s.tut.state,
    target: () => ['world'],
  },
];

/** Подсвечивает кнопки HUD (рамка + стрелка), пока шаг не выполнен. */
function useHighlight(names: string[]) {
  const key = names.join('|');
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll('.tut-hl').forEach((e) => {
        const n = (e as HTMLElement).dataset.tut ?? '';
        if (!names.includes(n)) e.classList.remove('tut-hl');
      });
      for (const n of names) document.querySelectorAll(`[data-tut="${n}"]`).forEach((e) => e.classList.add('tut-hl'));
    };
    apply();
    const t = window.setInterval(apply, 350);
    return () => {
      window.clearInterval(t);
      document.querySelectorAll('.tut-hl').forEach((e) => e.classList.remove('tut-hl'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function TutorialCard({ game, snap, onExit }: { game: Game; snap: Snapshot; onExit: () => void }) {
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const prevIdx = useRef(0);
  const idx = STEPS.findIndex((s) => !s.done(snap) && !skipped[s.id]);
  const finished = idx === -1;
  const step = finished ? null : STEPS[idx];

  useEffect(() => {
    if (idx !== prevIdx.current) {
      const done = STEPS[prevIdx.current];
      if (done && done.done(snap)) {
        setFlash(`✔ ${done.title}`);
        const t = window.setTimeout(() => setFlash(null), 2600);
        prevIdx.current = idx === -1 ? STEPS.length : idx;
        return () => window.clearTimeout(t);
      }
      prevIdx.current = idx === -1 ? STEPS.length : idx;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (finished) {
      try {
        localStorage.setItem(TUT_DONE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, [finished]);

  useHighlight(step ? step.target(snap, game) : []);

  const needTech = step?.need && !snap.done.includes(step.need) ? TECH_BY_ID[step.need] : null;
  const total = STEPS.length;
  const doneCount = STEPS.filter((s) => s.done(snap)).length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[150px] z-[15] flex flex-col items-center gap-1.5 px-2">
      {flash && (
        <div className="fade-up font-pixel pointer-events-none bg-[#1f5a2a] px-3 py-1.5 text-[9px] text-[#c8ffd0]" style={{ boxShadow: '0 0 0 2px #0f0906, inset 0 0 0 1px #7dff8c' }}>
          {flash}
        </div>
      )}
      <div className="px-panel pointer-events-auto w-[min(440px,94vw)] px-3 py-2.5">
        {finished ? (
          <div className="flex items-center gap-3">
            <span className="px-inset flex h-11 w-11 shrink-0 items-center justify-center text-[24px]">🎓</span>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[10px] text-[#ffe9a8]">ОБУЧЕНИЕ ПРОЙДЕНО</div>
              <div className="mt-1 text-[14px] leading-tight text-[#e8d4a8]">Вы знаете основы. Дальше — свобода: растите династию, стройте державу. Справочник — кнопка «?» в меню паузы.</div>
            </div>
            <button onClick={onExit} className="px-btn px-btn-green font-pixel px-3 py-2 text-[9px] text-white">
              ОК
            </button>
          </div>
        ) : (
          step && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[8px] text-[#ffcf6a]">
                  ШАГ {doneCount + 1}/{total}
                </span>
                <div className="flex flex-1 gap-[3px]">
                  {STEPS.map((s) => (
                    <span key={s.id} className="h-1.5 flex-1" style={{ background: s.done(snap) ? '#7dff8c' : s.id === step.id ? '#ffcf6a' : '#3a2a1c', boxShadow: '0 0 0 1px #0f0906' }} />
                  ))}
                </div>
                <button onClick={() => setSkipped((m) => ({ ...m, [step.id]: true }))} className="font-pixel text-[7px] text-[#a88a60] hover:text-[#ffe9a8]" title="Пропустить этот шаг">
                  ПРОПУСТИТЬ ▶
                </button>
                <button onClick={onExit} className="font-pixel text-[9px] text-[#c8786a] hover:text-[#ff9a8a]" title="Выйти из обучения">
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-start gap-3">
                <span className="px-inset pulse-px flex h-11 w-11 shrink-0 items-center justify-center text-[24px]">{step.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-pixel text-[10px] leading-snug text-[#ffe9a8]">{step.title.toUpperCase()}</div>
                  <div className="mt-1 text-[14px] leading-tight text-[#f3e3c0]">{step.text}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {step.keys.map((k) => (
                      <Key key={k} k={k} />
                    ))}
                    {step.subs &&
                      step.subs(snap, game).map((sb) => (
                        <span key={sb.t} className="ml-1 text-[12px]" style={{ color: sb.ok ? '#8aff9a' : '#c8b088' }}>
                          {sb.ok ? '☑' : '☐'} {sb.t}
                        </span>
                      ))}
                  </div>
                  {needTech && (
                    <div className="mt-1.5 text-[12px] text-[#ffb070]">
                      🔒 Сначала изучите «{needTech.name}» <Key k="T" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

/* ───────────── «Первое знакомство» с панелями ───────────── */

interface HintDef {
  icon: string;
  title: string;
  points: React.ReactNode[];
}

export const HINTS: Record<string, HintDef> = {
  court: {
    icon: '👑',
    title: 'Двор — как это работает',
    points: [
      'Налоги: «оброк» даёт золото, «барщина» — бесплатный труд зависимых на землях помещика.',
      'Чем выше налоги и барщина, тем быстрее растёт недовольство. Высокое — это бунты и сожжённые поля.',
      'Указы — временные бонусы за золото. Включайте их в трудные времена.',
      'Наместники правят захваченными селениями: лояльные приносят дань, жадные — воруют.',
    ],
  },
  eco: {
    icon: '💰',
    title: 'Экономика — как это работает',
    points: [
      'Сырьё (дерево, камень, еда) → цеха → товары. Товары нужны для зданий, армии и продажи.',
      'Склады ограничивают запас каждого ресурса. Нет места — добыча пропадает.',
      'Рынок меняет ресурсы на золото и обратно. Цены качаются: продавайте то, что в избытке.',
      'Здания и армия требуют золота на содержание. Следите за «−» у монетки.',
    ],
  },
  life: {
    icon: '🌍',
    title: 'Жизнь — как это работает',
    points: [
      'В мастерских и кузницах заказывают предметы: инструменты ускоряют работу, оружие нужно воинам.',
      'У каждого жителя есть род и черта характера. Дети вырастают и наследуют фамилию.',
      'Ночью могут прийти воры. Стража и огонь у домов их отпугивают.',
      'Павших хоронят на кладбище — память о предках даёт бонусы.',
    ],
  },
  world: {
    icon: '⚔️',
    title: 'Война и мир — как это работает',
    points: [
      'Соседние селения — на карте. Подарки улучшают отношение, золото покупает мирное присоединение.',
      'Для похода нужна казарма и обученные воины. Победа — захват селения.',
      'Два и больше селения образуют Государство — выберите форму правления.',
      'За море ходит флот: нужна технология мореплавания.',
    ],
  },
  manor: {
    icon: '🏰',
    title: 'Усадьба помещика',
    points: [
      'Помещик получает землю и сам собирает с неё урожай или руду.',
      'Крепостные работают на барщине, рабы — только на хозяина, свободные — платят оброк.',
      'Если помещика обложить слишком сильно — зависимые взбунтуются.',
    ],
  },
  gov: {
    icon: '🏛️',
    title: 'Форма правления',
    points: [
      'Монархия — быстрые решения и сильная армия, но недовольство копится тихо.',
      'Республика — больше золота и знаний, зато любой указ дороже.',
      'Форму можно сменить позже, но это стоит золота и вызывает смуту.',
    ],
  },
};

export function HintCard({ id, onClose }: { id: string; onClose: () => void }) {
  const h = HINTS[id];
  if (!h) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[14%] z-[45] flex justify-center px-3">
      <div className="px-panel fade-up pointer-events-auto w-[min(460px,94vw)] p-4">
        <div className="flex items-center gap-3">
          <span className="px-inset flex h-11 w-11 items-center justify-center text-[24px]">{h.icon}</span>
          <div>
            <div className="font-pixel text-[7px] text-[#ffcf6a]">ПЕРВОЕ ЗНАКОМСТВО</div>
            <div className="font-pixel mt-1 text-[10px] leading-snug text-[#ffe9a8]">{h.title.toUpperCase()}</div>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {h.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-tight text-[#f3e3c0]">
              <span className="text-[#ffcf6a]">▪</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="px-btn px-btn-green font-pixel mt-3 w-full px-3 py-2.5 text-[10px] text-white">
          ПОНЯТНО
        </button>
      </div>
    </div>
  );
}

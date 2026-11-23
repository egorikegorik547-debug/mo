import { useState } from 'react';
import { icons } from './icons';
import { resetSeenHints } from './Onboarding';

/* ───────────── мелкие кирпичики ───────────── */

const Key = ({ k }: { k: string }) => <span className="px-btn font-pixel mx-0.5 inline-block px-1.5 py-[5px] align-middle text-[8px]">{k}</span>;

function Res({ k, label }: { k: 'wood' | 'stone' | 'food' | 'goods' | 'gold' | 'know'; label?: string }) {
  const ic = icons();
  const names = { wood: 'дерево', stone: 'камень', food: 'еда', goods: 'товары', gold: 'золото', know: 'знания' };
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 align-middle font-bold text-[#ffe9a8]">
      <img src={ic[k]} className="pix inline h-4 w-4" alt="" />
      {label ?? names[k]}
    </span>
  );
}

function Card({ icon, title, children, tone }: { icon: string; title: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="px-inset flex flex-col gap-1.5 p-3" style={tone ? { boxShadow: `inset 0 0 0 2px ${tone}55` } : undefined}>
      <div className="flex items-center gap-2">
        <span className="text-[22px] leading-none">{icon}</span>
        <span className="font-pixel text-[9px] leading-snug text-[#ffe9a8]">{title.toUpperCase()}</span>
      </div>
      <div className="text-[14px] leading-snug text-[#f3e3c0]">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-l-4 border-[#ffcf6a] bg-[#1d130c] px-3 py-2 text-[14px] leading-snug text-[#e8d4a8]">
      <span className="text-[16px]">💡</span>
      <div>{children}</div>
    </div>
  );
}

function Arrow() {
  return <span className="font-pixel self-center text-[14px] text-[#ffcf6a]">▶</span>;
}

function Node({ icon, title, lines, color }: { icon: string; title: string; lines: React.ReactNode; color: string }) {
  return (
    <div className="px-inset flex min-w-[130px] flex-1 flex-col items-center gap-1 p-2.5 text-center" style={{ boxShadow: `inset 0 0 0 2px ${color}88` }}>
      <span className="text-[26px] leading-none">{icon}</span>
      <span className="font-pixel text-[8px] text-[#ffe9a8]">{title}</span>
      <span className="text-[13px] leading-tight text-[#e8d4a8]">{lines}</span>
    </div>
  );
}

function Meter({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-[110px] shrink-0 text-[#e8d4a8]">{label}</span>
      <div className="h-3 flex-1 bg-[#0f0906] p-[2px]">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ───────────── вкладки ───────────── */

function TabStart() {
  const hk: [string, string, string][] = [
    ['WASD', '🎥', 'Камера. Ещё: стрелки, средняя кнопка мыши, клик по миникарте, колесо — масштаб.'],
    ['ЛКМ', '👆', 'Выбрать человека. Тяните рамку — выберете сразу группу.'],
    ['G', '👥', 'Выбрать всех жителей. F — только свободных.'],
    ['ПКМ', '🎯', 'Приказ: по дереву — рубить, по кусту — ягоды, по камню — добыча, по стройке — строить, по земле — идти.'],
    ['Q E R', '🪓', 'Рубить · ягоды · камень. Выберите людей, нажмите букву и обведите цели рамкой.'],
    ['X', '■', 'Стоп: отменить работу выбранных.'],
    ['J', '⚡', 'Авто: свободные сами идут туда, где не хватает ресурсов.'],
    ['Пробел', '⏯', 'Пауза. Клавиши 1, 2, 3 — скорость игры.'],
  ];
  const win: [string, string, string][] = [
    ['T', '💡', 'Знания'],
    ['B', '🏠', 'Стройка'],
    ['M', '💰', 'Экономика'],
    ['N', '🌍', 'Жизнь'],
    ['K', '👑', 'Двор'],
    ['V', '⚔️', 'Война'],
    ['L', '🏴', 'Земли'],
    ['O', '🗺️', 'Границы'],
    ['H', '👁', 'Скрыть HUD'],
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-[#e8d4a8]">Вы ведёте маленькое племя. Сначала — <b className="text-[#ffcf6a]">дерево и ягоды</b>, потом знания, жильё и мастерские. Остальное придёт само.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {hk.map(([k, i, t]) => (
          <div key={k} className="px-inset flex items-start gap-2.5 p-2.5">
            <div className="flex w-[64px] shrink-0 flex-col items-center gap-1">
              <span className="text-[22px] leading-none">{i}</span>
              <Key k={k} />
            </div>
            <div className="text-[14px] leading-snug text-[#f3e3c0]">{t}</div>
          </div>
        ))}
      </div>
      <div className="font-pixel text-[8px] text-[#ffcf6a]">ОКНА ИГРЫ</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {win.map(([k, i, t]) => (
          <div key={k} className="px-inset flex flex-col items-center gap-1 p-2">
            <span className="text-[20px] leading-none">{i}</span>
            <span className="text-[12px] font-bold text-[#f3e3c0] uppercase">{t}</span>
            <Key k={k} />
          </div>
        ))}
      </div>
      <Tip>
        Не знаете, с чего начать? Включите <b>режим обучения</b> при создании мира — пиксельная плашка будет вести вас по шагам и подсвечивать нужную кнопку.
      </Tip>
      <button
        onClick={() => {
          resetSeenHints();
        }}
        className="px-btn font-pixel self-start px-3 py-2 text-[8px]"
        title="Подсказки «Как это работает» снова покажутся при первом открытии вкладок"
      >
        ↺ ПОКАЗАТЬ ПОДСКАЗКИ СНОВА
      </button>
    </div>
  );
}

function TabResources() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-[#e8d4a8]">Всё держится на цепочке: добыли сырьё, переработали в цехах, получили товары — и пустили их в дело.</p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row">
        <Node
          icon="🌲"
          title="СЫРЬЁ"
          color="#7bc043"
          lines={
            <>
              <Res k="wood" /> <Res k="stone" /> <Res k="food" />
              <br />
              Рубка, шахта, ягоды, поля
            </>
          }
        />
        <Arrow />
        <Node icon="🏭" title="ЦЕХА" color="#f08a24" lines={<>Мастерская, плавильня, литейная, завод. Нужны работники — свободные жители.</>} />
        <Arrow />
        <Node
          icon="📦"
          title="ТОВАРЫ"
          color="#7fd8e0"
          lines={
            <>
              <Res k="goods" />
              <br />
              +20% к скорости работ
            </>
          }
        />
        <Arrow />
        <Node icon="🔧" title="ИТОГ" color="#ffd45a" lines={<>Инструменты, оружие, здания, армия, торговля</>} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card icon="🪙" title="Рынок">
          Меняет <Res k="wood" /> <Res k="stone" /> <Res k="food" /> <Res k="goods" /> на <Res k="gold" /> и обратно. Цены качаются — продавайте избыток, докупайте дефицит. Каждый рынок снижает комиссию.
        </Card>
        <Card icon="🏚️" title="Склады">
          У каждого ресурса свой потолок. Когда склад полон, добыча зря пропадает. Склад и амбар поднимают потолок и принимают ношу.
        </Card>
        <Card icon="🔨" title="Инструменты">
          Заказываются в окне «Жизнь» <Key k="N" />. Топор ускоряет рубку, кирка — добычу, корзина — ягоды. Без них работа идёт медленнее.
        </Card>
        <Card icon="💡" title="Знания и золото">
          <Res k="know" /> копятся от библиотек и святилищ и тратятся на технологии <Key k="T" />. <Res k="gold" /> — налоги и торговля, минус содержание зданий и воинов.
        </Card>
      </div>
      <Tip>
        Красная цифра у ресурса в верхней панели — он <b>тратится быстрее, чем добывается</b>. Нажмите <Key k="J" />, и свободные люди закроют дыру сами.
      </Tip>
    </div>
  );
}

function TabLife() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-[#e8d4a8]">Здесь живут не «единицы», а люди с именами. Они любят, растят детей и умирают — а память остаётся.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card icon="👶" title="Роды и дети" tone="#ff9ac8">
          Пока в домах есть свободные места и хватает еды, рождаются дети. Малыши сначала растут, затем становятся рабочими руками и носят фамилию рода.
        </Card>
        <Card icon="🧬" title="Черты характера" tone="#ffd45a">
          Трудяга, ленивец, храбрец, мечтатель… Черта влияет на скорость работы и бой. Смотрите её во вкладке «Жизнь» <Key k="N" />.
        </Card>
        <Card icon="🏹" title="Охота" tone="#c8a070">
          Дом охотника отправляет людей в лес за мясом. Это быстрая еда, но звери кусаются — берегите охотников.
        </Card>
        <Card icon="🌙" title="Ночь и воры" tone="#8a8aff">
          Ночью жители спят, а к окнам кладовых крадутся воры. Огонь и стража отпугивают их, пойманного вора можно допросить.
        </Card>
        <Card icon="🪦" title="Кладбище и память" tone="#9aa0b0">
          Павших хоронят на кладбище. Чем больше помнят предков, тем выше моральный бонус: «Память рода» делает людей стойче.
        </Card>
        <Card icon="🧳" title="Странники" tone="#7bc043">
          Время от времени приходят торговцы, лекари и наёмники. Они предлагают обмен или задание — выполните и получите награду.
        </Card>
      </div>
      <Tip>
        Старейшины рода седеют и ходят с посохом, ремесленники носят фартуки, ветераны — шрамы и повязки, а богачи — нарядные одежды. Так легко отличить своих.
      </Tip>
    </div>
  );
}

function TabSocial() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-[#e8d4a8]">С ростом поселения появляются сословия. Открывается окно «Двор» <Key k="K" />.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card icon="🏰" title="Помещики и усадьбы" tone="#ffd45a">
          Помещик получает усадьбу и угодья. Он собирает урожай или руду с земли и делится с вами оброком.
        </Card>
        <Card icon="⛓️" title="Крепостные и рабы" tone="#9aa0b0">
          <b>Свободные</b> платят налоги, <b>крепостные</b> привязаны к земле и отбывают барщину, <b>рабы</b> работают только на хозяина.
        </Card>
        <Card icon="🌾" title="Барщина и оброк" tone="#7bc043">
          Барщина — дни труда на помещика. Оброк — часть урожая или золото. Выше ставка — больше казна, но и злее народ.
        </Card>
        <Card icon="📜" title="Указы" tone="#b362ff">
          За золото вводятся на время: праздник, призыв, амнистия, строгость. Выберите то, что нужно прямо сейчас.
        </Card>
      </div>
      <div className="px-inset flex flex-col gap-2 p-3">
        <div className="font-pixel text-[8px] text-[#ffcf6a]">НЕДОВОЛЬСТВО И БУНТЫ</div>
        <Meter label="😊 Всё спокойно" pct={25} color="#7dff8c" />
        <Meter label="😠 Ропот" pct={55} color="#ffd45a" />
        <Meter label="🔥 Бунт" pct={92} color="#ff6a5a" />
        <div className="text-[13px] leading-snug text-[#c8b088]">Выше налоги и барщина → растёт шкала. На красной отметке зависимые жгут поля и убивают помещика. Снижайте ставки, вводите праздник или усиливайте стражу.</div>
      </div>
    </div>
  );
}

function TabState() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug text-[#e8d4a8]">Присоедините хотя бы одно соседнее селение — и родится <b className="text-[#ffcf6a]">Государство</b>. Дальше — политика и война <Key k="V" />.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card icon="👑" title="Формы правления" tone="#ffd45a">
          Монархия — крепкая армия и быстрые решения. Республика — золото и знания. Конституционные и парламентские — мягче к народу, но медленнее.
        </Card>
        <Card icon="🧑‍⚖️" title="Наместники и ревизия" tone="#b362ff">
          В каждую провинцию назначается наместник из героев. Лояльный шлёт дань, жадный ворует. Ревизия вскрывает коррупцию — но обижает честных.
        </Card>
        <Card icon="🏛️" title="Перенос столицы" tone="#f2c94c">
          Столицу можно перенести в удачный город — дальше от границ или ближе к ресурсам. Стоит золота и временно ослабляет лояльность.
        </Card>
        <Card icon="🏴" title="Захват земель флагами" tone="#7dff8c">
          Инструмент «Земли» <Key k="L" />: ставите флаг на пустой земле у своей границы — и угодья ваши. Соседи тоже захватывают землю, не медлите.
        </Card>
        <Card icon="🛡️" title="Походы" tone="#ff6a5a">
          Казарма → воины → «Война» <Key k="V" />. Выберите цель, отправьте отряд. Победа — захват, дипломатия — мирная аннексия за золото.
        </Card>
        <Card icon="⛵" title="Морской флот" tone="#4aa8ff">
          Технология мореплавания открывает путь за море: острова и дальние селения достижимы только кораблями. Береговые города — главная цель.
        </Card>
      </div>
      <Tip>
        Тропы между домами и лесом со временем вытаптываются, а после «Мощёных дорог» — превращаются в брусчатку: смотрите, как <b>растёт</b> ваше поселение.
      </Tip>
    </div>
  );
}

const TABS = [
  { id: 'start', icon: '🧭', name: 'Старт и управление', view: TabStart },
  { id: 'res', icon: '🪵', name: 'Ресурсы и производство', view: TabResources },
  { id: 'life', icon: '🌙', name: 'Жизнь, династии и ночь', view: TabLife },
  { id: 'soc', icon: '👑', name: 'Сословия и Двор', view: TabSocial },
  { id: 'state', icon: '🏛️', name: 'Государство и война', view: TabState },
];

/** Справочник правителя */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('start');
  const View = TABS.find((t) => t.id === tab)!.view;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-3" onClick={onClose}>
      <div className="px-panel pointer-events-auto flex max-h-[94vh] w-full max-w-[860px] flex-col p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-pixel text-[13px] text-[#ffe9a8]">📖 СПРАВОЧНИК ПРАВИТЕЛЯ</h2>
          <button onClick={onClose} className="px-btn px-btn-red font-pixel px-3 py-2 text-[10px]">
            ✕
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-btn flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold ${tab === t.id ? 'active' : ''}`}>
              <span className="text-[16px]">{t.icon}</span>
              <span className="hidden sm:inline">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="scroll-px min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 className="font-pixel mb-3 text-[11px] text-[#ffcf6a]">
            {TABS.find((t) => t.id === tab)!.icon} {TABS.find((t) => t.id === tab)!.name.toUpperCase()}
          </h3>
          <View />
        </div>
      </div>
    </div>
  );
}

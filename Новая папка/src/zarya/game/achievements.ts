import type { Game } from './game';
import { chron, dayNo, maxGeneration } from './extstate';
import { strongStates } from './rivals';
import type { Mods } from './techs';
import { wonderCount } from './wonders';

/* ───────────── Достижения и открываемые бонусы ───────────── */

export interface AchDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bonus: string;
  fx: Partial<Mods>;
  check: (g: Game) => boolean;
  progress: (g: Game) => [number, number];
}

const cap = (a: number, b: number): [number, number] => [Math.min(a, b), b];

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'iron_fist', name: 'Железный кулак', icon: '✊', desc: 'Подавить 5 бунтов на угодьях', bonus: 'Атака +5% · лояльность +4', fx: { atk: 1.05, loyalty: 4 }, check: (g) => g.ext.cnt.riots >= 5, progress: (g) => cap(g.ext.cnt.riots, 5) },
  { id: 'merchant', name: 'Купец от бога', icon: '🤝', desc: 'Присоединить 5 селений мирно', bonus: 'Золото +10% · присоединение −10%', fx: { gold: 1.1, annex: 0.9 }, check: (g) => g.ext.cnt.peace >= 5, progress: (g) => cap(g.ext.cnt.peace, 5) },
  { id: 'dynasty', name: 'Великая династия', icon: '👑', desc: 'Дожить до 4-го поколения рода', bonus: 'Рождаемость выше · лояльность +5', fx: { birth: 0.92, loyalty: 5 }, check: (g) => maxGeneration(g) >= 4, progress: (g) => cap(maxGeneration(g), 4) },
  { id: 'first_blood', name: 'Первая кровь', icon: '⚔️', desc: 'Выиграть первое сражение', bonus: 'Атака +3%', fx: { atk: 1.03 }, check: (g) => g.ext.cnt.battlesWon >= 1, progress: (g) => cap(g.ext.cnt.battlesWon, 1) },
  { id: 'conqueror', name: 'Завоеватель', icon: '🏴', desc: 'Захватить 3 селения силой', bonus: 'Атака +5% · воины дешевле на 5%', fx: { atk: 1.05, armyCost: 0.95 }, check: (g) => g.ext.cnt.conquered >= 3, progress: (g) => cap(g.ext.cnt.conquered, 3) },
  { id: 'caravaneer', name: 'Хозяин дорог', icon: '🐎', desc: 'Доставить 12 караванов в столицу', bonus: 'Золото +5% · скорость +3%', fx: { gold: 1.05, speed: 1.03 }, check: (g) => g.ext.cnt.caravansDone >= 12, progress: (g) => cap(g.ext.cnt.caravansDone, 12) },
  { id: 'bandit_bane', name: 'Гроза разбойников', icon: '🗡️', desc: 'Перебить 10 разбойников и врагов у караванов', bonus: 'Оборона +5%', fx: { def: 1.05 }, check: (g) => g.ext.cnt.banditsKilled >= 10, progress: (g) => cap(g.ext.cnt.banditsKilled, 10) },
  { id: 'relic', name: 'Хранитель древностей', icon: '🗿', desc: 'Захватить флагом первое чудо', bonus: 'Знания +5%', fx: { know: 1.05 }, check: (g) => wonderCount(g) >= 1, progress: (g) => cap(wonderCount(g), 1) },
  { id: 'wonders', name: 'Владыка чудес', icon: '✦', desc: 'Владеть тремя чудесами одновременно', bonus: 'Золото +8% · знания +8%', fx: { gold: 1.08, know: 1.08 }, check: (g) => wonderCount(g) >= 3, progress: (g) => cap(wonderCount(g), 3) },
  { id: 'ice_march', name: 'Ледяной поход', icon: '🧊', desc: 'Захватить селение, дойдя до него по льду', bonus: 'Скорость походов +10%', fx: { march: 1.1 }, check: (g) => g.ext.cnt.iceConq >= 1, progress: (g) => cap(g.ext.cnt.iceConq, 1) },
  { id: 'winter_ok', name: 'Пережили зиму', icon: '❄️', desc: 'Встретить весну, ни разу не голодая зимой', bonus: 'Еда нужна на 4% меньше', fx: { hunger: 0.96 }, check: (g) => g.time > 36 * 180 && g.ext.winterHungerOk && g.ext.season === 0, progress: (g) => cap(Math.floor(g.time / 180), 36) },
  { id: 'hangman', name: 'Рука закона', icon: '⚖️', desc: 'Казнить наместника-вора', bonus: 'Лояльность +3', fx: { loyalty: 3 }, check: (g) => g.ext.cnt.executed >= 1, progress: (g) => cap(g.ext.cnt.executed, 1) },
  { id: 'scholar', name: 'Мудрец', icon: '📚', desc: 'Изучить 25 технологий', bonus: 'Знания +5%', fx: { know: 1.05 }, check: (g) => g.done.size >= 25, progress: (g) => cap(g.done.size, 25) },
  { id: 'builder', name: 'Зодчий', icon: '🏗️', desc: 'Построить 20 зданий', bonus: 'Стройка +6%', fx: { build: 1.06 }, check: (g) => g.stats.built >= 20 || g.buildings.filter((b) => b.done).length >= 20, progress: (g) => cap(Math.max(g.stats.built, g.buildings.filter((b) => b.done).length), 20) },
  { id: 'crowd', name: 'Многолюдье', icon: '👥', desc: 'Довести население до 60 человек', bonus: 'Жилья +5%', fx: { housing: 1.05 }, check: (g) => g.totalPop() >= 60, progress: (g) => cap(g.totalPop(), 60) },
  { id: 'rich', name: 'Золотая казна', icon: '💰', desc: 'Накопить 1500 золота', bonus: 'Золото +5%', fx: { gold: 1.05 }, check: (g) => g.res.gold >= 1500, progress: (g) => cap(Math.floor(g.res.gold), 1500) },
  { id: 'shadow', name: 'Тень державы', icon: '🌑', desc: 'Дожить до появления сильной ИИ-державы', bonus: 'Оборона +4%', fx: { def: 1.04 }, check: (g) => strongStates(g) >= 1, progress: (g) => cap(strongStates(g), 1) },
  { id: 'unifier', name: 'Собиратель земель', icon: '🗺️', desc: 'Объединить 4 провинции', bonus: 'Лояльность +4 · золото +4%', fx: { loyalty: 4, gold: 1.04 }, check: (g) => g.towns.filter((t) => t.owner === 'player').length >= 4, progress: (g) => cap(g.towns.filter((t) => t.owner === 'player').length, 4) },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchDef>;

/* ───────────── Глобальная «зала славы» (между партиями) ───────────── */

const GKEY = 'zarya_ach_global';
export function loadGlobalAch(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(GKEY) || '{}');
  } catch {
    return {};
  }
}
function saveGlobalAch(id: string) {
  try {
    const m = loadGlobalAch();
    m[id] = (m[id] ?? 0) + 1;
    localStorage.setItem(GKEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function applyAchMods(g: Game, m: Mods) {
  for (const id of Object.keys(g.ext.ach)) {
    const d = ACH_BY_ID[id];
    if (!d) continue;
    for (const k of Object.keys(d.fx) as (keyof Mods)[]) {
      if (k === 'loyalty' || k === 'carry') m[k] += d.fx[k]!;
      else m[k] *= d.fx[k]!;
    }
  }
}

export function unlockAch(g: Game, id: string) {
  const X = g.ext;
  const d = ACH_BY_ID[id];
  if (!d || X.ach[id] != null) return;
  X.ach[id] = dayNo(g);
  saveGlobalAch(id);
  g.msg(`🏆 Достижение: «${d.name}» — ${d.bonus}`, 'good');
  g.sfx('fanfare');
  chron(g, `Достижение «${d.name}»: ${d.desc.toLowerCase()}`, 'good');
  g.refreshMods();
}

export function updateAchievements(g: Game, dt: number) {
  const X = g.ext;
  X.achT -= dt;
  if (X.achT > 0) return;
  X.achT = 2;
  for (const d of ACHIEVEMENTS) if (X.ach[d.id] == null && d.check(g)) unlockAch(g, d.id);
}

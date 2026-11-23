import type { Game, Unit } from './game';
import { hash2 } from './rng';
import type { Look } from './sprites';

const ELDER_AGE = 1800; // 10 игровых суток

/** Визуальный облик жителя: рост, седина, фартук, шрамы и наряд — по возрасту, ремеслу и службе. */
export function visualLook(g: Game, u: Unit): Look {
  const base = u.look;
  if (u.child) return base;
  const h = hash2(u.id, 7, 3);
  const person = g.life.people.get(u.id);
  const aged = !!base.elder || (!!person && g.time - person.born > ELDER_AGE);
  const build = base.build ?? (h < 0.18 ? 1 : h < 0.4 ? 2 : 0);
  const artisan = u.task.type === 'craft' || (u.role === 'folk' && hash2(u.id, 11, 3) < 0.2) || (u.role === 'hunter' && false);
  let vet = 0;
  if (u.role === 'soldier' || u.role === 'guard' || u.role === 'bandit') {
    const r = hash2(u.id, 13, 3);
    const lim = 0.4 + Math.min(0.35, g.life.kills / 60);
    if (r < lim) vet = r < lim / 2 ? 1 : 2;
  }
  const rich = u.role === 'lord' || !!u.hero || (u.role === 'folk' && hash2(u.id, 17, 3) < 0.12);
  const m = build | (aged ? 4 : 0) | (artisan ? 8 : 0) | (vet << 4) | (rich ? 64 : 0);
  const cached = u.vl;
  if (cached && cached.m === m) return cached.look;
  const look: Look = { ...base, build, elder: aged, apron: artisan, vet, rich };
  u.vl = { m, look };
  return look;
}

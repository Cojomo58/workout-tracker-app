/**
 * Set-count / reps / load rules for opening a new week on top of last week's log.
 * Imports the real helper used by the day editor. Run: node scripts/week-prefill/pure-checks.mjs
 */

import { findTemplateExercise, setsForNewWeek } from '../../src/prefillWeek.js';

const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail });
    console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`);
  } catch (e) {
    results.push({ name, pass: false, detail: e.message });
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

const week3 = { sets: '4', reps: '8', pct: 80, label: '4×8 @ 80%' };

run('grows to the week row and uses the percentage load', () => {
  const sets = setsForNewWeek(
    [
      { weight: '185', reps: '10', completed: true },
      { weight: '185', reps: '10', completed: true },
      { weight: '175', reps: '8', completed: true },
    ],
    { prescription: week3, pctWeight: 200 },
  );
  assert(sets.length === 4, `expected 4 sets, got ${sets.length}`);
  assert(sets.every(s => s.weight === '200' && s.reps === '8' && s.weightSource === 'tm-pct'), JSON.stringify(sets));
  assert(sets.every(s => s.completed === undefined), 'completed flags from last week must not carry over');
  return '4 sets @ 200 x 8';
});

run('keeps last week weights when no percentage load resolves, and repeats the last weight on an added set', () => {
  const sets = setsForNewWeek(
    [
      { weight: '40', reps: '20' },
      { weight: '40', reps: '20' },
      { weight: '35', reps: '20' },
    ],
    { prescription: { sets: '4', reps: '15', pct: 80 }, pctWeight: null },
  );
  assert(sets.length === 4, `expected 4 sets, got ${sets.length}`);
  assert(sets.map(s => s.weight).join(',') === '40,40,35,35', JSON.stringify(sets));
  assert(sets.every(s => s.reps === '15'), JSON.stringify(sets));
  assert(sets.every(s => s.weightSource === undefined), 'no tm source without a resolved load');
  return 'weights 40,40,35,35 reps 15';
});

run('drops sets when the week row is shorter', () => {
  const sets = setsForNewWeek(
    [
      { weight: '50', reps: '10' },
      { weight: '50', reps: '10' },
      { weight: '45', reps: '10' },
      { weight: '40', reps: '8' },
    ],
    { prescription: { sets: 2, reps: 8, pct: 80 }, pctWeight: 80 },
  );
  assert(sets.length === 2, `expected 2 sets, got ${sets.length}`);
  assert(sets.every(s => s.weight === '80' && s.reps === '8'), JSON.stringify(sets));
  return '2 sets @ 80 x 8';
});

run('replaces a single odd set from last week', () => {
  const sets = setsForNewWeek(
    [
      { weight: '100', reps: '10' },
      { weight: '85', reps: '10' },
      { weight: '75', reps: '8' },
    ],
    { prescription: week3, pctWeight: 120 },
  );
  assert(sets.length === 4, `expected 4 sets, got ${sets.length}`);
  assert(sets.every(s => s.weight === '120' && s.reps === '8'), JSON.stringify(sets));
  return '85 on set 2 replaced by 120';
});

run('reps come from the week row even when the set count does not change', () => {
  const sets = setsForNewWeek(
    [
      { weight: '30', reps: '12' },
      { weight: '30', reps: '8' },
      { weight: '25', reps: '12' },
    ],
    { prescription: { sets: '3', reps: '10', pct: 70 }, pctWeight: 70 },
  );
  assert(sets.length === 3, `expected 3 sets, got ${sets.length}`);
  assert(sets.every(s => s.reps === '10' && s.weight === '70'), JSON.stringify(sets));
  return 'set 2 reps 8 became 10';
});

run('an exercise with no template row keeps last week sets unchanged', () => {
  const sets = setsForNewWeek(
    [
      { weight: '15', reps: '12' },
      { weight: '15', reps: '8' },
    ],
    { prescription: null, pctWeight: null },
  );
  assert(sets.length === 2, `expected 2 sets, got ${sets.length}`);
  assert(sets[0].reps === '12' && sets[1].reps === '8', JSON.stringify(sets));
  assert(sets[0].weight === '15' && sets[1].weight === '15', JSON.stringify(sets));
  return 'copied 12 and 8';
});

run('template name match is case-insensitive and prefers the exact name', () => {
  const list = [
    { name: 'bench press', sets: 1 },
    { name: 'Bench Press', sets: 4 },
  ];
  assert(findTemplateExercise(list, 'Bench Press')?.sets === 4, 'exact name should win');
  assert(findTemplateExercise(list, 'BENCH PRESS')?.name === 'bench press', 'case fallback should hit the first equal spelling');
  assert(findTemplateExercise(list, 'Squat') === undefined, 'missing name');
  return 'exact then case-insensitive';
});

run('bodyweight set count and reps follow the week row', () => {
  const sets = setsForNewWeek(
    [
      { reps: '10', holdTime: '20' },
      { reps: '10', holdTime: '30' },
    ],
    { type: 'bodyweight', prescription: { sets: '3', reps: '15' }, pctWeight: null },
  );
  assert(sets.length === 3, `expected 3 sets, got ${sets.length}`);
  assert(sets.every(s => s.reps === '15'), JSON.stringify(sets));
  assert(sets[0].holdTime === '20' && sets[2].holdTime === '30', JSON.stringify(sets));
  return '3 bodyweight sets @ 15, hold carried';
});

const failed = results.filter(r => !r.pass);
console.log(`\nWeek prefill pure checks: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);

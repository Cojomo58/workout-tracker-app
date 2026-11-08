/**
 * Pure-function checks mirrored from src/App.jsx (foldTrainingMax, prescriptionForWeek).
 * Run: node scripts/later-plan-six/pure-checks.mjs
 */

const roundToNearest2_5 = (w) => Math.round(w / 2.5) * 2.5;
const deriveTrainingMax = (true1RM, pct) =>
  roundToNearest2_5(parseFloat(true1RM) * parseFloat(pct) / 100);

const foldTrainingMax = (prevMap, exerciseName, true1RM, pct, today, opts = {}) => {
  const { recordHistory = true, historySource = 'manual' } = opts;
  const existing = prevMap[exerciseName];
  const prevHistory = existing?.history || [];
  const newHistory = existing && recordHistory
    ? [...prevHistory, {
        true1RM: existing.true1RM,
        trainingMax: existing.trainingMax,
        date: existing.lastUpdated || today,
        source: historySource
      }]
    : prevHistory;
  return {
    ...prevMap,
    [exerciseName]: {
      true1RM: parseFloat(true1RM),
      trainingMaxPercent: parseFloat(pct),
      trainingMax: deriveTrainingMax(true1RM, pct),
      lastUpdated: today,
      history: newHistory
    }
  };
};

const prescriptionForWeek = (ex, week) => {
  if (!ex) return { sets: null, reps: null, pct: null, label: null };
  const weekOverride = (ex.weeklyProgression || []).find(w => w.week === week) ?? null;
  const sets = weekOverride?.sets ?? ex.sets;
  const reps = weekOverride?.reps ?? ex.reps;
  const pct = weekOverride?.percentage ?? ex.percentage;
  let label = null;
  if (sets && reps) label = `${sets}×${reps}`;
  if (pct) label = label ? `${label} @ ${pct}%` : `${pct}% TM`;
  return { sets, reps, pct, label };
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = [];

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

const today = '2026-11-08';

run('outcome-3 manual TM history source', () => {
  let map = { 'Bench Press': { true1RM: 200, trainingMax: 180, trainingMaxPercent: 90, lastUpdated: '2026-01-01', history: [] } };
  map = foldTrainingMax(map, 'Bench Press', 220, 90, today, { historySource: 'manual' });
  assert(map['Bench Press'].history.length === 1, 'expected 1 history row');
  assert(map['Bench Press'].history[0].source === 'manual', 'expected manual source');
  assert(map['Bench Press'].history[0].trainingMax === 180, 'history should store prior TM');
  return `history[0].source=manual, prior TM 180`;
});

run('outcome-3 cycle rollover skips TM history', () => {
  let map = { 'Bench Press': { true1RM: 200, trainingMax: 180, trainingMaxPercent: 90, lastUpdated: '2026-01-01', history: [{ source: 'manual', trainingMax: 170, date: '2025-06-01' }] } };
  map = foldTrainingMax(map, 'Bench Press', 230, 90, today, { recordHistory: false });
  assert(map['Bench Press'].history.length === 1, 'history length unchanged');
  assert(map['Bench Press'].trainingMax === deriveTrainingMax(230, 90), 'TM updated');
  return `history length still 1, TM=${map['Bench Press'].trainingMax}`;
});

run('outcome-3 auto-raise tags auto history', () => {
  let map = { Squat: { true1RM: 300, trainingMax: 270, trainingMaxPercent: 90, lastUpdated: today, history: [], auto: true } };
  map = foldTrainingMax(map, 'Squat', 320, 90, today, { historySource: 'auto' });
  assert(map.Squat.history[0].source === 'auto', 'auto source');
  return 'auto history source';
});

run('outcome-4 rounded load preview math', () => {
  const tm = 230;
  const pct = 65;
  const w = roundToNearest2_5(tm * pct / 100);
  assert(w === 150, `expected 150 got ${w}`);
  return `230 @ 65% => ${w} lb`;
});

run('outcome-6 prescriptionForWeek week override', () => {
  const ex = {
    sets: 3,
    reps: '5',
    percentage: 65,
    weeklyProgression: [{ week: 3, sets: 5, reps: '3', percentage: 75 }],
  };
  const w1 = prescriptionForWeek(ex, 1);
  const w3 = prescriptionForWeek(ex, 3);
  assert(w1.label === '3×5 @ 65%', `week1 label ${w1.label}`);
  assert(w3.label === '5×3 @ 75%', `week3 label ${w3.label}`);
  return `w1=${w1.label}, w3=${w3.label}`;
});

// Simulate merge metadata + drafts rewrite (same logic as mergeExercises in App.jsx)
run('outcome-6 merge preserves plans drafts snapshots', () => {
  const sources = new Set(['db bench']);
  const toName = 'Dumbbell Bench Press';
  const blockMetadata = {
    1: {
      plans: { 'week2-friday': { exercises: [{ name: 'db bench', sets: [] }], savedAt: 1 } },
      trainingMaxSnapshot: { 'db bench': { trainingMax: 135, true1RM: 150, trainingMaxPercent: 90 } },
    },
  };
  const drafts = { 'block1-week1-monday': { exercises: [{ name: 'db bench', notes: 'draft ok' }] } };
  const logs = { k: { exercises: [{ name: 'db bench' }, { name: 'Squat' }] } };

  const newLogs = {};
  Object.entries(logs).forEach(([key, log]) => {
    newLogs[key] = {
      ...log,
      exercises: (log.exercises || []).map(ex => (sources.has(ex.name) ? { ...ex, name: toName } : ex)),
    };
  });
  assert(newLogs.k.exercises[0].name === toName, 'log relabel');

  const updated = { ...blockMetadata };
  Object.entries(updated).forEach(([blockKey, meta]) => {
    let nextMeta = meta;
    const plans = meta.plans;
    if (plans) {
      const newPlans = {};
      Object.entries(plans).forEach(([pk, plan]) => {
        newPlans[pk] = {
          ...plan,
          exercises: (plan.exercises || []).map(ex => (sources.has(ex.name) ? { ...ex, name: toName } : ex)),
        };
      });
      nextMeta = { ...nextMeta, plans: newPlans };
    }
    const snap = meta.trainingMaxSnapshot;
    if (snap) {
      const newSnap = { ...snap };
      sources.forEach(src => {
        if (newSnap[src]) {
          newSnap[toName] = { ...newSnap[src], ...(newSnap[toName] || {}) };
          delete newSnap[src];
        }
      });
      nextMeta = { ...nextMeta, trainingMaxSnapshot: newSnap };
    }
    updated[blockKey] = nextMeta;
  });
  assert(updated[1].plans['week2-friday'].exercises[0].name === toName, 'plan relabel');
  assert(updated[1].trainingMaxSnapshot[toName], 'snapshot key moved');
  assert(!updated[1].trainingMaxSnapshot['db bench'], 'old snapshot key removed');

  Object.values(drafts).forEach(draft => {
    (draft.exercises || []).forEach(ex => {
      if (sources.has(ex.name)) ex.name = toName;
    });
  });
  assert(drafts['block1-week1-monday'].exercises[0].name === toName, 'draft relabel');
  assert(drafts['block1-week1-monday'].exercises[0].notes === 'draft ok', 'draft notes kept');

  return 'logs/plans/drafts/snapshot keys rewritten; draft notes preserved';
});

const failed = results.filter(r => !r.pass).length;
console.log(`\nPure checks: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

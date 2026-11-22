/**
 * Opens the day editor the way the calendar does and checks week-3 prefill.
 * Requires a dev server with VITE_TEST_HOOKS=1. VERIFY_BASE_URL sets the origin.
 */

import { chromium } from 'playwright';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:5207/workout-tracker-app/';

function tm(trainingMax) {
  return {
    true1RM: trainingMax,
    trainingMax,
    trainingMaxPercent: 90,
    lastUpdated: '2026-11-01',
    history: [],
  };
}

function row(sets, reps, percentage) {
  return { week: 3, sets, reps, percentage };
}

function ex(name, sets, reps, percentage, weekSets, weekReps, weekPct) {
  return {
    name,
    sets,
    reps,
    percentage,
    weeklyProgression: [row(weekSets, weekReps, weekPct)],
  };
}

const MONDAY_TEMPLATE = [
  ex('Bench Press', '3', '10', 70, '4', '8', 80),
  ex('Neutral Grip Pull Up', '3', '10', 70, '4', '8', 80),
  ex('Leg Curl', '3', '10', 70, '4', '8', 80),
  ex('Hammer Curl', '3', '12', 65, '3', '10', 70),
  ex('Back Extension', '3', '12', 60, '4', '15', 80),
];

const savedThursday = {
  date: '2026-11-20',
  exercises: [
    {
      name: 'Incline DB',
      type: 'strength',
      notes: 'saved-log-do-not-touch',
      sets: [
        { weight: '77', reps: '5', completed: true },
        { weight: '77', reps: '5', completed: true },
        { weight: '77', reps: '5', completed: true },
      ],
    },
  ],
  prsHit: 0,
  durationSeconds: 1800,
};

const savedPlan = {
  savedAt: 1764000000000,
  exercises: [
    {
      name: 'Bench Press',
      type: 'strength',
      notes: 'hand-fixed-plan',
      sets: [
        { weight: '111', reps: '8' },
        { weight: '111', reps: '8' },
        { weight: '111', reps: '8' },
        { weight: '111', reps: '8' },
      ],
    },
  ],
};

function storageNewWeek() {
  const template = {
    monday: { name: 'Upper', exercises: MONDAY_TEMPLATE },
    tuesday: { name: '', exercises: [] },
    wednesday: { name: 'Mid', exercises: [ex('Bench Press', '3', '10', 70, '3', '10', 70)] },
    thursday: { name: 'Incline', exercises: [ex('Incline DB', '3', '10', 70, '4', '8', 80)] },
    friday: { name: 'Pull', exercises: [ex('Dumbbell Row', '3', '10', 70, '2', '8', 80)] },
    saturday: { name: '', exercises: [] },
    sunday: { name: '', exercises: [] },
  };
  const week2 = (day, exercises) => ({
    date: '2026-11-13',
    exercises,
    prsHit: 0,
  });
  return {
    'onboarding-complete': 'true',
    'current-block': '10',
    'current-week': JSON.stringify({ block: 10, week: 3 }),
    'workout-blocks': JSON.stringify([{ id: 1, name: 'Block', weeks: 4, template }]),
    'workout-logs': JSON.stringify({
      'block10-week2-monday': week2('monday', [
        { name: 'bench press', type: 'strength', sets: [
          { weight: '185', reps: '10', completed: true },
          { weight: '185', reps: '10', completed: true },
          { weight: '175', reps: '8', completed: true },
        ] },
        { name: 'Neutral Grip Pull Up', type: 'strength', sets: [
          { weight: '35', reps: '10' },
          { weight: '35', reps: '10' },
          { weight: '30', reps: '8' },
        ] },
        { name: 'Leg Curl', type: 'strength', sets: [
          { weight: '100', reps: '10' },
          { weight: '85', reps: '10' },
          { weight: '75', reps: '8' },
        ] },
        { name: 'Hammer Curl', type: 'strength', sets: [
          { weight: '30', reps: '12' },
          { weight: '30', reps: '8' },
          { weight: '25', reps: '12' },
        ] },
        { name: 'Back Extension', type: 'strength', sets: [
          { weight: '40', reps: '20' },
          { weight: '40', reps: '20' },
          { weight: '35', reps: '20' },
        ] },
        { name: 'Custom Finisher', type: 'strength', sets: [
          { weight: '15', reps: '12' },
          { weight: '15', reps: '8' },
        ] },
      ]),
      'block10-week2-wednesday': week2('wednesday', [
        { name: 'Bench Press', type: 'strength', sets: [
          { weight: '50', reps: '10' },
          { weight: '50', reps: '10' },
          { weight: '50', reps: '10' },
        ] },
      ]),
      'block10-week2-thursday': week2('thursday', [
        { name: 'Incline DB', type: 'strength', sets: [{ weight: '70', reps: '8' }] },
      ]),
      'block10-week2-friday': week2('friday', [
        { name: 'Dumbbell Row', type: 'strength', sets: [
          { weight: '50', reps: '10' },
          { weight: '50', reps: '10' },
          { weight: '45', reps: '10' },
          { weight: '40', reps: '8' },
        ] },
      ]),
      'block10-week3-thursday': savedThursday,
    }),
    'personal-records': JSON.stringify({}),
    'block-metadata': JSON.stringify({
      10: {
        name: 'Block 10',
        startDate: '2026-11-01',
        currentWeek: 3,
        plans: { 'week3-wednesday': savedPlan },
      },
    }),
    'training-maxes': JSON.stringify({
      'Bench Press': tm(250),
      'Neutral Grip Pull Up': tm(50),
      'Leg Curl': tm(150),
      'Hammer Curl': tm(100),
      'Dumbbell Row': tm(100),
      'Incline DB': tm(80),
    }),
  };
}

function storageTemplateOnly() {
  return {
    'onboarding-complete': 'true',
    'current-block': '1',
    'current-week': JSON.stringify({ block: 1, week: 3 }),
    'workout-blocks': JSON.stringify([{
      id: 1,
      name: 'Block',
      weeks: 4,
      template: {
        monday: { name: 'Upper', exercises: [ex('Bench Press', '3', '10', 70, '4', '8', 80)] },
        tuesday: { name: '', exercises: [] },
        wednesday: { name: '', exercises: [] },
        thursday: { name: '', exercises: [] },
        friday: { name: '', exercises: [] },
        saturday: { name: '', exercises: [] },
        sunday: { name: '', exercises: [] },
      },
    }]),
    'workout-logs': JSON.stringify({}),
    'personal-records': JSON.stringify({}),
    'block-metadata': JSON.stringify({
      1: { name: 'Empty Cycle', startDate: '2026-11-01', currentWeek: 3 },
    }),
    'training-maxes': JSON.stringify({ 'Bench Press': tm(250) }),
  };
}

async function newPage(storage) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, storage);
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('PAGEERROR', err.message));
  return { browser, page };
}

async function waitForApp(page) {
  await page.goto(`${baseURL}?testhooks=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const el = document.body?.innerText || '';
    return !el.includes('Syncing your workouts') && !el.includes('Checking sign-in');
  }, { timeout: 15000 });
  await page.waitForFunction(() => window.__wtTestHooks?.getExercises, { timeout: 10000 });
  await page.getByRole('heading', { name: 'Week 3' }).waitFor({ timeout: 10000 });
}

async function openDay(page, day) {
  await page.getByRole('heading', { name: day }).click();
  await page.getByText(`Week 3 - ${day}`).waitFor({ timeout: 8000 });
}

async function closeLog(page) {
  await page.locator('button[title^="Close"]').click();
  const week = page.getByRole('heading', { name: 'Week 3' });
  const leave = page.getByRole('button', { name: 'Leave (keep draft)' });
  await Promise.race([
    week.waitFor({ timeout: 8000 }).catch(() => {}),
    leave.waitFor({ timeout: 8000 }).catch(() => {}),
  ]);
  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
  }
  await week.waitFor({ timeout: 8000 });
}

async function readExercises(page) {
  return page.evaluate(() => {
    const list = window.__wtTestHooks.getExercises() || [];
    return list.map(ex => ({
      name: ex.name,
      notes: ex.notes || '',
      target: ex.templateTarget || null,
      sets: (ex.sets || []).map(s => ({
        weight: s.weight ?? '',
        reps: s.reps ?? '',
        source: s.weightSource || null,
        completed: !!s.completed,
      })),
    }));
  });
}

function sameSets(actual, expected, label) {
  const errors = [];
  if (actual.length !== expected.length) {
    errors.push(`${label}: expected ${expected.length} exercises, got ${actual.length} (${JSON.stringify(actual)})`);
    return errors;
  }
  expected.forEach((exp, i) => {
    const got = actual[i];
    if (got.name !== exp.name) errors.push(`${label}[${i}] name ${got.name} !== ${exp.name}`);
    if (exp.notes !== undefined && got.notes !== exp.notes) errors.push(`${label}[${i}] notes ${JSON.stringify(got.notes)}`);
    if (exp.target !== undefined && got.target !== exp.target) errors.push(`${label}[${i}] target ${got.target} !== ${exp.target}`);
    if (got.sets.length !== exp.sets.length) {
      errors.push(`${label}[${i}] ${got.name} set count ${got.sets.length} !== ${exp.sets.length} (${JSON.stringify(got.sets)})`);
      return;
    }
    exp.sets.forEach((set, s) => {
      const g = got.sets[s];
      if (String(g.weight) !== String(set.weight) || String(g.reps) !== String(set.reps)) {
        errors.push(`${label}[${i}] ${got.name} set ${s + 1} ${g.weight}x${g.reps} !== ${set.weight}x${set.reps}`);
      }
      if (set.source !== undefined && g.source !== set.source) {
        errors.push(`${label}[${i}] ${got.name} set ${s + 1} source ${g.source} !== ${set.source}`);
      }
    });
  });
  return errors;
}

const w = (weight, reps, source) => ({ weight, reps, ...(source !== undefined ? { source } : {}) });
const four = (weight, reps, source) => [w(weight, reps, source), w(weight, reps, source), w(weight, reps, source), w(weight, reps, source)];

export async function runE2E() {
  const results = [];
  const record = (name, errors, observed) => {
    const pass = errors.length === 0;
    results.push({ name, pass, observed: pass ? observed : errors.join('; ') });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? `: ${observed}` : `: ${errors.join('; ')}`}`);
  };

  const opened = await newPage(storageNewWeek());
  try {
    await waitForApp(opened.page);
    const page = opened.page;
    const before = await page.evaluate(() => {
      const logs = window.__wtTestHooks.getWorkoutLogs();
      const meta = window.__wtTestHooks.getBlockMetadata();
      return {
        logKeys: Object.keys(logs).sort(),
        thursday: JSON.stringify(logs['block10-week3-thursday']),
        plan: JSON.stringify(meta[10]?.plans?.['week3-wednesday']),
      };
    });

    const mondayCard = await page.getByRole('heading', { name: 'Monday' }).locator('xpath=../..').innerText();
    const fridayCard = await page.getByRole('heading', { name: 'Friday' }).locator('xpath=../..').innerText();
    const thursdayCard = await page.getByRole('heading', { name: 'Thursday' }).locator('xpath=../..').innerText();
    const calendarErrors = [];
    for (const label of ['Bench Press · 4×8 @ 80%', 'Neutral Grip Pull Up · 4×8 @ 80%', 'Leg Curl · 4×8 @ 80%', 'Hammer Curl · 3×10 @ 70%', 'Back Extension · 4×15 @ 80%']) {
      if (!mondayCard.includes(label)) calendarErrors.push(`monday card missing ${label}: ${mondayCard.replace(/\n/g, ' | ')}`);
    }
    if (!fridayCard.includes('Dumbbell Row · 2×8 @ 80%')) calendarErrors.push(`friday card: ${fridayCard.replace(/\n/g, ' | ')}`);
    if (!thursdayCard.includes('Incline DB · 4×8 @ 80%')) calendarErrors.push(`thursday card: ${thursdayCard.replace(/\n/g, ' | ')}`);
    record('calendar still shows the week-3 row', calendarErrors, 'monday/friday/thursday cards use weeklyProgression');

    await openDay(page, 'Monday');
    await page.getByText('Pre-filled from Week 2 Monday').waitFor({ timeout: 8000 });
    const prefill = await readExercises(page);
    const prefillErrors = sameSets(prefill, [
      {
        name: 'bench press',
        target: '4×8 @ 80%',
        sets: four('200', '8', 'tm-pct'),
      },
      {
        name: 'Neutral Grip Pull Up',
        target: '4×8 @ 80%',
        sets: four('40', '8', 'tm-pct'),
      },
      {
        name: 'Leg Curl',
        target: '4×8 @ 80%',
        sets: four('120', '8', 'tm-pct'),
      },
      {
        name: 'Hammer Curl',
        target: '3×10 @ 70%',
        sets: [w('70', '10', 'tm-pct'), w('70', '10', 'tm-pct'), w('70', '10', 'tm-pct')],
      },
      {
        name: 'Back Extension',
        target: '4×15 @ 80%',
        sets: [w('40', '15', null), w('40', '15', null), w('35', '15', null), w('35', '15', null)],
      },
      {
        name: 'Custom Finisher',
        sets: [w('15', '12', null), w('15', '8', null)],
      },
    ], 'monday prefill');
    if (prefill.some(ex => ex.sets.some(s => s.completed))) prefillErrors.push('completed flags carried over from last week');
    record('new week editor uses the week row for count, reps, and load', prefillErrors, 'bench 4x200x8, pull up 40 not 35, leg curl 120 not 85, hammer reps 10, back extension kept weights');

    const visibleWeights = await page.getByLabel(/^Set \d+ weight$/).evaluateAll(els => els.map(e => e.value));
    const visibleReps = await page.getByLabel(/^Set \d+ reps$/).evaluateAll(els => els.map(e => e.value));
    const domErrors = [];
    if (visibleWeights.join(',') !== '200,200,200,200') domErrors.push(`visible weights ${visibleWeights.join(',')}`);
    if (visibleReps.join(',') !== '8,8,8,8') domErrors.push(`visible reps ${visibleReps.join(',')}`);
    record('expanded bench row shows four sets at the percentage load', domErrors, `weights ${visibleWeights.join(',')} reps ${visibleReps.join(',')}`);

    await page.getByRole('button', { name: 'Use Template' }).click();
    await page.getByText('Pre-filled from Week 2 Monday').waitFor({ state: 'hidden', timeout: 8000 });
    const fromTemplate = await readExercises(page);
    record('Use Template also follows the open week row', sameSets(fromTemplate, [
      { name: 'Bench Press', sets: four('200', '8', 'tm-pct') },
      { name: 'Neutral Grip Pull Up', sets: four('40', '8', 'tm-pct') },
      { name: 'Leg Curl', sets: four('120', '8', 'tm-pct') },
      { name: 'Hammer Curl', sets: [w('70', '10', 'tm-pct'), w('70', '10', 'tm-pct'), w('70', '10', 'tm-pct')] },
      { name: 'Back Extension', sets: [w('', '15', 'manual'), w('', '15', 'manual'), w('', '15', 'manual'), w('', '15', 'manual')] },
    ], 'use template'), 'template order, week-3 counts, no last-week finisher');

    await closeLog(page);
    await openDay(page, 'Wednesday');
    await page.getByText('Loaded your plan').waitFor({ timeout: 8000 });
    const planned = await readExercises(page);
    record('saved plan loads as stored', sameSets(planned, [
      { name: 'Bench Press', notes: 'hand-fixed-plan', sets: four('111', '8') },
    ], 'wednesday plan'), '4 sets at 111, not the week-2 log and not a rebuilt template');

    await closeLog(page);
    await openDay(page, 'Friday');
    await page.getByText('Pre-filled from Week 2 Friday').waitFor({ timeout: 8000 });
    const shrunk = await readExercises(page);
    record('extra last-week sets are removed to match the week row', sameSets(shrunk, [
      { name: 'Dumbbell Row', target: '2×8 @ 80%', sets: [w('80', '8', 'tm-pct'), w('80', '8', 'tm-pct')] },
    ], 'friday shrink'), '4 last-week sets became 2 at 80');

    await closeLog(page);
    await openDay(page, 'Thursday');
    const saved = await readExercises(page);
    const savedErrors = sameSets(saved, [
      { name: 'Incline DB', notes: 'saved-log-do-not-touch', sets: [w('77', '5'), w('77', '5'), w('77', '5')] },
    ], 'thursday log');
    const banner = await page.getByText('Pre-filled from Week').count();
    if (banner) savedErrors.push('saved log showed the last-week prefill banner');
    record('saved log opens unchanged', savedErrors, '3 stored sets at 77, template still says 4');

    await closeLog(page);
    const after = await page.evaluate(() => {
      const logs = window.__wtTestHooks.getWorkoutLogs();
      const meta = window.__wtTestHooks.getBlockMetadata();
      return {
        logKeys: Object.keys(logs).sort(),
        thursday: JSON.stringify(logs['block10-week3-thursday']),
        plan: JSON.stringify(meta[10]?.plans?.['week3-wednesday']),
      };
    });
    const untouched = [];
    if (after.thursday !== before.thursday) untouched.push('week 3 thursday log changed');
    if (after.plan !== before.plan) untouched.push(`plan changed: ${after.plan}`);
    if (after.logKeys.join() !== before.logKeys.join()) untouched.push(`log keys ${after.logKeys.join()} !== ${before.logKeys.join()}`);
    record('opening the editor did not rewrite plans or logs', untouched, 'thursday log and wednesday plan JSON unchanged');
  } finally {
    await opened.browser.close();
  }

  const fresh = await newPage(storageTemplateOnly());
  try {
    await waitForApp(fresh.page);
    const card = await fresh.page.getByRole('heading', { name: 'Monday' }).locator('xpath=../..').innerText();
    await openDay(fresh.page, 'Monday');
    const prefillBanner = await fresh.page.getByText('Pre-filled from Week').count();
    const exercises = await readExercises(fresh.page);
    const errors = sameSets(exercises, [
      { name: 'Bench Press', sets: four('200', '8', 'tm-pct') },
    ], 'no last week');
    if (!card.includes('Bench Press · 4×8 @ 80%')) errors.push(`card: ${card.replace(/\n/g, ' | ')}`);
    if (prefillBanner) errors.push('template-only day was marked as last-week prefill');
    record('a week with no previous log still builds sets from the week row', errors, '4 sets @ 200 x 8 from the template path');
  } finally {
    await fresh.browser.close();
  }

  return results;
}

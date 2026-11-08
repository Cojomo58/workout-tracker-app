/**
 * Playwright checks with synthetic localStorage + VITE_TEST_HOOKS dev server.
 * Run via scripts/later-plan-six/run.mjs
 */

import { chromium } from 'playwright';
import {
  storageCopyLastFixture,
  storageWithSavedMonday,
  storageCalendarWeek3Fixture,
  storageMergeFixture,
  storageOfflineFallbackFixture,
  storageTemplateTmFlagFixture,
  storageRolloverModalFixture,
  storagePlanNoTimerFixture,
  storageDraftHistoryNoTimerFixture,
  BASE_BLOCK,
} from './fixtures.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = process.env.LATER_PLAN_MEDIA_DIR || '/cursor/stores/bc-5c6ccc36-c826-408e-9306-5c8e8d80a378/media/later-plan-six';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:5199/workout-tracker-app/';

const results = [];

function record(id, pass, run, observed) {
  results.push({ id, pass, run, observed });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${observed}`);
}

async function newPageWithStorage(storage) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) {
      localStorage.setItem(k, v);
    }
  }, storage);
  const page = await context.newPage();
  return { browser, context, page };
}

async function waitForAppReady(page) {
  await page.goto(`${baseURL}?testhooks=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const el = document.body?.innerText || '';
    return !el.includes('Syncing your workouts') && !el.includes('Checking sign-in');
  }, { timeout: 15000 });
  await page.waitForFunction(() => window.__wtTestHooks, { timeout: 10000 });
}

async function checkOutcome1() {
  const { browser, page } = await newPageWithStorage(storageCopyLastFixture());
  try {
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'Calendar' }).click();
    await page.getByText('Wednesday', { exact: false }).click();
    await page.waitForTimeout(500);
    const copyBtn = page.getByRole('button', { name: 'Copy Last' });
    await copyBtn.click();
  const notesAfterCopy = await page.evaluate(() => {
      const areas = Array.from(document.querySelectorAll('textarea'));
      return areas.map(t => t.value).find(v => v.includes('prior-session-note')) || null;
    });
    record(
      '1-copy-last-notes',
      notesAfterCopy === 'prior-session-note',
      'Opened week-2 Wednesday with week-1 Bench history; clicked Copy Last',
      notesAfterCopy === 'prior-session-note'
        ? `textarea notes="${notesAfterCopy}"`
        : `expected prior-session-note, got ${JSON.stringify(notesAfterCopy)}`,
    );

    await page.locator('input').filter({ hasText: '' }).first();
    const nameInput = page.locator('input.font-semibold').first();
    await nameInput.fill('Incline Bench Press');
    const notesAfterRename = await page.evaluate(() => {
      const areas = Array.from(document.querySelectorAll('textarea'));
      return areas.map(t => t.value).join('|');
    });
    record(
      '1-rename-clears-notes',
      !notesAfterRename.includes('prior-session-note'),
      'Renamed exercise to Incline Bench Press (different name)',
      notesAfterRename.includes('prior-session-note')
        ? 'notes still contain prior-session-note (BLEED)'
        : `notes cleared (textarea values: "${notesAfterRename}")`,
    );
  } finally {
    await browser.close();
  }
}

async function sessionTimerSnapshot(page) {
  return page.evaluate(() => {
    const hook = window.__wtTestHooks?.getSessionTimer?.();
    const raw = localStorage.getItem('workout-session-timer');
    return { react: hook, local: raw ? JSON.parse(raw) : null };
  });
}

function timerStartedForKey(timer, logKey) {
  if (!timer.react) return false;
  if (timer.react.logKey !== logKey) return false;
  return !!timer.react.running;
}

async function checkRolloverModalPreview() {
  const { browser, page } = await newPageWithStorage(storageRolloverModalFixture());
  try {
    await waitForAppReady(page);
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'New Cycle' }).click();
    await page.waitForSelector('text=Roll Training Maxes Forward', { timeout: 8000 });
    const modalText = await page.locator('text=Roll Training Maxes Forward').locator('..').locator('..').innerText();
    const weekLine = modalText.match(/Wk\s*3\s*75%\s*→\s*([\d.]+)\s*lb/i);
    const pass = !!weekLine;
    record(
      '4-rollover-modal-week-preview',
      pass,
      'Synthetic trained Squat + TM; clicked New Cycle; read modal DOM',
      pass
        ? `visible line "Wk 3 75% → ${weekLine[1]} lb" in modal`
        : `no Wk 3 75% preview in modal text: ${modalText.slice(0, 400)}`,
    );
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    await page.screenshot({ path: path.join(MEDIA_DIR, 'outcome-4-rollover-modal.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

async function checkPlanNoTimer() {
  const { browser, page } = await newPageWithStorage(storagePlanNoTimerFixture());
  try {
    await waitForAppReady(page);
    const before = await sessionTimerSnapshot(page);
    await page.evaluate(() => {
      window.__wtTestHooks.loadDayIntoLogView('friday', { week: 2, skipDraft: true });
    });
    await page.waitForTimeout(800);
    const after = await sessionTimerSnapshot(page);
    const planned = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes('Loaded your plan') || t.includes('planned-not-trained');
    });
    const bad = timerStartedForKey(after, 'block1-week2-friday');
    record(
      '2-plan-day-no-timer',
      planned && !bad,
      'testhooks loadDayIntoLogView(friday, week 2) with blockMetadata plan week2-friday',
      `plan banner/content=${planned}; timer block1-week2-friday running=${bad}; before=${JSON.stringify(before.react)}, after=${JSON.stringify(after.react)}`,
    );
  } finally {
    await browser.close();
  }
}

async function checkDraftHistoryNoTimer() {
  const { browser, page } = await newPageWithStorage(storageDraftHistoryNoTimerFixture());
  try {
    await waitForAppReady(page);
    await page.getByText('Monday', { exact: false }).first().click();
    await page.waitForTimeout(800);
    const restored = await page.evaluate(() => document.body.innerText.includes('Restored unsaved draft'));
    const after = await sessionTimerSnapshot(page);
    const bad = timerStartedForKey(after, 'block1-week1-monday');
    record(
      '2-draft-history-review-no-timer',
      restored && !bad,
      'Saved log exists but newer draft without completed sets; open Monday (draft restore path)',
      `draft banner=${restored}; timer running for block1-week1-monday=${bad}; react=${JSON.stringify(after.react)}`,
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome2() {
  const { browser, page } = await newPageWithStorage(storageWithSavedMonday());
  try {
    await waitForAppReady(page);
    const cardDuration = await page.evaluate(() => document.body.innerText.includes('10:00'));
    await page.getByText('Monday', { exact: false }).first().click();
    await page.waitForTimeout(800);
    const timer = await page.evaluate(() => {
      const raw = localStorage.getItem('workout-session-timer');
      const parsed = raw ? JSON.parse(raw) : null;
      const hook = window.__wtTestHooks?.getSessionTimer?.();
      return { local: parsed, react: hook };
    });
    const bad = timer.react && timer.react.logKey === 'block1-week1-monday' && timer.react.running;
    record(
      '2-saved-log-no-running-clock',
      !bad,
      'Opened saved block1-week1-monday from calendar',
      bad
        ? `session timer running for saved log: ${JSON.stringify(timer.react)}`
        : `no running timer (react=${JSON.stringify(timer.react)})`,
    );

    const persisted = await page.evaluate(() => {
      const log = window.__wtTestHooks.getWorkoutLogs()['block1-week1-monday'];
      return log?.durationSeconds;
    });
    record(
      '2-duration-preserved-on-log',
      cardDuration && persisted === 600 && !bad,
      'Saved log review: calendar duration badge + durationSeconds in state',
      `calendar 10:00=${cardDuration}; durationSeconds=${persisted}; running timer=${bad}`,
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome4Template() {
  const { browser, page } = await newPageWithStorage(storageTemplateTmFlagFixture());
  try {
    await waitForAppReady(page);
    await page.locator('button').filter({ hasText: /^Template$/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Edit' }).nth(1).click();
    await page.waitForTimeout(200);
    const amber = await page.getByText('Needs Linked TM', { exact: false }).count();
    record(
      '4-template-tm-flag',
      amber >= 1,
      'Template tab, Mystery Press 70% without TM',
      amber >= 1 ? `found ${amber} "Needs Linked TM" label(s)` : 'amber TM flag not found',
    );
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Edit' }).nth(0).click();
    await page.waitForTimeout(200);
    const needsTmWave = await page.getByText('needs TM', { exact: false }).count();
    record(
      '4-wave-needs-tm',
      needsTmWave >= 1,
      'Weekly progression row for week 3 without TM',
      `wave column "needs TM" count=${needsTmWave} (Squat week3 75% has no TM in fixture)`,
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome5() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, storageOfflineFallbackFixture());
  const pg = await context.newPage();
  try {
    const spinnerPromise = pg.waitForSelector('text=Syncing your workouts', { timeout: 4000 }).then(() => true).catch(() => false);
    await pg.goto(`${baseURL}?testhooks=1`, { waitUntil: 'domcontentloaded' });
    const sawSpinner = await spinnerPromise;
    await pg.waitForFunction(() => (document.body?.innerText || '').includes('Offline Fixture Cycle'), { timeout: 15000 });
    const body = await pg.evaluate(() => document.body.innerText);
    const wrongTitle = body.includes('Training Cycle 1') && !body.includes('Offline Fixture Cycle');
    record(
      '5-loading-gate',
      sawSpinner && body.includes('Offline Fixture Cycle') && !wrongTitle,
      'Playwright waitForSelector(Syncing your workouts) during guest fixture load',
      `spinner seen=${sawSpinner}, shows Offline Fixture Cycle=${body.includes('Offline Fixture Cycle')}, wrong Training Cycle 1 only=${wrongTitle}`,
    );
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    await pg.screenshot({ path: path.join(MEDIA_DIR, 'outcome-5-loaded.png'), fullPage: false });
  } catch (e) {
    record('5-loading-gate', false, 'loading gate e2e', e.message);
  } finally {
    await browser.close();
  }
}

async function checkOutcome5Simple() {
  const { browser, page } = await newPageWithStorage(storageOfflineFallbackFixture());
  try {
    await waitForAppReady(page);
    const title = await page.evaluate(() => document.body.innerText);
    const pass = title.includes('Offline Fixture Cycle') && !title.match(/Training Cycle 1/);
    record(
      '5-metadata-title-after-load',
      pass,
      'Guest load from localStorage block-metadata name',
      pass ? 'calendar shows Offline Fixture Cycle (not default Training Cycle 1)' : `body snippet: ${title.slice(0, 120)}`,
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome6Calendar() {
  const { browser, page } = await newPageWithStorage(storageCalendarWeek3Fixture());
  try {
    await waitForAppReady(page);
    const mondayText = await page.locator('text=Monday').locator('..').locator('..').innerText();
    const pass = mondayText.includes('5×3 @ 75%');
    record(
      '6-week-header-prescription',
      pass,
      'Calendar week 3 monday card',
      pass ? `monday card contains "5×3 @ 75%"` : `monday card text: ${mondayText.replace(/\n/g, ' | ')}`,
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome6Merge() {
  const { browser, page } = await newPageWithStorage(storageMergeFixture());
  try {
    await waitForAppReady(page);
    await page.evaluate(() => {
      window.__wtTestHooks.mergeExercises(['db bench'], 'Dumbbell Bench Press');
    });
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => {
      const logs = window.__wtTestHooks.getWorkoutLogs();
      const meta = window.__wtTestHooks.getBlockMetadata();
      const drafts = window.__wtTestHooks.readDrafts();
      const tms = window.__wtTestHooks.getTrainingMaxes();
      return {
        logName: logs['block1-week1-monday']?.exercises?.[0]?.name,
        logNotes: logs['block1-week1-monday']?.exercises?.[0]?.notes,
        planName: meta[1]?.plans?.['week2-friday']?.exercises?.[0]?.name,
        snapKeys: Object.keys(meta[1]?.trainingMaxSnapshot || {}),
        draftName: drafts['block1-week1-tuesday']?.exercises?.[0]?.name,
        draftNotes: drafts['block1-week1-tuesday']?.exercises?.[0]?.notes,
        tmKeys: Object.keys(tms),
        prDbGone: !tms['db bench'],
      };
    });
    const pass =
      state.logName === 'Dumbbell Bench Press' &&
      state.logNotes === 'merge-me' &&
      state.planName === 'Dumbbell Bench Press' &&
      state.snapKeys.includes('Dumbbell Bench Press') &&
      !state.snapKeys.includes('db bench') &&
      state.draftName === 'Dumbbell Bench Press' &&
      state.draftNotes === 'draft-preserved' &&
      state.prDbGone;
    record(
      '6-merge-data-preservation',
      pass,
      'testhooks mergeExercises(db bench → Dumbbell Bench Press)',
      JSON.stringify(state),
    );
  } finally {
    await browser.close();
  }
}

async function checkOutcome3InBrowser() {
  const { browser, page } = await newPageWithStorage(storageWithSavedMonday());
  try {
    await waitForAppReady(page);
    const pure = await page.evaluate(() => {
      const { foldTrainingMax } = window.__wtPure;
      const today = '2026-11-08';
      let map = { Bench: { true1RM: 200, trainingMax: 180, trainingMaxPercent: 90, lastUpdated: '2026-01-01', history: [] } };
      map = foldTrainingMax(map, 'Bench', 220, 90, today, { historySource: 'manual' });
      const beforeLen = 1;
      map = foldTrainingMax(map, 'Bench', 240, 90, today, { recordHistory: false });
      return {
        manualSource: map.Bench.history[0]?.source,
        lenAfterCycleFold: map.Bench.history.length,
        tm: map.Bench.trainingMax,
        expectedLen: beforeLen,
      };
    });
    const pass = pure.manualSource === 'manual' && pure.lenAfterCycleFold === 1;
    record(
      '3-browser-pure-fold',
      pass,
      'page.evaluate __wtPure.foldTrainingMax',
      JSON.stringify(pure),
    );
  } finally {
    await browser.close();
  }
}

async function safeRun(fn) {
  try {
    await fn();
  } catch (e) {
    record('runner-error', false, fn.name, e.message);
  }
}

export async function runE2E() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  await safeRun(checkOutcome1);
  await safeRun(checkOutcome2);
  await safeRun(checkOutcome3InBrowser);
  await safeRun(checkOutcome4Template);
  await safeRun(checkRolloverModalPreview);
  await safeRun(checkPlanNoTimer);
  await safeRun(checkDraftHistoryNoTimer);
  await safeRun(checkOutcome5);
  await safeRun(checkOutcome5Simple);
  await safeRun(checkOutcome6Calendar);
  await safeRun(checkOutcome6Merge);
  return results;
}

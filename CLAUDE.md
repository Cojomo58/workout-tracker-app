# Workout Tracker App

## Project Overview
React-based workout tracking application for logging strength training, cardio, and Tabata/HIIT workouts with progression analytics and personal record tracking. Supports cloud sync via Supabase with offline-first localStorage fallback. Organizes workouts into named training cycles (blocks) with multi-week navigation. Supports percentage-based programming via per-exercise training maxes.

## Tech Stack
- **Frontend**: React 19 (single-page application)
- **Build Tool**: Vite 8 (uses Rolldown bundler — ~3x faster builds)
- **Styling**: Tailwind CSS 4.3 (Vite plugin, no postcss.config.js or tailwind.config.js)
- **Charts**: Recharts 3.7
- **Icons**: Lucide React 1.x
- **Search**: Fuse.js (fuzzy search)
- **Backend**: Supabase (PostgreSQL + Auth) -- optional, app works without it
- **Storage**: Dual -- localStorage (always) + Supabase cloud (when logged in)

## Project Structure
```
workout-tracker-app/
├── src/
│   ├── App.jsx            # Main component (monolithic) — includes ExerciseTypeBadge, ModalHeader, createEmptyBlock, STARTER_TEMPLATES above WorkoutTracker
│   ├── supabaseClient.js  # Supabase client singleton
│   ├── main.jsx           # React entry point
│   └── index.css          # @import "tailwindcss" + @theme block (custom colors/animations)
├── .env.local             # Supabase credentials (gitignored)
├── index.html             # HTML template
├── package.json           # Dependencies
└── vite.config.js         # Vite config — includes @tailwindcss/vite plugin + base: /workout-tracker-app/
```
Note: `tailwind.config.js` and `postcss.config.js` were removed in the Tailwind 4 migration.
Custom theme tokens (gold/volume colors, pr-bounce/timer-pulse animations) live in `src/index.css` under `@theme`.

## Key Data Structures

### Training Cycle Metadata
```javascript
blockMetadata = {
  1: { name: "Spring 2025 Hypertrophy", startDate: "2025-01-15", currentWeek: 3,
       trainingMaxSnapshot: { "Bench Press": { true1RM: 236, trainingMax: 212.5, trainingMaxPercent: 90 } } },
  2: { name: "Summer Cut", startDate: "2025-04-01", currentWeek: 1, trainingMaxSnapshot: { ... } }
}
// currentBlock: integer — which block is active (1-N)
```

### Workout Log Entry
```javascript
workoutLogs = {
  "block1-week1-monday": {
    date: "2024-01-15",
    exercises: [{ name, type, sets, notes }],
    prsHit: 2,
    durationSeconds: 3852   // total session length; omitted on logs saved before v2.7
  }
}
// Keys always use the pattern: block${currentBlock}-week${weekNum}-${day}
```

### Exercise Set Structures
```javascript
// Strength
{ weight: "185", reps: "8" }

// Cardio
{ distance: "3.5", time: "28:30", unit: "miles" | "km" }

// Tabata
{ rounds: "8", workSeconds: "20", restSeconds: "10", calories: "150" }

// Bodyweight
{ reps: "25", holdTime: "60" }  // holdTime in seconds
```

### Personal Records
```javascript
personalRecords = {
  "Bench Press": {
    maxWeight: { value, date, reps },
    maxVolume: { value, weight, reps },
    estimated1RM: { value, weight, reps }
  },
  "Running": {
    maxDistance: { value, unit },
    fastestPace: { value, displayValue }
  },
  "Bike Tabata": {
    mostRounds: { value, workSeconds, restSeconds },
    mostSets: { value }
  },
  "Push-ups": {
    maxReps: { value, date },
    longestHold: { value, date }
  }
}
// PRs are standalone — NOT tied to any block. They accumulate globally across all cycles.
```

### Training Maxes
```javascript
trainingMaxes = {
  "Bench Press": {
    true1RM: 225,
    trainingMaxPercent: 90,
    trainingMax: 202.5,   // roundToNearest2_5(true1RM * trainingMaxPercent / 100)
    lastUpdated: "2025-01-15"
  }
}
// Global (not block-specific). Used to auto-fill set weights from template % of TM.
// roundToNearest2_5(): rounds to nearest 2.5 lb increment
// getPercentageWeight(exerciseName, pct): returns tm.trainingMax * pct / 100, rounded
// saveTrainingMax(exerciseName, true1RM, pct): sets or updates entry
```

### Template Exercise (with TM support)
```javascript
// blocks[0].template[dayKey].exercises[n]
{ name, sets, reps, technique, rest, percentage, tmLink }
// percentage (optional): % of training max used to auto-fill set weights
// tmLink (optional): explicit training max key to use instead of matching by exercise name
// Live lb preview shown in template editor when a matching TM exists
```

## Key Functions (App.jsx)
- `exportData()`: JSON backup export (version 2.1) — includes currentBlock, blockMetadata, trainingMaxes
- `importData()`: JSON restore with shape validation; backward compatible (v1.x recalculates PRs from logs)
- `migrateHistoricalPRs()`: Recalculate PRs from workout logs
- `checkForPRs()`: Detect new PRs during save
- `computePRsForExercise(basePRs, name, sets, date, logKey, type)`: Returns a NEW PR map with one exercise folded in — reduce it over a session's exercises (was `updatePRs()`, which called `setPersonalRecords` off a stale closure)
- `handleSaveWorkout()`: The only path that commits a workout log; verifies the localStorage write before discarding the draft
- `todayLocalISO()`: Today's LOCAL `YYYY-MM-DD` — use instead of `toISOString().split('T')[0]`, which is UTC
- `resolveStartWeek()` / `parseLogKey()` / `earliestDateForBlock()` / `readWeekMirror()`: module-level helpers next to `getNextUpSlot`
- `getAllExerciseHistory()`: Get all-time exercise history across all blocks
- `getAllExerciseNames()`: Get unique exercise names for fuzzy search
- `handleAuth()`: Email/password login or signup via Supabase
- `handleLogout()`: Sign out, revert to guest mode
- `saveToSupabase()`: Debounced (1s) cloud save of all data
- `loadFromLocalStorage()`: Load all data from localStorage (seeds blockMetadata for existing users)
- `loadFromCloud()`: Load all data from Supabase + cache to localStorage
- `roundToNearest2_5()`: Round weight to nearest 2.5 lb increment
- `deriveTrainingMax(true1RM, pct)`: Calculate training max from 1RM and percentage
- `getPercentageWeight(exerciseName, percentage)`: Get auto-fill weight for a given TM%
- `saveTrainingMax(exerciseName, true1RM, pct)`: Save/update a training max entry (wraps `foldTrainingMax`)
- `foldTrainingMax(prevMap, name, true1RM, pct, today)`: Module-level, pure — returns a NEW TM map with one entry folded in; lets the cycle rollover build a whole map synchronously
- `lookupTrainingMax(name)` / `resolveTMKey(name, tmLink, tmKeys)`: Tolerant TM lookup (exact → case-insensitive) and full resolution (`tmLink` → exact → case-insensitive → fuzzy)
- `buildCycleRolloverSuggestions(blockNum)`: What every trained exercise's TM should become next cycle — `{ rows, untrained }`, writes nothing
- `startNewCycle(rowsToApply)`: The only path that advances a cycle; applies confirmed TMs and snapshots both cycles
- `cycleIncrementFor(name)`: +10 lb lower body / +5 lb upper body standard cycle bump
- `snapshotTrainingMaxes(tmMap)`: Strip a TM map down to the per-cycle record stored on `blockMetadata`

## Training Cycle (Block) Management
- `currentBlock` (int): Active block number, starts at 1, increments when user starts a new cycle
- `blockMetadata`: Named cycles with start dates, stored separately from the workout template
- `highestBlockWithData`: Computed — max block number with any logs or metadata. Only used to pick the next block number in "New Cycle".
- Template (`blocks[0]`): Single shared template used across all cycles; users edit it for the next cycle
- Starting a new block: increments `currentBlock`, resets `currentWeek` to 1, copies no data
- **Every cycle always has a metadata entry.** Both load paths *merge* seeds into `blockMetadata` rather than replacing it, and an effect creates a missing entry for `currentBlock` (start date inferred from that block's earliest log via `earliestDateForBlock()`). This is load-bearing — see below.

### `isViewingCurrentBlock` was removed (v2.9)
- It gated both the Save Workout button and calendar-card clickability. Whenever `currentBlock` ran ahead of `highestBlockWithData` the Save button was **not rendered at all**, and since saving is the only way to give a block data, the state was a permanent deadlock — no save → no logs → still hidden.
- The way in was `loadFromCloud`: it set `currentBlock` from `data.current_block` with no clamp, and when `block_metadata` came back empty it *replaced* the metadata map with a block-1-only seed, deleting the active cycle's entry. The guarded autosave effect then wrote that truncated map back to Supabase.
- Both are fixed (clamp + merge), but the gate itself is gone: past cycles aren't browsable anyway, so it had nothing left to protect. The Save button is always rendered, `disabled` only when no named exercise exists.

### Past cycles are not browsable (v2.8)
- The block navigation row (prev/next chevrons + "Block N" pill) and the amber read-only history banner were **removed** — the Calendar always shows the newest cycle, and only its name is displayed. Week navigation is unaffected.
- Old blocks' logs are **not deleted**: they remain in localStorage/Supabase and in every export, and PRs still aggregate across all cycles via `getAllExerciseHistory()`. They are simply unreachable in the UI.
- On load, `currentBlock` is clamped forward to the highest block with data in **both** paths, so a stored `current-block` pointing at an old cycle self-corrects.
- `getLastPopulatedWeek()` was deleted with the chevrons that were its only caller.

### "Next up" landing (v2.8)
- `getNextUpSlot(blockNum, logs, template)` (module-level, next to `ALL_DAYS`) returns `{ week, day }` for the training slot **immediately after** the most recently saved workout: it walks forward from the day after the last logged one and returns the first slot that is both unlogged and actually planned in the template, rolling into the next week when a week is finished (last save Friday → next Monday). Falls back to plain weekday order when the template is empty, and caps the scan at 4 weeks so a fully-logged cycle can't spin. No logs in the cycle → `{ week: 1, first planned day }`.
- A `nextUpSlot` memo drives a green **"Next up"** badge + emerald ring on that day's Calendar card. It's derived from `workoutLogs`, so it advances on its own as soon as a workout is saved. The app deliberately does **not** auto-open the log view — that would start the session clock on every app launch.

### Week tracking (v2.9)
- `getNextUpSlot` alone is **not** enough to pick the opening week: it returns week 1 for any cycle with zero logs, so a cycle that hadn't been saved to reopened on Week 1 every time. The week is now persisted.
- **Where it's stored:** `blockMetadata[blockNum].currentWeek`, so it rides the existing `block_metadata` JSONB column — **no Supabase migration**. A scalar `current-week` localStorage key (`{ block, week }`) mirrors it in case the metadata map is lost. An effect on `[currentBlock, currentWeek, dataLoaded]` writes both; its functional `setBlockMetadata` updater is what keeps it from looping, and it doubles as the self-heal that guarantees an entry for the active cycle.
- **`resolveStartWeek(blockNum, logs, template, storedWeek, blockWeeks)`** (module-level) is what both load paths call: `Math.max(storedWeek, getNextUpSlot(...).week)`, capped at `Math.max(blockWeeks, nextUp)`. The stored week wins when the cycle has no logs yet; the logs win once they pass it, so the week still advances on its own.
- `handleSaveWorkout` bumps `currentWeek` to `getNextUpSlot(...)`'s week when a save finishes the week — the header and the "Next up" badge are driven by the same function and can't disagree.
- The forward chevron caps at `Math.max(blocks[0].weeks || 4, nextUpSlot.week)`, not at the block length alone. The old cap stranded anyone on week 4 of a 4-week block.

### Saving a workout (v2.9)
- `handleSaveWorkout()` (near `loadDayIntoLogView`) replaced the inline `onClick`. It is still the **only** path that turns a session into a log entry — the autosaved draft is not a save.
- It **writes `workout-logs` to localStorage and reads it back to verify before deleting the draft.** The old order deleted the draft first and left persistence to a `useEffect` whose `setItem` swallows quota errors, so a failed save destroyed the session while the UI navigated away as if it worked. On failure it re-saves the draft, shows a red notice, and stays in the log view with both timers running.
- Refuses to save with no named exercise (the button is `disabled` too) — that used to write `exercises: []` and mark the day complete.
- `updatePRs` became **`computePRsForExercise(basePRs, …)`**, returning a new map instead of calling `setPersonalRecords`. The old version spread the render-time `personalRecords` on every call, and the save handler called it once per exercise in a `forEach` — so **only the last exercise's PRs survived**. The handler now folds it over an accumulator inside one functional `setPersonalRecords`.
- All dates use module-level **`todayLocalISO()`**, never `toISOString().split('T')[0]` — the latter is UTC, so west of Greenwich an evening workout was stamped the next day while `formatDate()` read it back in local time.

## Training Max System (v2.3)
- Set per-exercise training max: enter true 1RM directly or calculate via Epley formula (weight × reps)
- Configurable TM% per exercise (default 90%); stored as `trainingMaxPercent` + derived `trainingMax`
- Training Maxes panel in Progress view with add/edit buttons
- "Set as Training Max" button on Est. 1RM PR card in exercise history
- "Use as Training Max" button in PR celebration modal for estimated1RM PRs
- Template editor has `% of TM` field per exercise with live lb preview
- Template editor has `Linked TM` dropdown per exercise — explicitly links to a TM by name, bypassing name-match lookup; stored as `tmLink` on the template exercise
- Auto-fill: when opening a fresh workout from template, exercises with `percentage` + a TM (via `tmLink` or name match) get weights pre-filled
- Live `%TM` display next to weight input while logging — shows `weight ÷ trainingMax × 100`, updates as you type; uses `tmLink` if set, then case-insensitive name fallback
- `getBest1RM(exerciseName)`: returns `true1RM` from trainingMaxes if set, else estimated1RM from PRs
- Weekly progression / 5/3/1 scheme removed — simple single `% of TM` per exercise only
- **Auto-TM suggestions (suggest, don't auto-apply):** on Save Workout, `buildTMSuggestions()` computes the best Epley 1RM per strength exercise and proposes creating a new TM (if none) or raising an existing one (if the new 1RM is higher). Suggestions surface in a purple confirmation modal (after the PR modal, if any) with per-item checkboxes; nothing is written until the user clicks "Apply Selected". A suggestion resolves to an existing TM via exact name match, then `findSimilarExercise()` against TM keys — so logging "DB Bench" updates the "Dumbbell Bench Press" TM instead of creating a duplicate.

### Cycle Rollover (v3.0)
- **The problem it solves:** template weights are derived from `trainingMax`, so a cycle programmed at 65% kept auto-filling the same 212 lb forever. `buildTMSuggestions()` only fires per-save and only on a new 1RM, so an exercise trained hard without a PR never moved. Starting a new cycle now rolls the training maxes forward, which is what makes each cycle heavier than the last.
- **"New Cycle" now goes through `handleNewCycleClick()`** (near `startNewCycle`), not an inline `onClick`. It builds the rollover rows first: if there are any, the purple **Roll Training Maxes Forward** modal replaces the old `window.confirm`; if there are none (an untrained cycle), the plain confirm still applies.
- **`buildCycleRolloverSuggestions(blockNum)`** returns `{ rows, untrained }` and never writes state. Per strength exercise trained in the finishing cycle (`getCycleTrainedExercises()`, which scans `block{N}-week*` keys through `performedSets`):
  - best cycle e1RM beats the stored `true1RM` → `reason: 'pr'`, TM follows the new 1RM;
  - trained but no new e1RM → `reason: 'increment'`, TM moves by `cycleIncrementFor(name)` (**+10 lb lower body / +5 lb upper**, matched against `normalizeExerciseTokens` so "BB Squats" and "rdl" classify), with `newTrue1RM` back-derived from the target TM so the stored pair stays consistent;
  - no TM yet **and** the template programs that exercise by a percentage → `reason: 'new'`.
  - A TM with **no logged work in the cycle is left alone** and only counted in `untrained` — bumping a lift you did not train is not progression. `E1RM_MAX_REPS = 12` means a pure hypertrophy cycle yields mostly `'increment'` rows; that is correct, not a bug.
- **`startNewCycle(rowsToApply)`** is the only path that advances a cycle. It folds every confirmed row through the module-level **`foldTrainingMax()`** into one `nextTMs` map and writes it with a single `setTrainingMaxes` — a loop of `saveTrainingMax` calls could not be snapshotted, since those values only exist inside React's updater queue.
- **Per-cycle snapshots:** the same `setBlockMetadata` update stores `trainingMaxSnapshot` (via `snapshotTrainingMaxes()`, which drops `history`) on both the finishing block (pre-apply values, never overwriting an existing snapshot) and the new one (post-apply). Rides the existing `block_metadata` JSONB column — **no migration**, and export/import carry it for free. The `trainingMaxByCycle` memo reads them back into a `C1 212.5 → C2 230` line on each Progress → Training Maxes card (consecutive equal values collapse).
- **Modal:** clone of the TM-suggestion modal with per-row checkboxes *and* an editable New TM field per row; an edited TM is back-derived into a 1RM on apply. **Skip** starts the cycle changing nothing.
- **Shared resolution:** `resolveTMKey(name, tmLink, tmKeys)` (`tmLink` → exact → case-insensitive → `findSimilarExercise`) is now used by both `buildTMSuggestions()` and the rollover, so the per-save and per-cycle paths agree. `lookupTrainingMax()` gives `getPercentageWeight()`/`getBest1RM()` the same case-insensitive fallback the log-view %TM badge always had — without it a template exercise spelled "bench press" silently auto-filled nothing against a "Bench Press" TM.
- `roundToNearest2_5`, `deriveTrainingMax`, `foldTrainingMax`, `cycleIncrementFor` and `snapshotTrainingMaxes` are **module-level and pure** (top of App.jsx, next to `performedSets`); `saveTrainingMax` is now a one-line wrapper over `foldTrainingMax`.

## First-Run Onboarding (v2.5)
- The default template is blank: `createEmptyBlock()` (module-level, defined above `WorkoutTracker`) returns a single block with all 5 weekdays present but empty (`name: '', exercises: []`). This is the initial `blocks` state, and what "Reset to Default Template" / "Full Reset" restore — nothing in the app ships with any individual's personal workout data baked in.
- **First-run detection:** `hasStoredData()` checks whether `workout-logs`/`workout-blocks` already exist in localStorage; combined with a cloud check (`workout_logs` non-empty) inside the load effect, this produces `hadData`. If `!hadData && !localStorage.getItem('onboarding-complete')`, `showOnboarding` is set true. This only fires for a browser/account that has truly never had any data — existing users (local or cloud) never see it, regardless of the `onboarding-complete` flag.
- **Onboarding modal** (rendered near the other modals, gated on `showOnboarding`) offers: 3 generic `STARTER_TEMPLATES` presets (Upper/Lower, Push/Pull/Legs, Full Body — module-level constants, each a `build()` function returning a full `template` object), "Build my own" (closes the modal and jumps to the Template view with the empty template), and "Import a backup" (wires the previously-unused `importData()` to a file input; `importData` now takes an optional `onSuccess` callback so the modal only closes after a successful parse).
- Dismissing the modal any way (X, picking an option) sets the `onboarding-complete` localStorage flag so it never reappears for that browser.
- Empty-state UI: Calendar day cards show "No workout planned" + a "Set up in Template →" link when a day has no exercises; the Template editor shows "No exercises yet — add your first exercise below." per empty day; the log view header falls back to "Workout" when the day has no name.

## Progress Tab (v2.6)
- Order top to bottom: 4 stat tiles (workouts this block, current week, total strength volume this block via `getTotalVolumeForBlock()`, sessions in the last 7 days via `getSessionsInLastNDays()`) → **Exercise Trend** (the hero) → **Block Volume by Week** bar chart → **Training Maxes** (collapsed by default) → **Manage Exercises** (collapsed by default, moved to the bottom — it's admin, not progress).
- **Exercise Trend**: chips for the 6 most-frequently-logged exercises (`topExerciseNames` memo, sorted by log count) plus a fuzzy search input for anything else; both drive the existing `selectedExerciseHistory` state. Search result rows show `N sessions · e1RM X → Y` when the exercise is strength and has 2+ e1RM points.
- Strength exercises default to an **e1RM** chart (`chartType` state defaults to `'e1rm'` now, not `'weight'`); the metric toggle is e1RM / Top Set (renamed from "Weight") / Volume — "Reps" was dropped from this toggle. `getExerciseProgressionData(name, 'e1rm')` takes the best `calculateEstimated1RM(weight, reps)` across each session's sets. Cardio/tabata/bodyweight keep their existing per-type toggles unchanged.
- **Block Volume by Week**: `getBlockWeeklyVolume(blockNum)` sums strength-only volume per week from `workoutLogs` keys matching `block{N}-week{W}-*`, rendered as a Recharts `BarChart`. Needs 2+ weeks of data or shows an empty-state message.
- **Training Maxes** section: `tmSectionOpen` state (default closed), its own `tmFilter` search (separate from Manage Exercises' `exFilter` — don't reuse one for both), `grid md:grid-cols-2` cards. Each card shows a delta line (`+15 lb since 2026-03-03`) computed from `tm.history[0].trainingMax` vs current `tm.trainingMax`, only when non-zero.
- **Manage Exercises** section: `manageExOpen` state (default closed); content (duplicate-merge tool + rename/delete list) unchanged, just relocated and collapsed.

## Duplicate Exercise Detection (v2.4)
- Module-level pure helpers (top of App.jsx): `EXERCISE_ABBREV` (db→dumbbell, bb→barbell, ohp→overhead press, etc.), `normalizeExerciseTokens()` (lowercase, expand abbreviations, strip stop-words, crude singularize), `exerciseSimilarity()` (Jaccard over normalized token sets), `findSimilarExercise(name, candidates, threshold=0.6)`.
- `allKnownExerciseNames` memo: dedup pool of every name across logs + training maxes + template — the candidate set for detection.
- **Inline warning while logging:** each exercise card shows an amber "Similar to existing '<name>'" banner when `findSimilarExercise` matches, with a one-click button that renames the in-progress exercise to the canonical name (no history merge — the workout isn't saved yet).
- **Merge tool in Manage Exercises:** `duplicateClusters` memo (union-find over `allKnownExerciseNames` at similarity ≥ 0.6) lists "Possible duplicates". User picks the keeper (defaults to a TM entry if one exists, else the longest name) and merges; `mergeExercises(fromNames, toName)` relabels logs, recomputes PRs from the merged logs via `migrateHistoricalPRs()`, folds TMs keeping the highest `true1RM`, and relabels template `name`/`tmLink`.

## Data Flow
```
Guest mode:  React State ←→ localStorage (auto-save on state change)
Logged in:   React State ←→ localStorage (cache) + Supabase (cloud, debounced 1s)
```

## UI Conventions
- Dark theme (gray-900 background)
- Color coding:
  - **Emerald (green)**: Strength, improvements, success, new block button
  - **Blue**: Cardio, matched performance, cloud sync
  - **Orange**: Tabata/HIIT
  - **Purple**: Training maxes, TM% badges, TM modal
  - **Violet/Purple**: Bodyweight exercises
  - **Red**: Deletions, decreases
  - **Gold/Yellow**: PRs and celebrations
  - **Amber**: Historical block banners, read-only indicators
- All interactive elements have `title` attributes for tooltips
- `inputMode="decimal"` on all numeric inputs for mobile keypad
- Notes field is collapsible in log view (shows `+ Add note` when empty)

## Logging Screen (mobile-first, v2.5)
- Exercise cards in the log view are an **accordion** (`expandedExIdx` state, single index, `null` = all collapsed). Opening a new day's log defaults to expanding the first exercise. Adding an exercise expands it; removing one re-targets `expandedExIdx` to stay valid.
- Collapsed card = one row: reorder arrows (mobile only, `moveExercise(idx, direction)` swaps neighbors since HTML5 drag doesn't work on touch) / `GripVertical` drag handle (desktop only, `md:` breakpoint), name, `ExerciseTypeBadge`, template target, `completed/total` set count, chevron. Tap the row to expand/collapse.
- Set rows are a CSS grid (`grid-cols-[2.25rem_1fr_1fr_2rem]` for strength/bodyweight; wider variants for cardio/tabata), not `flex flex-wrap` — this is what keeps one set to one row on a 375px screen.
- `NumberField` (module-level component, alongside `ExerciseTypeBadge`/`ModalHeader`) is the `− [input] +` stepper used for every numeric set field; the `%TM` badge and the improved/matched comparison arrow moved out of the input row into a sub-line beneath it.
- The Save Workout button lives in a `sticky bottom-0` footer bar at the bottom of the log view, alongside a `completed/total` sets readout and the draft-save status text (see below).

### Set completion (v2.6)
- Each set object carries an optional `completed` boolean (undefined/false = not done); it's real session data and is persisted in the saved log (only `weightSource` is stripped from sets before saving, `completed` passes through).
- The set-number chip (round button, left column of every set row) toggles `completed`; the icon swaps to a checkmark, the row dims (`opacity-60`) and gets an emerald left border, but every field stays editable.
- `toggleSetCompleted(exIdx, setIdx)` (defined near `moveExercise`) handles the toggle: on completion it fills empty fields via `prefillSetOnComplete()` (previous set in the same exercise → template target/%TM → last session's matching set, first non-empty wins), auto-starts the rest timer, and — once every set in the card is done — auto-advances `expandedExIdx` to the next exercise with an incomplete set (skipped if a text input is currently focused).
- The old "matched previous session" `✓`/`↑` markers still exist but as labeled text (`↑ improved` / `✓ matched`) in the sub-line under the weight field — kept visually distinct from the new completion checkmark.

### Rest timer (v2.7, global + persistent, per-set anchored)
- One rest timer per session, not per exercise. State shape: `{ exIdx, setIdx, exName, endsAt, running, remainingMs }` — timestamp-based (`endsAt`), not tick-decremented, so backgrounding the tab doesn't cause drift; a 1s interval (`restTick` state) just forces a re-render, and the displayed remaining time is always computed fresh from `endsAt - Date.now()`.
- Persisted to localStorage key `rest-timer` (written with a `_savedAt` stamp on every change); restored on mount and dropped if `_savedAt` is more than 10 minutes old. Mute preference persisted separately as `rest-timer-muted`.
- **Per-set placement (v2.7):** `RestTimerBar` (module-level, alongside `formatSecondsToTime`) renders inline directly under the specific set row that started it (`restTimer.exIdx === exIdx && restTimer.setIdx === setIdx`), not as a single global bar. `setIdx` is `null` only for a timer started via the manual "Start Rest" control (not anchored to a set). A fallback chip in the sticky action bar above Save Workout covers the case where the owning set row isn't on screen — the timer belongs to a collapsed exercise card, or has `setIdx == null` — and is suppressed whenever the inline placement is already visible, so the two never show at once. Not cleared when leaving the log view (only `Save Workout` calls `stopRestTimer()`).
- `parseRestSeconds(restStr)` parses a template `rest` string ("2-3 min", "90 sec") into seconds for auto-start; `templateRest` is threaded through every exercise-construction site (template prefill, last-week prefill, "Use Template", "Load Last Week") alongside the existing `templateReps`/`templateTarget` and is stripped (UI-only) before saving.
- Completion plays `navigator.vibrate` and a short WebAudio beep (`ensureRestAudioCtx()`/`playRestBeep()`); the AudioContext is created/resumed inside the same click handler that starts the timer (a user gesture) since iOS Safari blocks audio otherwise.

### Session clock (v2.7, wall-clock anchored, auto start/stop)
- Tracks total time spent on a workout day, separate from the rest timer. State shape: `{ logKey, startedAt, accumulatedMs, running, seeded }`, mirroring the rest timer's wall-clock-anchored approach — elapsed is always `accumulatedMs + (running ? Date.now() - startedAt : 0)`, computed at render, never decremented; a 1s `sessionTick` just forces a re-render, and the rest timer's existing `visibilitychange` listener bumps it too instead of a second listener.
- **Auto start/stop:** `startSessionFor(logKey, savedDurationSeconds)` runs at the top of `loadDayIntoLogView()` (before its early-return draft-restore branch) — restores an in-progress timer untouched if one already exists for the same `logKey` (so navigating to Progress/History and back doesn't restart or double-count), else seeds a paused clock from `savedDurationSeconds` when reopening a day that already has a saved log, else starts a fresh running clock. Save Workout writes `durationSeconds` onto the log entry and clears the timer (`setSessionTimer(null)`) alongside `deleteDraft()`/`stopRestTimer()`. Deliberately keeps running across view changes (Progress, History, etc.) — only `view !== 'log'` does NOT stop it.
- Manual `pauseResumeSession()` / `resetSession()` controls sit in the Session Info card (log view) next to the Workout Date field. `seeded` marks a timer created paused-with-a-recorded-duration rather than a live session; it's cleared the moment the user actually pauses, resumes, or resets, so the label only reads "Recorded time" (muted gray) for an untouched reopen of a saved workout — otherwise it reads "Session Time" (live emerald).
- Persisted to localStorage key `workout-session-timer` on every change, restored on mount. Unlike the rest timer's 10-minute stale-drop, a restored *running* timer whose elapsed already exceeds 6 hours is restored **paused** rather than discarded — a real session can legitimately run over an hour.
- Not shown on calendar day cards or in Progress stats — display is limited to the Session Info card in the log view, by design.

### Draft autosave (v2.6)
- `loadDayIntoLogView(day, { skipDraft })` (near `moveExercise`) is the single entry point for opening a day's log — replaces what used to be an inline calendar-card `onClick`. It checks for an unsaved draft first (unless `skipDraft`), else falls back to the existing saved log, then last-week prefill, then the template.
- Drafts live in one localStorage key `workout-drafts`: `{ [logKey]: { date, exercises, savedAt } }`. Written on a 500ms debounce from a `useEffect` on `[exercises, logDate]`, but only once the current state actually differs from `openedSnapshotRef` (a JSON snapshot taken when the day was opened) — so opening and immediately closing a day writes nothing. Flushed immediately on `visibilitychange → hidden` / `pagehide`; a `beforeunload` prompt only fires during the brief window a debounced write hasn't landed yet. Pruned (14-day cutoff) once on mount.
- Opening a day with a newer draft shows a blue "Restored unsaved draft from Ns ago" banner with a **Start fresh** link (`deleteDraft` + reload via `loadDayIntoLogView(day, { skipDraft: true })`).
- The sticky footer's left slot shows `completed/total sets` and `Saving…` / `Saved Ns ago` (`timeAgo()`, refreshed every 30s via `footerTick`).
- The log view's X button opens an exit-guard modal (Save Workout / Leave-keep-draft / Discard-draft) only when the current state differs from `openedSnapshotRef`; switching to Calendar/Progress/Template never prompts.
- `Save Workout` deletes the draft for that `logKey` and stops the rest timer on success — the draft only represents *unsaved* state.

## Storage

### localStorage Keys (always used as cache)
- `workout-logs`: All workout session data (all blocks)
- `workout-blocks`: Training block template (single shared template)
- `personal-records`: All personal records (global, not block-specific)
- `current-block`: Active block number (integer)
- `current-week`: Scalar mirror of the active week — `{ block, week }`; fallback for when `block-metadata` is lost
- `block-metadata`: Named cycle metadata `{ [blockNum]: { name, startDate, currentWeek, trainingMaxSnapshot } }` — `currentWeek` and `trainingMaxSnapshot` both ride this map so neither needs a Supabase migration
- `training-maxes`: Training max weights `{ [exerciseName]: { true1RM, trainingMaxPercent, trainingMax, lastUpdated } }`
- `workout-drafts`: In-progress (unsaved) log edits, keyed by logKey — `{ [logKey]: { date, exercises, savedAt } }`; deleted per-key on Save Workout, pruned after 60 days (was 14 — a draft is the only copy of an unsaved session). Surfaced on the Calendar as an amber "You have N unsaved workouts" banner listing every draft with no matching log, each with an Open button that jumps to that draft's week
- `rest-timer`: The single active rest timer, if any — `{ exIdx, setIdx, exName, endsAt, running, remainingMs, _savedAt }`; dropped on restore if `_savedAt` is over 10 minutes old
- `rest-timer-muted`: `"true"` / `"false"` — rest timer completion sound preference
- `workout-session-timer`: The active per-day session clock, if any — `{ logKey, startedAt, accumulatedMs, running, seeded }`; cleared on Save Workout; a restored *running* timer over 6 hours elapsed is paused, not dropped

### Supabase `user_data` Table (when logged in)
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (FK to auth.users) | User identity |
| workout_logs | JSONB | All workout sessions (all blocks) |
| blocks | JSONB | Training template (shared) |
| personal_records | JSONB | PR tracking (global) |
| current_block | INTEGER | Active block number |
| block_metadata | JSONB | Named cycle info `{ blockNum: { name, startDate, currentWeek, trainingMaxSnapshot } }` |
| training_maxes | JSONB | Training max weights (global, not block-specific) |
| updated_at | TIMESTAMPTZ | Auto-updated timestamp |

**Supabase migrations required:**
```sql
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS current_block integer DEFAULT 1;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS block_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS training_maxes jsonb DEFAULT '{}'::jsonb;
```

## Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL (optional -- app works without it)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key (optional)

Set in `.env.local` for local dev. For GitHub Pages deployment, set as GitHub repository variables (Settings > Secrets and variables > Actions > Variables).

## Development Commands
```bash
npm install     # Install dependencies
npm run dev     # Start dev server (localhost:5173)
npm run build   # Production build
npm run preview # Preview production build
```

## Deployment
- GitHub Pages via GitHub Actions
- Build output: `dist/` folder
- Base URL: `/workout-tracker-app/`
- Supabase env vars injected during CI build via GitHub repository variables

## Notes
- Single-file architecture in App.jsx + supabaseClient.js
- Cloud sync via Supabase when logged in, localStorage-only guest mode when not
- Export/import works regardless of login state (reads from React state); export version 2.1 (unchanged)
- "Full Reset (Keep PRs)" button in template editor: clears logs, template, metrics, training maxes, resets block to 1 — preserves personalRecords
- Previous session data shown inline while logging (blue banner per exercise with last session date + sets)
- Fuzzy search enabled for exercise name matching
- Auth supports email/password only (Google OAuth removed)
- Training max weights are rounded to nearest 2.5 lb (`roundToNearest2_5`)
- Internal set fields (`weightSource`, `_notesOpen`, `templateTarget`) are stripped before saving logs

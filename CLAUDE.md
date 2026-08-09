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
  1: { name: "Spring 2025 Hypertrophy", startDate: "2025-01-15" },
  2: { name: "Summer Cut", startDate: "2025-04-01" }
}
// currentBlock: integer — which block is active (1-N)
```

### Workout Log Entry
```javascript
workoutLogs = {
  "block1-week1-monday": {
    date: "2024-01-15",
    exercises: [{ name, type, sets, notes }],
    prsHit: 2
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
- `updatePRs()`: Persist new PRs
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
- `saveTrainingMax(exerciseName, true1RM, pct)`: Save/update a training max entry

## Training Cycle (Block) Management
- `currentBlock` (int): Active block number, starts at 1, increments when user starts a new cycle
- `blockMetadata`: Named cycles with start dates, stored separately from the workout template
- `highestBlockWithData`: Computed — max block number with any logs or metadata (drives nav caps)
- `isViewingCurrentBlock`: `currentBlock === highestBlockWithData` — false when browsing history
- Template (`blocks[0]`): Single shared template used across all cycles; users edit it for the next cycle
- Starting a new block: increments `currentBlock`, resets `currentWeek` to 1, copies no data
- Past blocks: fully browseable but read-only (empty days non-clickable, Save button hidden)

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

### Rest timer (v2.6, global + persistent)
- One rest timer per session, not per exercise. State shape: `{ exIdx, exName, endsAt, running, remainingMs }` — timestamp-based (`endsAt`), not tick-decremented, so backgrounding the tab doesn't cause drift; a 1s interval (`restTick` state) just forces a re-render, and the displayed remaining time is always computed fresh from `endsAt - Date.now()`.
- Persisted to localStorage key `rest-timer` (written with a `_savedAt` stamp on every change); restored on mount and dropped if `_savedAt` is more than 10 minutes old. Mute preference persisted separately as `rest-timer-muted`.
- Rendered as a bar directly above the sticky Save Workout footer — visible regardless of which exercise card is expanded, and **not** cleared when leaving the log view (only `Save Workout` calls `stopRestTimer()`). When no timer is running, a manual "Start Rest" control targets whichever exercise is currently expanded.
- `parseRestSeconds(restStr)` parses a template `rest` string ("2-3 min", "90 sec") into seconds for auto-start; `templateRest` is threaded through every exercise-construction site (template prefill, last-week prefill, "Use Template", "Load Last Week") alongside the existing `templateReps`/`templateTarget` and is stripped (UI-only) before saving.
- Completion plays `navigator.vibrate` and a short WebAudio beep (`ensureRestAudioCtx()`/`playRestBeep()`); the AudioContext is created/resumed inside the same click handler that starts the timer (a user gesture) since iOS Safari blocks audio otherwise.

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
- `block-metadata`: Named cycle metadata `{ [blockNum]: { name, startDate } }`
- `training-maxes`: Training max weights `{ [exerciseName]: { true1RM, trainingMaxPercent, trainingMax, lastUpdated } }`
- `workout-drafts`: In-progress (unsaved) log edits, keyed by logKey — `{ [logKey]: { date, exercises, savedAt } }`; deleted per-key on Save Workout, pruned after 14 days
- `rest-timer`: The single active rest timer, if any — `{ exIdx, exName, endsAt, running, remainingMs, _savedAt }`; dropped on restore if `_savedAt` is over 10 minutes old
- `rest-timer-muted`: `"true"` / `"false"` — rest timer completion sound preference

### Supabase `user_data` Table (when logged in)
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (FK to auth.users) | User identity |
| workout_logs | JSONB | All workout sessions (all blocks) |
| blocks | JSONB | Training template (shared) |
| personal_records | JSONB | PR tracking (global) |
| current_block | INTEGER | Active block number |
| block_metadata | JSONB | Named cycle info `{ blockNum: { name, startDate } }` |
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

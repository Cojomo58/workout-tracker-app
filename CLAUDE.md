# Workout Tracker App

## Project Overview
React-based workout tracking application for logging strength training, cardio, and Tabata/HIIT workouts with progression analytics and personal record tracking. Supports cloud sync via Supabase with offline-first localStorage fallback. Organizes workouts into named training cycles (blocks) with multi-week navigation.

## Tech Stack
- **Frontend**: React 18 (single-page application)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3.4
- **Charts**: Recharts 3.7
- **Icons**: Lucide React
- **Search**: Fuse.js (fuzzy search)
- **Backend**: Supabase (PostgreSQL + Auth) -- optional, app works without it
- **Storage**: Dual -- localStorage (always) + Supabase cloud (when logged in)

## Project Structure
```
workout-tracker-app/
├── src/
│   ├── App.jsx            # Main component (monolithic)
│   ├── supabaseClient.js  # Supabase client singleton
│   ├── main.jsx           # React entry point
│   └── index.css          # Tailwind imports + custom CSS
├── .env.local             # Supabase credentials (gitignored)
├── index.html             # HTML template
├── package.json           # Dependencies
├── vite.config.js         # Vite config (base: /workout-tracker-app/)
├── tailwind.config.js     # Custom colors (gold, volume) and animations
└── postcss.config.js      # PostCSS with Tailwind + Autoprefixer
```

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

## Key Functions (App.jsx)
- `exportData()`: JSON backup export (version 2.0) — includes currentBlock and blockMetadata
- `importData()`: JSON restore import with backward compatibility (v1.x recalculates PRs from logs)
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

## Training Cycle (Block) Management
- `currentBlock` (int): Active block number, starts at 1, increments when user starts a new cycle
- `blockMetadata`: Named cycles with start dates, stored separately from the workout template
- `highestBlockWithData`: Computed — max block number with any logs or metadata (drives nav caps)
- `isViewingCurrentBlock`: `currentBlock === highestBlockWithData` — false when browsing history
- Template (`blocks[0]`): Single shared template used across all cycles; users edit it for the next cycle
- Starting a new block: increments `currentBlock`, resets `currentWeek` to 1, copies no data
- Past blocks: fully browseable but read-only (empty days non-clickable, Save button hidden)

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
  - **Orange**: Tabata/HIIT, body weight
  - **Violet/Purple**: Bodyweight exercises
  - **Red**: Deletions, decreases
  - **Gold/Yellow**: PRs and celebrations
  - **Amber**: Historical block banners, read-only indicators
- All interactive elements have `title` attributes for tooltips

## Storage

### localStorage Keys (always used as cache)
- `workout-logs`: All workout session data (all blocks)
- `weekly-metrics`: Body weight and weekly stats (all blocks)
- `workout-blocks`: Training block template (single shared template)
- `personal-records`: All personal records (global, not block-specific)
- `current-block`: Active block number (integer)
- `block-metadata`: Named cycle metadata `{ [blockNum]: { name, startDate } }`

### Supabase `user_data` Table (when logged in)
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (FK to auth.users) | User identity |
| workout_logs | JSONB | All workout sessions (all blocks) |
| weekly_metrics | JSONB | Body weight / stats (all blocks) |
| blocks | JSONB | Training template (shared) |
| personal_records | JSONB | PR tracking (global) |
| current_block | INTEGER | Active block number |
| block_metadata | JSONB | Named cycle info `{ blockNum: { name, startDate } }` |
| updated_at | TIMESTAMPTZ | Auto-updated timestamp |

**Supabase migration required for current_block and block_metadata columns:**
```sql
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS current_block integer DEFAULT 1;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS block_metadata jsonb DEFAULT '{}'::jsonb;
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
- Export/import works regardless of login state (reads from React state); export version 2.0
- Fuzzy search enabled for exercise name matching
- Auth supports email/password only (Google OAuth removed)
- Body weight chart sorts by `blockNum * 1000 + weekNum` for correct cross-block ordering; X-axis labels use `B1W3` format

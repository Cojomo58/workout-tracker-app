# Workout Tracker App

## Project Overview
React-based workout tracking application for logging strength training, cardio, and Tabata/HIIT workouts with progression analytics and personal record tracking. Supports cloud sync via Supabase with offline-first localStorage fallback.

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

### Workout Log Entry
```javascript
workoutLogs = {
  "block1-week1-monday": {
    date: "2024-01-15",
    exercises: [{ name, type, sets, notes }],
    prsHit: 2
  }
}
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
```

## Key Functions (App.jsx)
- `exportData()`: JSON backup export with personalRecords
- `importData()`: JSON restore import with backward compatibility
- `migrateHistoricalPRs()`: Recalculate PRs from workout logs
- `checkForPRs()`: Detect new PRs during save
- `updatePRs()`: Persist new PRs
- `getAllExerciseHistory()`: Get exercise history
- `getAllExerciseNames()`: Get unique exercise names for fuzzy search
- `handleAuth()`: Email/password login or signup via Supabase
- `handleGoogleLogin()`: Google OAuth sign-in
- `handleLogout()`: Sign out, revert to guest mode
- `saveToSupabase()`: Debounced (1s) cloud save of all data
- `handleMergeChoice()`: Resolve local vs cloud data conflicts
- `loadFromLocalStorage()`: Load all data from localStorage
- `loadFromCloud()`: Load all data from Supabase + cache to localStorage

## Data Flow
```
Guest mode:  React State ←→ localStorage (auto-save on state change)
Logged in:   React State ←→ localStorage (cache) + Supabase (cloud, debounced 1s)
```

On login with data in both places, a merge modal offers: Use Cloud / Use Local / Merge Both.

## UI Conventions
- Dark theme (gray-900 background)
- Color coding:
  - **Emerald (green)**: Strength, improvements, success
  - **Blue**: Cardio, matched performance, cloud sync
  - **Orange**: Tabata/HIIT
  - **Violet/Purple**: Bodyweight exercises
  - **Red**: Deletions, decreases
  - **Gold/Yellow**: PRs and celebrations
- All interactive elements have `title` attributes for tooltips

## Storage

### localStorage Keys (always used as cache)
- `workout-logs`: All workout session data
- `weekly-metrics`: Body weight and weekly stats
- `workout-blocks`: Training block templates
- `personal-records`: All personal records

### Supabase `user_data` Table (when logged in)
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (FK to auth.users) | User identity |
| workout_logs | JSONB | All workout sessions |
| weekly_metrics | JSONB | Body weight / stats |
| blocks | JSONB | Training templates |
| personal_records | JSONB | PR tracking |
| updated_at | TIMESTAMPTZ | Auto-updated timestamp |

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
- Export/import works regardless of login state (reads from React state)
- Fuzzy search enabled for exercise name matching
- Auth supports email/password and Google OAuth

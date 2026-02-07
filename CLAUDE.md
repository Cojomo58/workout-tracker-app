# Workout Tracker App

## Project Overview
React-based workout tracking application for logging strength training, cardio, and Tabata/HIIT workouts with progression analytics and personal record tracking.

## Tech Stack
- **Frontend**: React 18 (single-page application)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3.4
- **Charts**: Recharts 3.7
- **Icons**: Lucide React
- **Search**: Fuse.js (fuzzy search)
- **Storage**: Browser localStorage (no backend)

## Project Structure
```
workout-tracker-app/
├── src/
│   ├── App.jsx         # Main component (~2500 lines, monolithic)
│   ├── main.jsx        # React entry point
│   └── index.css       # Tailwind imports + custom CSS
├── index.html          # HTML template
├── package.json        # Dependencies
├── vite.config.js      # Vite config (base: /workout-tracker-app/)
├── tailwind.config.js  # Custom colors (gold, volume) and animations
└── postcss.config.js   # PostCSS with Tailwind + Autoprefixer
```

## Key Data Structures

### Workout Log Entry
```javascript
workoutLogs = {
  "block1-week1-monday": {
    date: "2024-01-15",
    hrv: "45",
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
  }
}
```

## Key Functions (App.jsx)
- `exportData()` (~line 654): JSON backup export with personalRecords
- `importData()` (~line 685): JSON restore import with backward compatibility
- `migrateHistoricalPRs()` (~line 74): Recalculate PRs from workout logs
- `checkForPRs()` (~line 316): Detect new PRs during save
- `updatePRs()` (~line 477): Persist new PRs
- `getAllExerciseHistory()` (~line 720): Get exercise history
- `getAllExerciseNames()`: Get unique exercise names for fuzzy search

## UI Conventions
- Dark theme (gray-900 background)
- Color coding:
  - **Emerald (green)**: Strength, improvements, success
  - **Blue**: Cardio, matched performance
  - **Orange**: Tabata/HIIT
  - **Red**: Deletions, decreases
  - **Gold/Yellow**: PRs and celebrations
- All interactive elements have `title` attributes for tooltips

## localStorage Keys
- `workout-logs`: All workout session data
- `weekly-metrics`: Body weight and weekly stats
- `workout-blocks`: Training block templates
- `personal-records`: All personal records

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

## Notes
- Single-file architecture in App.jsx
- All data client-side only - use export/import for device sync
- Fuzzy search enabled for exercise name matching

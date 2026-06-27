# Workout Tracker

A comprehensive periodized workout tracking application built with React. Track your strength training, cardio, Tabata, and bodyweight workouts, monitor personal records, visualize progression with charts, and fully customize your training templates.

## Features

### Core Tracking
- **Calendar View**: Weekly workout planning with customizable training blocks
- **Exercise Logging**: Track weight, reps, and sets for each exercise
- **Multi-Block Cycles**: Organize training into named cycles; browse historical blocks (read-only) with left/right navigation

### Workout Types
- **Strength Training**: Track weight and reps with volume calculations
- **Cardio**: Track distance, time, and pace
- **Tabata/HIIT**: Track rounds completed with customizable work/rest intervals (default 20s/10s)
- **Bodyweight**: Track reps and hold time for exercises like push-ups, planks, and pull-ups

### Training Max System
- **Per-Exercise Training Maxes**: Set a true 1RM and configure a training max percentage (default 90%)
- **Auto-Fill Weights**: Exercises with a `% of TM` set in the template get weights pre-filled when you open a workout
- **TM Linking**: Explicitly link a template exercise to any training max by name (bypasses name-matching)
- **Live % Display**: Weight input shows your current % of training max as you type
- **Epley 1RM Calculator**: Calculate estimated 1RM from any weight × reps combination
- **Set from PRs**: "Set as Training Max" button on estimated 1RM PR cards

### Progressive Overload System
- **Previous Session Display**: See your last workout data while logging
- **Real-time Volume Calculation**: Track total volume (weight × reps) per exercise and workout
- **Volume Comparison**: Percentage change vs previous session
- **Visual Indicators**: Improvement arrows and match indicators for each set

### Personal Records (PRs)
- **Automatic PR Detection**: System detects new PRs when you save a workout
- **Strength PRs**: Max weight, max volume, max reps at weight, estimated 1RM
- **Cardio PRs**: Max distance, fastest pace, longest duration
- **Tabata PRs**: Most rounds, most sets in a session
- **Bodyweight PRs**: Max reps, longest hold time
- **PR Celebration Modal**: Get notified when you hit new records
- **PR Dashboard**: View all your personal records in the Progress tab

### Progress Visualization
- **Interactive Charts**: View progression over time for any exercise
- **Exercise Search**: Fuzzy search to find any exercise and see its complete history
- **Chart Type Selector**: Switch between metrics based on exercise type
  - Strength: Weight, Volume, Reps
  - Cardio: Distance, Pace, Duration
  - Tabata: Rounds, Sets
- **Training Maxes Panel**: View and manage all training maxes in one place

### Template Editor
- **Full Customization**: Edit block name, weeks, and workout days
- **Add/Remove Days**: Configure which days you train
- **Exercise Templates**: Set up default exercises with sets, reps, technique, rest times, and % of training max
- **TM Linking**: Link any template exercise to a specific training max
- **Multiple Workout Types**: Support for strength, cardio, Tabata, and bodyweight exercises
- **Full Reset (Keep PRs)**: Clear all logs, template, and training maxes while preserving personal records

### Quick Actions
- **Copy Last Session**: One-click to copy previous workout data
- **Add/Remove Sets**: Easily adjust sets during workout
- **Add/Remove Exercises**: Modify workouts on the fly

### Data Management
- **Cloud Sync**: Optional Supabase integration to sync data across devices
- **Local Storage**: All data saved in browser (no account needed)
- **Export/Import**: Backup and restore your data as JSON
- **Offline Support**: Works without internet connection
- **Guest Mode**: Full functionality without signing in

### UI Features
- **Helpful Tooltips**: Hover over elements for quick explanations
- **Dark Theme**: Easy on the eyes during workouts

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8 / Rolldown)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cojomo58/workout-tracker-app.git
   cd workout-tracker-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:5173`

## How to Use

### Setting Up Your Template

1. Go to **Edit Template** tab
2. Set your block name and number of weeks
3. Add workout days (Monday–Sunday)
4. Add exercises to each day with sets, reps, rest times, and optionally a `% of TM`

### Setting Up Training Maxes

1. Go to **Progress** tab → **Training Maxes** panel
2. Click **+ Add Training Max**
3. Enter your true 1RM (or use the Epley calculator from a recent lift)
4. Set your training max percentage (default 90%)
5. In the template editor, set `% of TM` on any exercise to auto-fill weights when logging

### Logging a Workout

1. Go to **Calendar** tab
2. Select the current week
3. Click on a day to open the workout log
4. Previous session data will display automatically
5. Select exercise type (Strength, Cardio, Tabata, or Bodyweight)
6. Enter your data:
   - **Strength**: Weight and reps for each set
   - **Cardio**: Distance and time for each entry
   - **Tabata**: Rounds completed with work/rest intervals
   - **Bodyweight**: Reps and/or hold time
7. Click **Save Workout** when done

### Managing Training Cycles

- Click **+ New Block** in the Calendar header to start a fresh training cycle
- Use the **←** / **→** arrows to navigate between past and current blocks
- Historical blocks are read-only (shown with an amber banner)
- Each block can have its own name set in the Template editor

### Viewing Progress

1. Go to **Progress** tab
2. See workout stats and PR dashboard
3. Search for any exercise to see:
   - Progression charts
   - Complete session history
   - Personal records

### Cloud Sync (Optional)

To sync your workout data across devices:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project and run the table setup SQL (see [CLAUDE.md](CLAUDE.md) for schema)
3. Enable Email auth in Authentication > Providers
4. Create a `.env.local` file in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Restart the dev server — a **Login** button will appear in the header
6. Sign up or sign in with your email — your data syncs automatically

Without Supabase configured, the app works exactly as before with localStorage only.

### Backing Up Data

1. Click **Backup/Restore** button
2. Click **Export Data** to download JSON backup
3. To restore: Click **Import Data** and select backup file

Export/import works regardless of whether you're signed in.

## Tech Stack

- **React 19**: UI framework
- **Vite 8** (Rolldown): Build tool and dev server
- **Tailwind CSS 4.3**: Styling (Vite plugin, CSS-based config via `@theme`)
- **Recharts**: Progress visualization charts
- **Lucide React 1.x**: Icons
- **Fuse.js**: Fuzzy search for exercise names
- **Supabase**: Auth + PostgreSQL cloud sync (optional)
- **localStorage**: Offline data persistence

## Project Structure

```
workout-tracker-app/
├── src/
│   ├── App.jsx            # Main application component
│   ├── supabaseClient.js  # Supabase client singleton
│   ├── main.jsx           # Application entry point
│   └── index.css          # Tailwind import + @theme (custom colors/animations)
├── .env.local             # Supabase credentials (gitignored)
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
└── vite.config.js         # Vite + @tailwindcss/vite plugin configuration
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon/public API key |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## License

MIT License - feel free to use this project for your own workout tracking!

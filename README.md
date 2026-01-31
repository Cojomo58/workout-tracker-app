# Workout Tracker

A comprehensive periodized workout tracking application built with React. Track your strength training, cardio, and Tabata workouts, monitor personal records, visualize progression with charts, and fully customize your training templates.

## Features

### Core Tracking
- **Calendar View**: Weekly workout planning with customizable training blocks
- **Exercise Logging**: Track weight, reps, and sets for each exercise
- **HRV Monitoring**: Track overnight HRV to monitor recovery
- **Body Weight Tracking**: Monitor weight changes throughout training blocks

### Workout Types
- **Strength Training**: Track weight and reps with volume calculations
- **Cardio**: Track distance, time, and pace
- **Tabata/HIIT**: Track rounds completed with customizable work/rest intervals (default 20s/10s)

### Progressive Overload System
- **Previous Session Display**: See your last workout data while logging
- **Real-time Volume Calculation**: Track total volume (weight x reps) per exercise and workout
- **Volume Comparison**: Percentage change vs previous session
- **Visual Indicators**: Improvement arrows and match indicators for each set

### Personal Records (PRs)
- **Automatic PR Detection**: System detects new PRs when you save a workout
- **Strength PRs**: Max weight, max volume, max reps at weight, estimated 1RM
- **Cardio PRs**: Max distance, fastest pace, longest duration
- **Tabata PRs**: Most rounds, most sets in a session
- **PR Celebration Modal**: Get notified when you hit new records
- **PR Dashboard**: View all your personal records in the Progress tab

### Progress Visualization
- **Interactive Charts**: View progression over time for any exercise
- **Exercise Search**: Find any exercise and see its complete history
- **Chart Type Selector**: Switch between metrics based on exercise type
  - Strength: Weight, Volume, Reps
  - Cardio: Distance, Pace, Duration
  - Tabata: Rounds, Sets

### Template Editor
- **Full Customization**: Edit block name, weeks, and workout days
- **Add/Remove Days**: Configure which days you train
- **Exercise Templates**: Set up default exercises with sets, reps, technique, and rest times
- **Multiple Workout Types**: Support for strength, cardio, and Tabata exercises

### Quick Actions
- **Copy Last Session**: One-click to copy previous workout data
- **Add/Remove Sets**: Easily adjust sets during workout
- **Add/Remove Exercises**: Modify workouts on the fly

### Data Management
- **Local Storage**: All data saved in browser (no account needed)
- **Export/Import**: Backup and restore your data as JSON
- **Offline Support**: Works without internet connection

### UI Features
- **Helpful Tooltips**: Hover over elements for quick explanations
- **Dark Theme**: Easy on the eyes during workouts

## Getting Started

### Prerequisites

- Node.js 18.x or higher
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
3. Add workout days (Monday-Sunday)
4. Add exercises to each day with sets, reps, and rest times

### Logging a Workout

1. Go to **Calendar** tab
2. Select the current week
3. Click on a day to open the workout log
4. Previous session data will display automatically
5. Select exercise type (Strength, Cardio, or Tabata)
6. Enter your data:
   - **Strength**: Weight and reps for each set
   - **Cardio**: Distance and time for each entry
   - **Tabata**: Rounds completed with work/rest intervals
7. Click **Save Workout** when done

### Viewing Progress

1. Go to **Progress** tab
2. See workout stats and PR dashboard
3. Search for any exercise to see:
   - Progression charts
   - Complete session history
   - Personal records

### Backing Up Data

1. Click **Backup/Restore** button
2. Click **Export Data** to download JSON backup
3. To restore: Click **Import Data** and select backup file

## Tech Stack

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Recharts**: Progress visualization charts
- **Lucide React**: Icons
- **localStorage**: Data persistence

## Project Structure

```
workout-tracker-app/
├── src/
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # Application entry point
│   └── index.css       # Global styles and animations
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
└── tailwind.config.js  # Tailwind configuration
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## License

MIT License - feel free to use this project for your own workout tracking!

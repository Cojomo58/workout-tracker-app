b# Workout Tracker

A comprehensive periodized workout tracking application built with React. Track your strength training progress, monitor personal records, visualize progression with charts, and fully customize your training templates.

## Features

### Core Tracking
- **Calendar View**: Weekly workout planning with customizable training blocks
- **Exercise Logging**: Track weight, reps, and sets for each exercise
- **HRV Monitoring**: Track overnight HRV to monitor recovery
- **Body Weight Tracking**: Monitor weight changes throughout training blocks

### Progressive Overload System
- **Previous Session Display**: See your last workout data while logging
- **Real-time Volume Calculation**: Track total volume (weight × reps) per exercise and workout
- **Volume Comparison**: Percentage change vs previous session
- **Visual Indicators**: Improvement arrows and match indicators for each set

### Personal Records (PRs)
- **Automatic PR Detection**: System detects new PRs when you save a workout
- **Multiple PR Types**: Max weight, max volume, max reps at weight, estimated 1RM
- **PR Celebration Modal**: Get notified when you hit new records
- **PR Dashboard**: View all your personal records in the Progress tab

### Rest Timer
- **Built-in Timer**: Start rest timer after each set
- **Fullscreen Mode**: Large countdown display during rest
- **Browser Notifications**: Get notified when rest is complete
- **Pause/Resume/Reset**: Full timer controls

### Progress Visualization
- **Interactive Charts**: View weight, volume, and rep progression over time
- **Exercise Search**: Find any exercise and see its complete history
- **Chart Type Selector**: Switch between weight, volume, and reps views

### Template Editor
- **Full Customization**: Edit block name, weeks, and workout days
- **Add/Remove Days**: Configure which days you train
- **Exercise Templates**: Set up default exercises with sets, reps, technique, and rest times
- **Multiple Workout Types**: Support for strength, cardio, Tabata, and more

### Quick Actions
- **Copy Last Session**: One-click to copy previous workout data
- **Add/Remove Sets**: Easily adjust sets during workout
- **Add/Remove Exercises**: Modify workouts on the fly

### Data Management
- **Local Storage**: All data saved in browser (no account needed)
- **Export/Import**: Backup and restore your data as JSON
- **Offline Support**: Works without internet connection

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
5. Enter your weight and reps for each set
6. Click **Rest** button to start rest timer between sets
7. Click **Save Workout** when done

### Viewing Progress

1. Go to **Progress** tab
2. See workout stats and PR dashboard
3. Search for any exercise to see:
   - Progression charts (weight/volume/reps)
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

# 🏋️ Workout Tracker

A comprehensive periodized workout tracking application built with React. Track your strength training progress, monitor HRV (Heart Rate Variability), visualize body weight trends, and maintain detailed exercise history.

## ✨ Features

- **📅 Calendar View**: Weekly workout planning with customizable training blocks
- **📊 Progress Tracking**: Visualize your workout progression over time
- **💪 Exercise History**: Search and view detailed history for any exercise
- **📈 HRV Monitoring**: Track overnight HRV to monitor recovery
- **⚖️ Body Weight Tracking**: Monitor weight changes throughout training blocks
- **💾 Data Backup/Restore**: Export and import your workout data
- **🎯 Multiple Exercise Types**:
  - Strength training (weight × reps)
  - Cardio (distance/time)
  - Tabata intervals
  - Treadmill workouts
  - Reps + Time tracking

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/workout-tracker-app.git
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
   - The app should now be running!

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## 📖 How to Use

### Creating a Workout Log

1. Navigate to the **Calendar** tab
2. Select the current week using the week navigation
3. Click on a day to open the workout log
4. Fill in:
   - Workout date
   - Optional: Overnight HRV reading
   - Exercise sets, reps, and weights
5. Click **Save Workout**

### Viewing Progress

1. Navigate to the **Progress** tab
2. View:
   - Total workouts completed
   - Body weight trends (if tracked)
   - HRV trends over time
   - Exercise search and history

### Searching Exercise History

1. Go to **Progress** → **Search Exercises**
2. Type an exercise name
3. Click on an exercise to see:
   - Volume progression chart
   - Max weight progression
   - Detailed session history

### Backing Up Your Data

1. Click **Backup/Restore** button
2. Click **Export Data** to download a JSON backup
3. Save this file safely
4. To restore: Click **Import Data** and select your backup file

## 💾 Data Storage

- All data is stored locally in your browser's localStorage
- Data persists between sessions
- Use the export feature to create backups
- No server or account required

## 🎨 Tech Stack

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **localStorage**: Client-side data persistence

## 📂 Project Structure

```
workout-tracker-app/
├── public/              # Static files
├── src/
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # Application entry point
│   └── index.css       # Global styles
├── index.html          # HTML template
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
├── tailwind.config.js  # Tailwind configuration
└── README.md           # This file
```

## 📝 License

MIT License - feel free to use this project for your own workout tracking!

## 🙏 Acknowledgments

- Built to support periodized training methodologies
- Inspired by the need for detailed workout tracking and progression analysis
- Icons provided by Lucide


---

**Happy lifting! 💪**

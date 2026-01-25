import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, TrendingUp, Calendar, Dumbbell, Save, X, History, Clock, Play, Pause, RotateCcw, Settings, Trash2, Edit3, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const WorkoutTracker = () => {
  const [view, setView] = useState('calendar');
  const [currentBlock] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedExerciseHistory, setSelectedExerciseHistory] = useState(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  
  const [logDate, setLogDate] = useState('');
  const [logHrv, setLogHrv] = useState('');
  const [exercises, setExercises] = useState([]);
  
  const [blocks, setBlocks] = useState([
    {
      id: 1,
      name: 'Block A - Hypertrophy Focus',
      weeks: 4,
      template: {
        monday: {
          name: 'Upper Body (Push Focus)',
          exercises: [
            { name: 'Incline Bench Press', sets: 3, reps: '6-10', technique: 'Failure, 1 sec pause', rest: '2-3 min' },
            { name: 'Seated DB Shoulder Press', sets: 2, reps: '8-12', technique: 'Failure', rest: '2-3 min' }
          ]
        },
        tuesday: {
          name: 'Conditioning (HIIT)',
          exercises: [
            { name: 'Bike Tabata', sets: 3, reps: '8 rounds', technique: '20s sprint/10s rest', rest: 'N/A' }
          ]
        },
        wednesday: {
          name: 'Lower Body',
          exercises: [
            { name: 'Belt Squat', sets: 3, reps: '8-12', technique: 'Failure', rest: '2-3 min' }
          ]
        },
        thursday: {
          name: 'Conditioning (Methodical)',
          exercises: [
            { name: 'Bike Tabata', sets: 3, reps: '8 rounds', technique: '20s sprint/10s rest', rest: 'N/A' }
          ]
        },
        friday: {
          name: 'Upper Body (Pull Focus)',
          exercises: [
            { name: 'Pull-Up', sets: 3, reps: '6-10', technique: 'Failure, 2s eccentric', rest: '2-3 min' }
          ]
        }
      }
    }
  ]);

  const [workoutLogs, setWorkoutLogs] = useState({});
  const [weeklyMetrics, setWeeklyMetrics] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [showExportImport, setShowExportImport] = useState(false);

  // Rest Timer State
  const [restTimer, setRestTimer] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [preferences, setPreferences] = useState({
    defaultRestSeconds: 120,
    restTimerSound: true,
    exerciseRestTimes: {}
  });

  // Personal Records State
  const [personalRecords, setPersonalRecords] = useState({});
  const [newPRs, setNewPRs] = useState([]);
  const [showPRModal, setShowPRModal] = useState(false);

  // Charts State
  const [chartType, setChartType] = useState('weight');

  // Migrate PRs from historical workout data
  const migrateHistoricalPRs = (logs) => {
    const migratedPRs = {};

    Object.entries(logs).forEach(([logKey, log]) => {
      if (!log.exercises || !log.date) return;

      log.exercises.forEach(exercise => {
        if (!exercise.name || !exercise.sets) return;

        const exerciseName = exercise.name;
        if (!migratedPRs[exerciseName]) {
          migratedPRs[exerciseName] = {};
        }

        exercise.sets.forEach(set => {
          const weight = parseFloat(set.weight);
          const reps = parseFloat(set.reps);

          if (!weight || !reps) return;

          const volume = weight * reps;
          const estimated1RM = Math.round(weight * (1 + reps / 30));

          // Update max weight
          if (!migratedPRs[exerciseName].maxWeight || weight > migratedPRs[exerciseName].maxWeight.value) {
            migratedPRs[exerciseName].maxWeight = { value: weight, date: log.date, logKey, reps };
          }

          // Update max volume
          if (!migratedPRs[exerciseName].maxVolume || volume > migratedPRs[exerciseName].maxVolume.value) {
            migratedPRs[exerciseName].maxVolume = { value: volume, date: log.date, logKey, weight, reps };
          }

          // Update max reps (overall, not per weight)
          if (!migratedPRs[exerciseName].maxReps || reps > migratedPRs[exerciseName].maxReps.value) {
            migratedPRs[exerciseName].maxReps = { value: reps, weight, date: log.date, logKey };
          }

          // Update estimated 1RM
          if (!migratedPRs[exerciseName].estimated1RM || estimated1RM > migratedPRs[exerciseName].estimated1RM.value) {
            migratedPRs[exerciseName].estimated1RM = { value: estimated1RM, date: log.date, logKey, weight, reps };
          }
        });
      });
    });

    return migratedPRs;
  };

  // Load data on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const logs = localStorage.getItem('workout-logs');
        const metrics = localStorage.getItem('weekly-metrics');
        const savedBlocks = localStorage.getItem('workout-blocks');
        const savedPrefs = localStorage.getItem('workout-preferences');
        const savedPRs = localStorage.getItem('personal-records');

        const parsedLogs = logs ? JSON.parse(logs) : {};
        const parsedMetrics = metrics ? JSON.parse(metrics) : {};

        setWorkoutLogs(parsedLogs);
        setWeeklyMetrics(parsedMetrics);
        if (savedBlocks) setBlocks(JSON.parse(savedBlocks));
        if (savedPrefs) setPreferences(JSON.parse(savedPrefs));

        // Always recalculate PRs from historical data to ensure all exercises have PRs
        if (Object.keys(parsedLogs).length > 0) {
          const migratedPRs = migrateHistoricalPRs(parsedLogs);
          setPersonalRecords(migratedPRs);
        } else if (savedPRs) {
          setPersonalRecords(JSON.parse(savedPRs));
        }
      } catch (error) {
        console.log('Error loading data:', error);
        setStorageError('Error loading saved data');
      }
      setDataLoaded(true);
    };

    loadData();
  }, []);

  // Save data
  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('workout-logs', JSON.stringify(workoutLogs));
      } catch (error) {
        console.error('Error saving:', error);
      }
    }
  }, [workoutLogs, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('weekly-metrics', JSON.stringify(weeklyMetrics));
      } catch (error) {
        console.error('Error saving:', error);
      }
    }
  }, [weeklyMetrics, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('workout-blocks', JSON.stringify(blocks));
      } catch (error) {
        console.error('Error saving:', error);
      }
    }
  }, [blocks, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('workout-preferences', JSON.stringify(preferences));
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    }
  }, [preferences, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('personal-records', JSON.stringify(personalRecords));
      } catch (error) {
        console.error('Error saving personal records:', error);
      }
    }
  }, [personalRecords, dataLoaded]);

  // Rest Timer Logic
  React.useEffect(() => {
    let interval;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            // Play notification sound and show browser notification
            if (preferences.restTimerSound) {
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
                audio.play().catch(() => {});
              } catch (e) {
                console.log('Audio playback failed:', e);
              }
            }
            // Request notification permission and show notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Rest Timer Complete!', {
                body: 'Time to start your next set',
                icon: '💪',
                tag: 'rest-timer'
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds, preferences.restTimerSound]);

  const startRestTimer = (exerciseName) => {
    const restTime = preferences.exerciseRestTimes[exerciseName] || preferences.defaultRestSeconds;
    setTimerSeconds(restTime);
    setTimerActive(true);
    setRestTimer({ exerciseName, totalSeconds: restTime });

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const pauseRestTimer = () => {
    setTimerActive(false);
  };

  const resumeRestTimer = () => {
    if (timerSeconds > 0) {
      setTimerActive(true);
    }
  };

  const resetRestTimer = () => {
    if (restTimer) {
      setTimerSeconds(restTimer.totalSeconds);
      setTimerActive(true);
    }
  };

  const stopRestTimer = () => {
    setTimerActive(false);
    setTimerSeconds(0);
    setRestTimer(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Personal Records Functions
  const calculateEstimated1RM = (weight, reps) => {
    if (!weight || !reps || reps < 1) return 0;
    // Epley formula: 1RM = weight × (1 + reps/30)
    return Math.round(parseFloat(weight) * (1 + parseFloat(reps) / 30));
  };

  const checkForPRs = (exerciseName, sets, logDate) => {
    const prsDetected = [];
    const currentPRs = personalRecords[exerciseName] || {};

    sets.forEach(set => {
      const weight = parseFloat(set.weight);
      const reps = parseFloat(set.reps);

      if (!weight || !reps) return;

      const volume = weight * reps;
      const estimated1RM = calculateEstimated1RM(weight, reps);

      // Check max weight PR
      if (!currentPRs.maxWeight || weight > currentPRs.maxWeight.value) {
        prsDetected.push({
          type: 'maxWeight',
          exerciseName,
          value: weight,
          reps,
          previous: currentPRs.maxWeight?.value || 0,
          date: logDate
        });
      }

      // Check max volume (single set) PR
      if (!currentPRs.maxVolume || volume > currentPRs.maxVolume.value) {
        prsDetected.push({
          type: 'maxVolume',
          exerciseName,
          value: volume,
          weight,
          reps,
          previous: currentPRs.maxVolume?.value || 0,
          date: logDate
        });
      }

      // Check max reps at specific weight
      const maxRepsKey = `maxRepsAt${Math.floor(weight)}`;
      if (!currentPRs[maxRepsKey] || reps > currentPRs[maxRepsKey].reps) {
        prsDetected.push({
          type: 'maxReps',
          exerciseName,
          value: reps,
          weight,
          previous: currentPRs[maxRepsKey]?.reps || 0,
          date: logDate
        });
      }

      // Check estimated 1RM
      if (!currentPRs.estimated1RM || estimated1RM > currentPRs.estimated1RM.value) {
        prsDetected.push({
          type: 'estimated1RM',
          exerciseName,
          value: estimated1RM,
          weight,
          reps,
          previous: currentPRs.estimated1RM?.value || 0,
          date: logDate
        });
      }
    });

    return prsDetected;
  };

  const updatePRs = (exerciseName, sets, logDate, logKey) => {
    const currentPRs = personalRecords[exerciseName] || {};
    const updatedPRs = { ...currentPRs };

    sets.forEach(set => {
      const weight = parseFloat(set.weight);
      const reps = parseFloat(set.reps);

      if (!weight || !reps) return;

      const volume = weight * reps;
      const estimated1RM = calculateEstimated1RM(weight, reps);

      // Update max weight
      if (!updatedPRs.maxWeight || weight > updatedPRs.maxWeight.value) {
        updatedPRs.maxWeight = { value: weight, date: logDate, logKey, reps };
      }

      // Update max volume
      if (!updatedPRs.maxVolume || volume > updatedPRs.maxVolume.value) {
        updatedPRs.maxVolume = { value: volume, date: logDate, logKey, weight, reps };
      }

      // Update max reps at weight
      const maxRepsKey = `maxRepsAt${Math.floor(weight)}`;
      if (!updatedPRs[maxRepsKey] || reps > updatedPRs[maxRepsKey].reps) {
        updatedPRs[maxRepsKey] = { reps, weight, date: logDate, logKey };
      }

      // Update estimated 1RM
      if (!updatedPRs.estimated1RM || estimated1RM > updatedPRs.estimated1RM.value) {
        updatedPRs.estimated1RM = { value: estimated1RM, date: logDate, logKey, weight, reps };
      }
    });

    setPersonalRecords({
      ...personalRecords,
      [exerciseName]: updatedPRs
    });
  };

  // Chart Data Formatting
  const getExerciseProgressionData = (exerciseName, type = 'weight') => {
    const history = getAllExerciseHistory(exerciseName);

    return history
      .reverse() // Chronological order for charts
      .map(entry => {
        let value = 0;

        if (type === 'weight') {
          // Max weight in the session
          value = Math.max(...entry.sets.map(s => parseFloat(s.weight) || 0));
        } else if (type === 'volume') {
          // Total volume for the session
          value = calculateVolume(entry.sets);
        } else if (type === 'reps') {
          // Max reps in the session
          value = Math.max(...entry.sets.map(s => parseFloat(s.reps) || 0));
        }

        return {
          date: formatDate(entry.date),
          value: value,
          fullDate: entry.date
        };
      })
      .filter(d => d.value > 0);
  };

  const exportData = () => {
    const data = {
      workoutLogs,
      weeklyMetrics,
      blocks,
      exportDate: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      navigator.clipboard.writeText(jsonString).then(() => {
        alert('Data copied to clipboard!');
      }).catch(() => {
        prompt('Copy this data:', jsonString);
      });
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.workoutLogs) setWorkoutLogs(data.workoutLogs);
        if (data.weeklyMetrics) setWeeklyMetrics(data.weeklyMetrics);
        if (data.blocks) setBlocks(data.blocks);
        alert('Data imported successfully!');
        setShowExportImport(false);
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const getCurrentTemplate = () => {
    return blocks[currentBlock - 1]?.template || {};
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getAllExerciseHistory = (exerciseName) => {
    const history = [];
    Object.entries(workoutLogs).forEach(([key, log]) => {
      if (log.date && log.exercises) {
        log.exercises.forEach(ex => {
          if (ex.name === exerciseName) {
            history.push({
              date: log.date,
              sets: ex.sets,
              notes: ex.notes,
              type: ex.type || 'strength',
              rounds: ex.rounds,
              logKey: key
            });
          }
        });
      }
    });
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const calculateVolume = (sets) => {
    if (!sets || !Array.isArray(sets)) return 0;
    return sets.reduce((total, set) => {
      const weight = parseFloat(set.weight) || 0;
      const reps = parseFloat(set.reps) || 0;
      return total + (weight * reps);
    }, 0);
  };

  const getPreviousSession = (exerciseName) => {
    const history = getAllExerciseHistory(exerciseName);
    // Get the most recent session (first item in sorted array)
    return history.length > 0 ? history[0] : null;
  };

  const compareSetToPrevious = (currentSet, previousSets, setIndex) => {
    if (!previousSets || !previousSets[setIndex]) return null;
    const prevSet = previousSets[setIndex];
    const currWeight = parseFloat(currentSet.weight) || 0;
    const currReps = parseFloat(currentSet.reps) || 0;
    const prevWeight = parseFloat(prevSet.weight) || 0;
    const prevReps = parseFloat(prevSet.reps) || 0;

    if (!currWeight || !currReps) return null;

    const currVolume = currWeight * currReps;
    const prevVolume = prevWeight * prevReps;

    if (currVolume > prevVolume) return 'improved';
    if (currVolume === prevVolume && currWeight === prevWeight && currReps === prevReps) return 'matched';
    if (currWeight > prevWeight || currReps > prevReps) return 'improved';
    return 'decreased';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Workout Tracker</h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-400">Periodized training with progression tracking</p>
          <button
            onClick={() => setShowExportImport(!showExportImport)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm"
          >
            Backup/Restore
          </button>
        </div>
        {storageError && (
          <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 text-xs">
            {storageError}
          </div>
        )}
        {showExportImport && (
          <div className="mt-3 p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-3">
            <button
              onClick={exportData}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Export Data (Download Backup)
            </button>
            <div>
              <label className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
                Import Data (Restore Backup)
              </label>
            </div>
            <p className="text-xs text-gray-400">
              Export downloads your data. Import replaces current data with backup file.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-3 font-medium transition-colors ${
            view === 'calendar'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Calendar
        </button>
        <button
          onClick={() => setView('progress')}
          className={`px-4 py-3 font-medium transition-colors ${
            view === 'progress'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Progress
        </button>
        <button
          onClick={() => setView('template')}
          className={`px-4 py-3 font-medium transition-colors ${
            view === 'template'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Edit Template
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        {/* Progress View - showing condensed version */}
        {view === 'progress' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-100">Progress Tracker</h2>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Workouts Completed</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    {Object.keys(workoutLogs).filter(k => k.startsWith(`block${currentBlock}`)).length}
                  </p>
                </div>
                <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Current Week</p>
                  <p className="text-3xl font-bold text-blue-400">{currentWeek}</p>
                </div>
                {(() => {
                  const hrvValues = Object.values(workoutLogs)
                    .filter(log => log.hrv && parseFloat(log.hrv) > 0)
                    .map(log => parseFloat(log.hrv))
                    .slice(-7);
                  const avgHrv = hrvValues.length > 0
                    ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
                    : null;
                  const latestHrv = hrvValues.length > 0 ? hrvValues[hrvValues.length - 1] : null;

                  return (
                    <>
                      <div className="p-4 bg-cyan-950/30 border border-cyan-900/50 rounded-lg">
                        <p className="text-sm text-gray-400">Latest HRV</p>
                        <p className="text-3xl font-bold text-cyan-400">
                          {latestHrv ? `${latestHrv}` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">ms</p>
                      </div>
                      <div className="p-4 bg-purple-950/30 border border-purple-900/50 rounded-lg">
                        <p className="text-sm text-gray-400">Avg HRV (7d)</p>
                        <p className="text-3xl font-bold text-purple-400">
                          {avgHrv ? `${avgHrv}` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">ms</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* HRV History */}
            {(() => {
              const hrvHistory = Object.entries(workoutLogs)
                .filter(([, log]) => log.hrv && parseFloat(log.hrv) > 0 && log.date)
                .map(([key, log]) => ({
                  date: log.date,
                  hrv: parseFloat(log.hrv),
                  logKey: key
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(-14);

              if (hrvHistory.length < 2) return null;

              return (
                <div className="bg-gray-800 p-4 rounded-lg border border-cyan-600/30">
                  <h3 className="font-semibold text-cyan-400 mb-4">HRV Trend (Last 14 sessions)</h3>
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={hrvHistory.map(h => ({ date: formatDate(h.date), value: h.hrv }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                          formatter={(value) => [`${value} ms`, 'HRV']}
                        />
                        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ fill: '#22d3ee', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Weekly Body Weight Tracking */}
            {(() => {
              // Get weekly body weight data from weeklyMetrics
              const weightHistory = Object.entries(weeklyMetrics)
                .filter(([, data]) => data.bodyWeight && parseFloat(data.bodyWeight) > 0)
                .map(([key, data]) => {
                  // Parse week info from key (e.g., "block1-week1")
                  const match = key.match(/block(\d+)-week(\d+)/);
                  const weekNum = match ? parseInt(match[2]) : 0;
                  return {
                    weekKey: key,
                    week: weekNum,
                    weight: parseFloat(data.bodyWeight),
                    date: data.lastUpdated || `Week ${weekNum}`
                  };
                })
                .sort((a, b) => a.week - b.week);

              const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
              const previousWeight = weightHistory.length > 1 ? weightHistory[weightHistory.length - 2].weight : null;
              const weightChange = latestWeight && previousWeight ? (latestWeight - previousWeight).toFixed(1) : null;
              const recentHistory = weightHistory.slice(-14);

              return (
                <>
                  {/* Body Weight Stats */}
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h3 className="font-semibold text-gray-100 mb-4">Weekly Body Weight</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-orange-950/30 border border-orange-900/50 rounded-lg">
                        <p className="text-sm text-gray-400">Current Weight</p>
                        <p className="text-3xl font-bold text-orange-400">
                          {latestWeight ? `${latestWeight}` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">lb</p>
                      </div>
                      <div className="p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
                        <p className="text-sm text-gray-400">Weekly Change</p>
                        <p className={`text-3xl font-bold ${
                          weightChange && parseFloat(weightChange) > 0
                            ? 'text-red-400'
                            : weightChange && parseFloat(weightChange) < 0
                              ? 'text-emerald-400'
                              : 'text-gray-400'
                        }`}>
                          {weightChange ? `${parseFloat(weightChange) > 0 ? '+' : ''}${weightChange}` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">lb vs last week</p>
                      </div>
                    </div>
                  </div>

                  {/* Body Weight Trend Chart */}
                  {recentHistory.length >= 2 && (
                    <div className="bg-gray-800 p-4 rounded-lg border border-orange-600/30">
                      <h3 className="font-semibold text-orange-400 mb-4">Body Weight Trend (By Week)</h3>
                      <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={recentHistory.map(h => ({ date: `Wk ${h.week}`, value: h.weight }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                              formatter={(value) => [`${value} lb`, 'Weight']}
                            />
                            <Line type="monotone" dataKey="value" stroke="#fb923c" strokeWidth={2} dot={{ fill: '#fb923c', r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <History className="w-5 h-5" />
                Search Exercises
              </h3>
              {Object.keys(workoutLogs).length === 0 ? (
                <p className="text-gray-400 text-sm">No workouts logged yet</p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Type to search exercises..."
                    value={exerciseSearchTerm}
                    onChange={(e) => setExerciseSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 mb-3 placeholder-gray-500"
                  />
                  {exerciseSearchTerm && (() => {
                    const allExercises = new Set();
                    Object.values(workoutLogs).forEach(log => {
                      if (log.exercises) {
                        log.exercises.forEach(ex => {
                          if (ex.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase())) {
                            allExercises.add(ex.name);
                          }
                        });
                      }
                    });

                    return allExercises.size > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {Array.from(allExercises).map(exerciseName => (
                          <button
                            key={exerciseName}
                            onClick={() => setSelectedExerciseHistory(exerciseName)}
                            className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors"
                          >
                            <p className="font-medium text-gray-100">{exerciseName}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {getAllExerciseHistory(exerciseName).length} session(s)
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">No exercises found matching "{exerciseSearchTerm}"</p>
                    );
                  })()}
                </>
              )}
            </div>

            {selectedExerciseHistory && (
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-100">
                    {selectedExerciseHistory} History
                  </h3>
                  <button
                    onClick={() => setSelectedExerciseHistory(null)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Chart Type Selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setChartType('weight')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      chartType === 'weight'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Weight
                  </button>
                  <button
                    onClick={() => setChartType('volume')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      chartType === 'volume'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    onClick={() => setChartType('reps')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      chartType === 'reps'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Reps
                  </button>
                </div>

                {/* Personal Records for this Exercise */}
                {personalRecords[selectedExerciseHistory] && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 rounded-lg border border-yellow-600/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h4 className="font-semibold text-yellow-300">Personal Records</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {personalRecords[selectedExerciseHistory].maxWeight && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Max Weight</div>
                          <div className="text-lg font-bold text-yellow-400">
                            {personalRecords[selectedExerciseHistory].maxWeight.value} lb
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].maxWeight.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].maxVolume && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Max Volume</div>
                          <div className="text-lg font-bold text-emerald-400">
                            {personalRecords[selectedExerciseHistory].maxVolume.value.toLocaleString()} lb
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].maxVolume.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].maxReps && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Max Reps</div>
                          <div className="text-lg font-bold text-blue-400">
                            {personalRecords[selectedExerciseHistory].maxReps.value} reps
                          </div>
                          <div className="text-xs text-gray-500">
                            @ {personalRecords[selectedExerciseHistory].maxReps.weight} lb
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].estimated1RM && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Est. 1RM</div>
                          <div className="text-lg font-bold text-purple-400">
                            {personalRecords[selectedExerciseHistory].estimated1RM.value} lb
                          </div>
                          <div className="text-xs text-gray-500">Epley formula</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Chart */}
                {(() => {
                  const chartData = getExerciseProgressionData(selectedExerciseHistory, chartType);

                  if (chartData.length < 2) {
                    return (
                      <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 mb-4 text-center text-gray-400 text-sm">
                        Need at least 2 sessions to show progression chart
                      </div>
                    );
                  }

                  return (
                    <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '0.5rem',
                              color: '#f3f4f6'
                            }}
                            formatter={(value) => {
                              if (chartType === 'volume') {
                                return [`${value.toLocaleString()} lb`, 'Volume'];
                              } else if (chartType === 'weight') {
                                return [`${value} lb`, 'Max Weight'];
                              } else {
                                return [`${value}`, 'Max Reps'];
                              }
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {getAllExerciseHistory(selectedExerciseHistory).map((entry, idx) => (
                    <div key={idx} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-100">
                          {formatDate(entry.date)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {entry.sets && entry.sets.map((set, setIdx) => (
                          <div key={setIdx} className="text-sm text-gray-300">
                            Set {setIdx + 1}: {set.weight ? `${set.weight} lb × ${set.reps} reps` : 'Not logged'}
                          </div>
                        ))}
                      </div>
                      {entry.notes && (
                        <p className="mt-2 text-xs text-gray-400 italic">
                          Note: {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template Editor View */}
        {view === 'template' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-100">Edit Workout Template</h2>
            <p className="text-gray-400">Customize your training block, days, and exercises</p>

            {/* Block Settings */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Block Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Block Name</label>
                  <input
                    type="text"
                    value={blocks[currentBlock - 1]?.name || ''}
                    onChange={(e) => {
                      const newBlocks = [...blocks];
                      newBlocks[currentBlock - 1].name = e.target.value;
                      setBlocks(newBlocks);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    placeholder="e.g., Block A - Hypertrophy Focus"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Number of Weeks</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={blocks[currentBlock - 1]?.weeks || 4}
                    onChange={(e) => {
                      const newBlocks = [...blocks];
                      newBlocks[currentBlock - 1].weeks = parseInt(e.target.value) || 4;
                      setBlocks(newBlocks);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Day Templates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-100">Workout Days</h3>
                <button
                  onClick={() => {
                    const newBlocks = [...blocks];
                    const template = newBlocks[currentBlock - 1].template;
                    const existingDays = Object.keys(template);
                    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    const availableDays = allDays.filter(d => !existingDays.includes(d));

                    if (availableDays.length > 0) {
                      template[availableDays[0]] = {
                        name: 'New Workout',
                        exercises: []
                      };
                      setBlocks(newBlocks);
                    }
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Day
                </button>
              </div>

              {Object.entries(blocks[currentBlock - 1]?.template || {}).map(([dayKey, dayData]) => (
                <div key={dayKey} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <select
                        value={dayKey}
                        onChange={(e) => {
                          const newBlocks = [...blocks];
                          const template = newBlocks[currentBlock - 1].template;
                          const newDayKey = e.target.value;
                          if (newDayKey !== dayKey && !template[newDayKey]) {
                            template[newDayKey] = template[dayKey];
                            delete template[dayKey];
                            setBlocks(newBlocks);
                          }
                        }}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 font-medium"
                      >
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
                          <option key={d} value={d} disabled={d !== dayKey && blocks[currentBlock - 1]?.template[d]}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={dayData.name}
                        onChange={(e) => {
                          const newBlocks = [...blocks];
                          newBlocks[currentBlock - 1].template[dayKey].name = e.target.value;
                          setBlocks(newBlocks);
                        }}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                        placeholder="Workout name (e.g., Upper Body Push)"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)} from template?`)) {
                          const newBlocks = [...blocks];
                          delete newBlocks[currentBlock - 1].template[dayKey];
                          setBlocks(newBlocks);
                        }
                      }}
                      className="ml-3 p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Exercises for this day */}
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400 font-medium">Exercises:</p>
                    {dayData.exercises.map((exercise, exIdx) => (
                      <div key={exIdx} className="p-3 bg-gray-900/50 rounded-lg border border-gray-600">
                        <div className="flex items-start gap-2 mb-2">
                          <input
                            type="text"
                            value={exercise.name}
                            onChange={(e) => {
                              const newBlocks = [...blocks];
                              newBlocks[currentBlock - 1].template[dayKey].exercises[exIdx].name = e.target.value;
                              setBlocks(newBlocks);
                            }}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                            placeholder="Exercise name"
                          />
                          <button
                            onClick={() => {
                              const newBlocks = [...blocks];
                              newBlocks[currentBlock - 1].template[dayKey].exercises = dayData.exercises.filter((_, i) => i !== exIdx);
                              setBlocks(newBlocks);
                            }}
                            className="p-2 hover:bg-red-600/20 text-red-400 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Sets</label>
                            <input
                              type="text"
                              value={exercise.sets}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[currentBlock - 1].template[dayKey].exercises[exIdx].sets = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                              placeholder="3"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Reps</label>
                            <input
                              type="text"
                              value={exercise.reps}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[currentBlock - 1].template[dayKey].exercises[exIdx].reps = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                              placeholder="8-12"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Technique</label>
                            <input
                              type="text"
                              value={exercise.technique || ''}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[currentBlock - 1].template[dayKey].exercises[exIdx].technique = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                              placeholder="Failure"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Rest</label>
                            <input
                              type="text"
                              value={exercise.rest || ''}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[currentBlock - 1].template[dayKey].exercises[exIdx].rest = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                              placeholder="2-3 min"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const newBlocks = [...blocks];
                        newBlocks[currentBlock - 1].template[dayKey].exercises.push({
                          name: '',
                          sets: '3',
                          reps: '8-12',
                          technique: '',
                          rest: '2-3 min'
                        });
                        setBlocks(newBlocks);
                      }}
                      className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Exercise
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Reset Template */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => {
                  if (window.confirm('Reset template to default? This will clear all your custom workout days and exercises.')) {
                    const newBlocks = [...blocks];
                    newBlocks[currentBlock - 1] = {
                      id: 1,
                      name: 'Block A - Hypertrophy Focus',
                      weeks: 4,
                      template: {
                        monday: { name: 'Upper Body (Push Focus)', exercises: [] },
                        wednesday: { name: 'Lower Body', exercises: [] },
                        friday: { name: 'Upper Body (Pull Focus)', exercises: [] }
                      }
                    };
                    setBlocks(newBlocks);
                  }
                }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"
              >
                Reset to Default Template
              </button>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-100">Week {currentWeek}</h2>
                <p className="text-gray-400">{blocks[currentBlock - 1]?.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 disabled:opacity-50"
                  disabled={currentWeek === 1}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 bg-gray-700 rounded-lg text-gray-300 font-medium">
                  Week {currentWeek}
                </span>
                <button
                  onClick={() => setCurrentWeek(currentWeek + 1)}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-300"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Week {currentWeek} Metrics</h3>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Body Weight (lbs)</label>
                <input
                  type="text"
                  value={weeklyMetrics[`block${currentBlock}-week${currentWeek}`]?.bodyWeight || ''}
                  onChange={(e) => {
                    const weekKey = `block${currentBlock}-week${currentWeek}`;
                    setWeeklyMetrics({
                      ...weeklyMetrics,
                      [weekKey]: {
                        ...weeklyMetrics[weekKey],
                        bodyWeight: e.target.value,
                        lastUpdated: new Date().toISOString().split('T')[0]
                      }
                    });
                  }}
                  placeholder="e.g., 185.5"
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 w-full"
                />
              </div>
            </div>

            <div className="grid gap-3">
              {days.map((day, idx) => {
                const template = getCurrentTemplate();
                const workout = template[day];
                const logKey = `block${currentBlock}-week${currentWeek}-${day}`;
                const log = workoutLogs[logKey];
                
                return (
                  <div
                    key={day}
                    onClick={() => {
                      setSelectedDay(day);
                      const existingLog = workoutLogs[logKey];

                      if (existingLog) {
                        setLogDate(existingLog.date);
                        setLogHrv(existingLog.hrv || '');
                        setExercises(existingLog.exercises);
                      } else {
                        setLogDate(new Date().toISOString().split('T')[0]);
                        setLogHrv('');
                        setExercises(workout?.exercises.map(ex => ({
                          name: ex.name,
                          technique: ex.technique,
                          sets: Array(parseInt(ex.sets) || 3).fill(null).map(() => ({
                            weight: '',
                            reps: ''
                          })),
                          notes: ''
                        })) || []);
                      }
                      setView('log');
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      log 
                        ? 'border-emerald-500 bg-emerald-950/30 hover:bg-emerald-950/50' 
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-750 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-100">{dayNames[idx]}</h3>
                          {log?.date && (
                            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                              {formatDate(log.date)}
                            </span>
                          )}
                          {log?.hrv && (
                            <span className="text-xs text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50">
                              HRV: {log.hrv}ms
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{workout?.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{workout?.exercises.length} exercises</p>
                      </div>
                      {log && (
                        <Dumbbell className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Log View - simplified for space */}
        {view === 'log' && selectedDay && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-100">
                  {getCurrentTemplate()[selectedDay]?.name}
                </h2>
                <p className="text-gray-400">
                  Week {currentWeek} - {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}
                </p>
              </div>
              <button
                onClick={() => setView('calendar')}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Session Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Workout Date</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Overnight HRV (ms)</label>
                  <input
                    type="text"
                    value={logHrv}
                    onChange={(e) => setLogHrv(e.target.value)}
                    placeholder="e.g., 65"
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {exercises.map((exercise, exIdx) => {
                const previousSession = getPreviousSession(exercise.name);
                const currentVolume = calculateVolume(exercise.sets);
                const previousVolume = previousSession ? calculateVolume(previousSession.sets) : 0;
                const volumeChange = previousVolume > 0
                  ? ((currentVolume - previousVolume) / previousVolume * 100).toFixed(1)
                  : null;

                return (
                  <div key={exIdx} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={exercise.name}
                        onChange={(e) => {
                          const newExercises = [...exercises];
                          newExercises[exIdx].name = e.target.value;
                          setExercises(newExercises);
                        }}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg font-semibold text-gray-100"
                      />
                      <button
                        onClick={() => {
                          if (previousSession && previousSession.sets) {
                            const newExercises = [...exercises];
                            newExercises[exIdx].sets = previousSession.sets.map(s => ({
                              weight: s.weight || '',
                              reps: s.reps || ''
                            }));
                            setExercises(newExercises);
                          }
                        }}
                        disabled={!previousSession}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                        title="Copy last session"
                      >
                        Copy Last
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${exercise.name}?`)) {
                            const newExercises = exercises.filter((_, idx) => idx !== exIdx);
                            setExercises(newExercises);
                          }
                        }}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                        title="Remove exercise"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Previous Session Banner */}
                    {previousSession && (
                      <div className="mb-3 p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-400">Last Session ({formatDate(previousSession.date)})</span>
                          <span className="text-xs text-gray-400">
                            {previousSession.sets?.map(s => s.reps).filter(r => r).join(', ') || 'No data'} reps
                          </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {previousSession.sets?.map((prevSet, idx) => (
                            <span key={idx} className="text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded">
                              {prevSet.weight || '?'}lb × {prevSet.reps || '?'}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          Volume: {previousVolume.toLocaleString()} lb
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {exercise.sets.map((set, setIdx) => {
                        const comparison = compareSetToPrevious(set, previousSession?.sets, setIdx);

                        return (
                          <div key={setIdx} className="flex gap-2 items-center flex-wrap">
                            <span className="text-sm font-medium text-gray-400 w-12">Set {setIdx + 1}</span>
                            <input
                              type="text"
                              placeholder="Weight"
                              value={set.weight}
                              onChange={(e) => {
                                const newExercises = [...exercises];
                                newExercises[exIdx].sets[setIdx].weight = e.target.value;
                                setExercises(newExercises);
                              }}
                              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-24 text-gray-100"
                            />
                            <span className="text-gray-400">lb ×</span>
                            <input
                              type="text"
                              placeholder="Reps"
                              value={set.reps}
                              onChange={(e) => {
                                const newExercises = [...exercises];
                                newExercises[exIdx].sets[setIdx].reps = e.target.value;
                                setExercises(newExercises);
                              }}
                              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-20 text-gray-100"
                            />
                            {comparison === 'improved' && (
                              <span className="text-emerald-400 text-sm" title="Improvement!">↑</span>
                            )}
                            {comparison === 'matched' && (
                              <span className="text-blue-400 text-sm" title="Matched previous">✓</span>
                            )}
                            <button
                              onClick={() => startRestTimer(exercise.name)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1 transition-colors"
                              title="Start rest timer"
                            >
                              <Clock className="w-3 h-3" />
                              Rest
                            </button>
                            {exercise.sets.length > 1 && (
                              <button
                                onClick={() => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                  setExercises(newExercises);
                                }}
                                className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                                title="Remove set"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          const lastSet = exercise.sets[exercise.sets.length - 1];
                          newExercises[exIdx].sets.push({
                            weight: lastSet?.weight || '',
                            reps: lastSet?.reps || ''
                          });
                          setExercises(newExercises);
                        }}
                        className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Set
                      </button>
                    </div>

                    {/* Current Volume Display */}
                    {currentVolume > 0 && (
                      <div className="mt-3 p-2 bg-gray-750 rounded border border-gray-600">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Current Volume:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200 font-medium">
                              {currentVolume.toLocaleString()} lb
                            </span>
                            {volumeChange !== null && (
                              <span className={`text-xs font-medium ${
                                parseFloat(volumeChange) > 0
                                  ? 'text-emerald-400'
                                  : parseFloat(volumeChange) < 0
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                              }`}>
                                {parseFloat(volumeChange) > 0 ? '+' : ''}{volumeChange}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <textarea
                      placeholder="Notes"
                      value={exercise.notes || ''}
                      onChange={(e) => {
                        const newExercises = [...exercises];
                        newExercises[exIdx].notes = e.target.value;
                        setExercises(newExercises);
                      }}
                      className="w-full mt-3 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100"
                      rows={2}
                    />
                  </div>
                );
              })}

              <button
                onClick={() => {
                  setExercises([...exercises, {
                    name: 'New Exercise',
                    technique: '',
                    sets: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }],
                    notes: ''
                  }]);
                }}
                className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Exercise
              </button>
            </div>

            <button
              onClick={() => {
                const logKey = `block${currentBlock}-week${currentWeek}-${selectedDay}`;
                const weekKey = `block${currentBlock}-week${currentWeek}`;

                // Check for PRs in all exercises
                const allPRs = [];
                exercises.forEach(exercise => {
                  const prs = checkForPRs(exercise.name, exercise.sets, logDate);
                  allPRs.push(...prs);

                  // Update PRs in state
                  updatePRs(exercise.name, exercise.sets, logDate, logKey);
                });

                // Save workout log
                setWorkoutLogs({
                  ...workoutLogs,
                  [logKey]: {
                    date: logDate,
                    hrv: logHrv,
                    exercises: exercises,
                    prsHit: allPRs.length
                  }
                });

                // Show PR modal if any PRs were hit
                if (allPRs.length > 0) {
                  setNewPRs(allPRs);
                  setShowPRModal(true);
                } else {
                  setView('calendar');
                }
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Workout
            </button>
          </div>
        )}
      </div>

      {/* Rest Timer Modal */}
      {restTimer && timerActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-md w-full text-center">
            <h3 className="text-xl font-semibold text-gray-100 mb-2">
              {restTimer.exerciseName}
            </h3>
            <p className="text-sm text-gray-400 mb-6">Rest Period</p>

            <div className="mb-8">
              <div className="text-6xl font-bold text-emerald-400 mb-4">
                {formatTime(timerSeconds)}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timerSeconds / restTimer.totalSeconds) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center mb-4">
              <button
                onClick={pauseRestTimer}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
              <button
                onClick={resetRestTimer}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </button>
            </div>

            <button
              onClick={stopRestTimer}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Skip Rest
            </button>
          </div>
        </div>
      )}

      {/* Paused Timer Indicator */}
      {restTimer && !timerActive && timerSeconds > 0 && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-40">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-200">Timer Paused</p>
              <p className="text-xs text-gray-400">{formatTime(timerSeconds)} remaining</p>
            </div>
            <button
              onClick={resumeRestTimer}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 transition-colors"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
            <button
              onClick={stopRestTimer}
              className="p-2 hover:bg-gray-700 text-gray-400 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Personal Records Modal */}
      {showPRModal && newPRs.length > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 rounded-lg border-2 border-yellow-500 p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                New Personal Record{newPRs.length > 1 ? 's' : ''}!
              </h2>
              <p className="text-gray-300">
                You hit {newPRs.length} PR{newPRs.length > 1 ? 's' : ''} today!
              </p>
            </div>

            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {newPRs.map((pr, idx) => (
                <div key={idx} className="bg-gray-900/50 border border-yellow-600/30 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-400 mb-2">{pr.exerciseName}</h3>
                  <div className="text-sm text-gray-300">
                    {pr.type === 'maxWeight' && (
                      <>
                        <p className="font-medium">Heaviest Weight!</p>
                        <p className="text-gray-400">
                          {pr.value} lb × {pr.reps} reps
                          {pr.previous > 0 && ` (previous: ${pr.previous} lb)`}
                        </p>
                      </>
                    )}
                    {pr.type === 'maxVolume' && (
                      <>
                        <p className="font-medium">Highest Volume (Single Set)!</p>
                        <p className="text-gray-400">
                          {pr.value.toLocaleString()} lb ({pr.weight} lb × {pr.reps} reps)
                          {pr.previous > 0 && ` (previous: ${pr.previous.toLocaleString()} lb)`}
                        </p>
                      </>
                    )}
                    {pr.type === 'maxReps' && (
                      <>
                        <p className="font-medium">Most Reps at {Math.floor(pr.weight)} lb!</p>
                        <p className="text-gray-400">
                          {pr.value} reps
                          {pr.previous > 0 && ` (previous: ${pr.previous} reps)`}
                        </p>
                      </>
                    )}
                    {pr.type === 'estimated1RM' && (
                      <>
                        <p className="font-medium">New Estimated 1RM!</p>
                        <p className="text-gray-400">
                          {pr.value} lb (from {pr.weight} lb × {pr.reps} reps)
                          {pr.previous > 0 && ` (previous: ${pr.previous} lb)`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowPRModal(false);
                setNewPRs([]);
                setView('calendar');
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-lg transition-colors"
            >
              Awesome! Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;

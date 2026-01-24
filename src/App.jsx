import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, TrendingUp, Calendar, Dumbbell, Save, X, History } from 'lucide-react';

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

  // Load data on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const logs = localStorage.getItem('workout-logs');
        const metrics = localStorage.getItem('weekly-metrics');
        const savedBlocks = localStorage.getItem('workout-blocks');
        
        if (logs) setWorkoutLogs(JSON.parse(logs));
        if (metrics) setWeeklyMetrics(JSON.parse(metrics));
        if (savedBlocks) setBlocks(JSON.parse(savedBlocks));
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
      </div>

      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        {/* Progress View - showing condensed version */}
        {view === 'progress' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-100">Progress Tracker</h2>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </div>

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
                  {exerciseSearchTerm && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <p className="text-gray-400 text-sm">Exercise search results would appear here</p>
                    </div>
                  )}
                </>
              )}
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
                  value={weeklyMetrics[`block${currentBlock}-week${currentWeek}`]?.bodyweight || ''}
                  onChange={(e) => {
                    const weekKey = `block${currentBlock}-week${currentWeek}`;
                    setWeeklyMetrics({
                      ...weeklyMetrics,
                      [weekKey]: { bodyweight: e.target.value }
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
              <div className="grid grid-cols-2 gap-4">
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
              {exercises.map((exercise, exIdx) => (
                <div key={exIdx} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <div className="mb-3">
                    <input
                      type="text"
                      value={exercise.name}
                      onChange={(e) => {
                        const newExercises = [...exercises];
                        newExercises[exIdx].name = e.target.value;
                        setExercises(newExercises);
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg font-semibold text-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    {exercise.sets.map((set, setIdx) => (
                      <div key={setIdx} className="flex gap-2 items-center">
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
                      </div>
                    ))}
                  </div>

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
              ))}

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
                setWorkoutLogs({
                  ...workoutLogs,
                  [logKey]: {
                    date: logDate,
                    hrv: logHrv,
                    exercises: exercises
                  }
                });
                setView('calendar');
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Workout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutTracker;

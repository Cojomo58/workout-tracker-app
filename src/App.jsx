import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, TrendingUp, Calendar, Dumbbell, Save, X, History, Settings, Trash2, Edit3, Trophy, LogIn, LogOut, Cloud, CloudOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Fuse from 'fuse.js';
import { supabase } from './supabaseClient';

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
  const [prefilled, setPrefilled] = useState(false);
  
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


  // Personal Records State
  const [personalRecords, setPersonalRecords] = useState({});
  const [newPRs, setNewPRs] = useState([]);
  const [showPRModal, setShowPRModal] = useState(false);

  // Charts State
  const [chartType, setChartType] = useState('weight');

  // Autocomplete State
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Auth & Sync State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cloudData, setCloudData] = useState(null);
  const saveTimeoutRef = useRef(null);

  // Migrate PRs from historical workout data
  const migrateHistoricalPRs = (logs) => {
    const migratedPRs = {};

    // Helper for time parsing during migration
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':').map(p => parseInt(p) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parseInt(timeStr) || 0;
    };

    const formatTime = (seconds) => {
      if (!seconds || seconds <= 0) return '0:00';
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.round(seconds % 60);
      if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    Object.entries(logs).forEach(([logKey, log]) => {
      if (!log.exercises || !log.date) return;

      log.exercises.forEach(exercise => {
        if (!exercise.name || !exercise.sets) return;

        const exerciseName = exercise.name;
        const exerciseType = exercise.type || 'strength';

        if (!migratedPRs[exerciseName]) {
          migratedPRs[exerciseName] = {};
        }

        if (exerciseType === 'cardio') {
          // Cardio PR migration
          exercise.sets.forEach(set => {
            const distance = parseFloat(set.distance);
            const timeSeconds = parseTime(set.time);

            if (!distance || !timeSeconds) return;

            const paceSeconds = timeSeconds / distance;

            // Update max distance
            if (!migratedPRs[exerciseName].maxDistance || distance > migratedPRs[exerciseName].maxDistance.value) {
              migratedPRs[exerciseName].maxDistance = {
                value: distance,
                unit: set.unit || 'miles',
                time: set.time,
                date: log.date,
                logKey
              };
            }

            // Update fastest pace
            if (!migratedPRs[exerciseName].fastestPace || paceSeconds < migratedPRs[exerciseName].fastestPace.value) {
              migratedPRs[exerciseName].fastestPace = {
                value: paceSeconds,
                displayValue: formatTime(Math.round(paceSeconds)),
                distance,
                unit: set.unit || 'miles',
                time: set.time,
                date: log.date,
                logKey
              };
            }

            // Update longest duration
            if (!migratedPRs[exerciseName].longestDuration || timeSeconds > migratedPRs[exerciseName].longestDuration.value) {
              migratedPRs[exerciseName].longestDuration = {
                value: timeSeconds,
                displayValue: set.time,
                distance,
                unit: set.unit || 'miles',
                date: log.date,
                logKey
              };
            }
          });
        } else {
          // Strength PR migration
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
        }
      });
    });

    return migratedPRs;
  };

  // Auth listener
  React.useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load from localStorage helper
  const loadFromLocalStorage = () => {
    try {
      const logs = localStorage.getItem('workout-logs');
      const metrics = localStorage.getItem('weekly-metrics');
      const savedBlocks = localStorage.getItem('workout-blocks');
      const savedPRs = localStorage.getItem('personal-records');

      const parsedLogs = logs ? JSON.parse(logs) : {};
      const parsedMetrics = metrics ? JSON.parse(metrics) : {};

      setWorkoutLogs(parsedLogs);
      setWeeklyMetrics(parsedMetrics);
      if (savedBlocks) setBlocks(JSON.parse(savedBlocks));

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
  };

  // Load from Supabase cloud data helper
  const loadFromCloud = (data) => {
    const parsedLogs = data.workout_logs || {};
    setWorkoutLogs(parsedLogs);
    setWeeklyMetrics(data.weekly_metrics || {});
    if (data.blocks && Array.isArray(data.blocks)) setBlocks(data.blocks);

    if (Object.keys(parsedLogs).length > 0) {
      const migratedPRs = migrateHistoricalPRs(parsedLogs);
      setPersonalRecords(migratedPRs);
    } else {
      setPersonalRecords(data.personal_records || {});
    }

    // Cache in localStorage
    try {
      localStorage.setItem('workout-logs', JSON.stringify(parsedLogs));
      localStorage.setItem('weekly-metrics', JSON.stringify(data.weekly_metrics || {}));
      localStorage.setItem('workout-blocks', JSON.stringify(data.blocks || []));
      localStorage.setItem('personal-records', JSON.stringify(data.personal_records || {}));
    } catch (e) {
      console.log('Error caching to localStorage:', e);
    }
  };

  // Load data on mount or when user changes
  React.useEffect(() => {
    const loadData = async () => {
      setDataLoaded(false);

      if (user && supabase) {
        try {
          const { data, error } = await supabase
            .from('user_data')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error && error.code === 'PGRST116') {
            // No row exists yet for this user
            const localLogs = localStorage.getItem('workout-logs');
            const hasLocalData = localLogs && Object.keys(JSON.parse(localLogs)).length > 0;

            if (hasLocalData) {
              // Has local data to migrate - show merge modal
              setShowMergeModal(true);
              loadFromLocalStorage();
            } else {
              // Fresh user, create empty row
              await supabase.from('user_data').insert({ id: user.id });
              loadFromLocalStorage();
            }
          } else if (error) {
            throw error;
          } else {
            // Got cloud data
            const localLogs = localStorage.getItem('workout-logs');
            const hasLocalData = localLogs && Object.keys(JSON.parse(localLogs)).length > 0;
            const hasCloudData = data.workout_logs && Object.keys(data.workout_logs).length > 0;

            if (hasLocalData && hasCloudData) {
              // Both exist - offer merge choice
              setCloudData(data);
              setShowMergeModal(true);
              loadFromLocalStorage();
            } else if (hasCloudData) {
              // Only cloud data
              loadFromCloud(data);
            } else {
              // Only local or neither
              loadFromLocalStorage();
            }
          }
        } catch (error) {
          console.error('Error loading from Supabase:', error);
          setStorageError('Cloud sync error - using local data');
          loadFromLocalStorage();
        }
      } else {
        // Not logged in - use localStorage
        loadFromLocalStorage();
      }

      setDataLoaded(true);
    };

    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading]);

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
        localStorage.setItem('personal-records', JSON.stringify(personalRecords));
      } catch (error) {
        console.error('Error saving personal records:', error);
      }
    }
  }, [personalRecords, dataLoaded]);

  // Debounced save to Supabase
  const saveToSupabase = useCallback(() => {
    if (!user || !supabase || !dataLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSyncStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('user_data')
          .upsert({
            id: user.id,
            workout_logs: workoutLogs,
            weekly_metrics: weeklyMetrics,
            blocks: blocks,
            personal_records: personalRecords
          });

        if (error) throw error;
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus(''), 2000);
      } catch (error) {
        console.error('Error saving to Supabase:', error);
        setSyncStatus('error');
        setTimeout(() => setSyncStatus(''), 3000);
      }
    }, 1000);
  }, [user, workoutLogs, weeklyMetrics, blocks, personalRecords, dataLoaded]);

  // Trigger Supabase sync when data changes
  React.useEffect(() => {
    saveToSupabase();
  }, [saveToSupabase]);

  // Cardio Utility Functions
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) { // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
      return parts[0] * 60 + parts[1];
    }
    return parseInt(timeStr) || 0; // Assume seconds
  };

  const formatSecondsToTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculatePace = (timeSeconds, distance) => {
    if (!timeSeconds || !distance || distance <= 0) return null;
    const paceSeconds = timeSeconds / parseFloat(distance);
    return formatSecondsToTime(Math.round(paceSeconds));
  };

  const calculateTotalDistance = (sets) => {
    if (!sets || !Array.isArray(sets)) return 0;
    return sets.reduce((total, set) => {
      return total + (parseFloat(set.distance) || 0);
    }, 0);
  };

  const calculateTotalDuration = (sets) => {
    if (!sets || !Array.isArray(sets)) return 0;
    return sets.reduce((total, set) => {
      return total + parseTimeToSeconds(set.time);
    }, 0);
  };

  // Personal Records Functions
  const calculateEstimated1RM = (weight, reps) => {
    if (!weight || !reps || reps < 1) return 0;
    // Epley formula: 1RM = weight × (1 + reps/30)
    return Math.round(parseFloat(weight) * (1 + parseFloat(reps) / 30));
  };

  const checkForPRs = (exerciseName, sets, logDate, exerciseType = 'strength') => {
    const prsDetected = [];
    const currentPRs = personalRecords[exerciseName] || {};

    if (exerciseType === 'cardio') {
      // Cardio PR checks
      sets.forEach(set => {
        const distance = parseFloat(set.distance);
        const timeSeconds = parseTimeToSeconds(set.time);

        if (!distance || !timeSeconds) return;

        const paceSeconds = timeSeconds / distance;

        // Check max distance PR (single entry)
        if (!currentPRs.maxDistance || distance > currentPRs.maxDistance.value) {
          prsDetected.push({
            type: 'maxDistance',
            exerciseName,
            value: distance,
            unit: set.unit || 'miles',
            time: set.time,
            previous: currentPRs.maxDistance?.value || 0,
            date: logDate
          });
        }

        // Check fastest pace PR (lower is better)
        if (!currentPRs.fastestPace || paceSeconds < currentPRs.fastestPace.value) {
          prsDetected.push({
            type: 'fastestPace',
            exerciseName,
            value: paceSeconds,
            displayValue: calculatePace(timeSeconds, distance),
            distance,
            unit: set.unit || 'miles',
            time: set.time,
            previous: currentPRs.fastestPace?.value || Infinity,
            date: logDate
          });
        }

        // Check longest duration PR
        if (!currentPRs.longestDuration || timeSeconds > currentPRs.longestDuration.value) {
          prsDetected.push({
            type: 'longestDuration',
            exerciseName,
            value: timeSeconds,
            displayValue: set.time,
            distance,
            unit: set.unit || 'miles',
            previous: currentPRs.longestDuration?.value || 0,
            date: logDate
          });
        }
      });

      return prsDetected;
    }

    if (exerciseType === 'tabata') {
      // Tabata PR checks
      sets.forEach(set => {
        const rounds = parseInt(set.rounds);

        if (!rounds) return;

        // Check most rounds in a single set PR
        if (!currentPRs.mostRounds || rounds > currentPRs.mostRounds.value) {
          prsDetected.push({
            type: 'mostRounds',
            exerciseName,
            value: rounds,
            workSeconds: set.workSeconds || 20,
            restSeconds: set.restSeconds || 10,
            previous: currentPRs.mostRounds?.value || 0,
            date: logDate
          });
        }
      });

      // Check most sets in a session PR
      const completedSets = sets.filter(s => parseInt(s.rounds) > 0).length;
      if (completedSets > 0 && (!currentPRs.mostSets || completedSets > currentPRs.mostSets.value)) {
        prsDetected.push({
          type: 'mostSets',
          exerciseName,
          value: completedSets,
          previous: currentPRs.mostSets?.value || 0,
          date: logDate
        });
      }

      return prsDetected;
    }

    // Strength PR checks
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

  const updatePRs = (exerciseName, sets, logDate, logKey, exerciseType = 'strength') => {
    const currentPRs = personalRecords[exerciseName] || {};
    const updatedPRs = { ...currentPRs };

    if (exerciseType === 'cardio') {
      sets.forEach(set => {
        const distance = parseFloat(set.distance);
        const timeSeconds = parseTimeToSeconds(set.time);

        if (!distance || !timeSeconds) return;

        const paceSeconds = timeSeconds / distance;

        // Update max distance
        if (!updatedPRs.maxDistance || distance > updatedPRs.maxDistance.value) {
          updatedPRs.maxDistance = {
            value: distance,
            unit: set.unit || 'miles',
            time: set.time,
            date: logDate,
            logKey
          };
        }

        // Update fastest pace
        if (!updatedPRs.fastestPace || paceSeconds < updatedPRs.fastestPace.value) {
          updatedPRs.fastestPace = {
            value: paceSeconds,
            displayValue: calculatePace(timeSeconds, distance),
            distance,
            unit: set.unit || 'miles',
            time: set.time,
            date: logDate,
            logKey
          };
        }

        // Update longest duration
        if (!updatedPRs.longestDuration || timeSeconds > updatedPRs.longestDuration.value) {
          updatedPRs.longestDuration = {
            value: timeSeconds,
            displayValue: set.time,
            distance,
            unit: set.unit || 'miles',
            date: logDate,
            logKey
          };
        }
      });
    } else if (exerciseType === 'tabata') {
      // Tabata PR updates
      sets.forEach(set => {
        const rounds = parseInt(set.rounds);

        if (!rounds) return;

        // Update most rounds
        if (!updatedPRs.mostRounds || rounds > updatedPRs.mostRounds.value) {
          updatedPRs.mostRounds = {
            value: rounds,
            workSeconds: set.workSeconds || 20,
            restSeconds: set.restSeconds || 10,
            date: logDate,
            logKey
          };
        }
      });

      // Update most sets
      const completedSets = sets.filter(s => parseInt(s.rounds) > 0).length;
      if (completedSets > 0 && (!updatedPRs.mostSets || completedSets > updatedPRs.mostSets.value)) {
        updatedPRs.mostSets = {
          value: completedSets,
          date: logDate,
          logKey
        };
      }
    } else {
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
    }

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
        const exerciseType = entry.type || 'strength';

        if (exerciseType === 'cardio') {
          // Cardio chart types
          if (type === 'distance') {
            // Total distance in session
            value = calculateTotalDistance(entry.sets);
          } else if (type === 'pace') {
            // Best pace in session (lowest pace = fastest)
            const paces = entry.sets
              .map(s => {
                const d = parseFloat(s.distance);
                const t = parseTimeToSeconds(s.time);
                return d && t ? t / d : Infinity;
              })
              .filter(p => p !== Infinity);
            value = paces.length > 0 ? Math.min(...paces) : 0;
          } else if (type === 'duration') {
            // Total duration in session (in minutes for display)
            value = calculateTotalDuration(entry.sets) / 60;
          }
        } else if (exerciseType === 'tabata') {
          // Tabata chart types
          if (type === 'rounds') {
            // Total rounds in session
            value = entry.sets.reduce((sum, s) => sum + (parseInt(s.rounds) || 0), 0);
          } else if (type === 'sets') {
            // Number of sets completed
            value = entry.sets.filter(s => parseInt(s.rounds) > 0).length;
          }
        } else {
          // Strength chart types
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
      personalRecords,
      exportDate: new Date().toISOString(),
      version: '1.4'
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
        if (data.personalRecords) {
          setPersonalRecords(data.personalRecords);
        } else if (data.workoutLogs) {
          // Backward compatibility: recalculate PRs for old exports
          const migratedPRs = migrateHistoricalPRs(data.workoutLogs);
          setPersonalRecords(migratedPRs);
        }
        alert('Data imported successfully!');
        setShowExportImport(false);
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!supabase) {
      setAuthError('Cloud sync not configured');
      return;
    }

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
      }
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleMergeChoice = async (choice) => {
    if (choice === 'cloud' && cloudData) {
      loadFromCloud(cloudData);
    } else if (choice === 'local') {
      // Keep local data -- it will auto-sync to Supabase via save effect
    } else if (choice === 'merge' && cloudData) {
      const mergedLogs = { ...workoutLogs };
      if (cloudData.workout_logs) {
        Object.entries(cloudData.workout_logs).forEach(([key, cloudEntry]) => {
          const localEntry = mergedLogs[key];
          if (localEntry && cloudEntry) {
            const cloudDate = new Date(cloudEntry.date || 0);
            const localDate = new Date(localEntry.date || 0);
            if (cloudDate > localDate) {
              mergedLogs[key] = cloudEntry;
            }
          } else if (!localEntry) {
            mergedLogs[key] = cloudEntry;
          }
        });
      }
      setWorkoutLogs(mergedLogs);

      const mergedMetrics = { ...(cloudData.weekly_metrics || {}), ...weeklyMetrics };
      setWeeklyMetrics(mergedMetrics);

      const migratedPRs = migrateHistoricalPRs(mergedLogs);
      setPersonalRecords(migratedPRs);
    }

    setShowMergeModal(false);
    setCloudData(null);
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

  // Get all unique exercise names for fuzzy search (deduplicated by case)
  const getAllExerciseNames = useMemo(() => {
    const nameMap = new Map(); // lowercase -> { name, count }
    Object.values(workoutLogs).forEach(log => {
      if (log.exercises) {
        log.exercises.forEach(ex => {
          if (ex.name) {
            const key = ex.name.toLowerCase().trim();
            const existing = nameMap.get(key);
            if (existing) {
              existing.count++;
              // Keep the version that's used more often
            } else {
              nameMap.set(key, { name: ex.name.trim(), count: 1 });
            }
          }
        });
      }
    });
    return Array.from(nameMap.values()).map(v => v.name);
  }, [workoutLogs]);

  // Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(getAllExerciseNames, {
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true
    });
  }, [getAllExerciseNames]);

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
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-2">Workout Tracker</h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm md:text-base">Periodized training with progression tracking</p>
          <div className="flex items-center gap-2">
            {syncStatus === 'saving' && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <Cloud className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Syncing...</span>
              </span>
            )}
            {syncStatus === 'saved' && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                <span className="hidden sm:inline">Sync error</span>
              </span>
            )}
            {!authLoading && supabase && (
              user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden md:inline">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs flex items-center gap-1"
                    title="Sign out of cloud sync"
                  >
                    <LogOut className="w-3 h-3" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1"
                  title="Sign in to sync data across devices"
                >
                  <LogIn className="w-3 h-3" />
                  Login
                </button>
              )
            )}
            <button
              onClick={() => setShowExportImport(!showExportImport)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm"
              title="Export or import workout data backups"
            >
              Backup/Restore
            </button>
          </div>
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
              title="Download all data as a backup file"
            >
              <Save className="w-4 h-4" />
              Export Data (Download Backup)
            </button>
            <div>
              <label className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center cursor-pointer" title="Restore from a backup file">
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

      <div className="flex gap-1 md:gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setView('calendar')}
          className={`px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium transition-colors ${
            view === 'calendar'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1 md:mr-2" />
          Calendar
        </button>
        <button
          onClick={() => setView('progress')}
          className={`px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium transition-colors ${
            view === 'progress'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-1 md:mr-2" />
          Progress
        </button>
        <button
          onClick={() => setView('template')}
          className={`px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium transition-colors ${
            view === 'template'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-1 md:mr-2" />
          Template
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-xl p-4 md:p-6 border border-gray-700">
        {/* Progress View - showing condensed version */}
        {view === 'progress' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-100">Progress Tracker</h2>
            
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Workouts Completed</p>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">
                    {Object.keys(workoutLogs).filter(k => k.startsWith(`block${currentBlock}`)).length}
                  </p>
                </div>
                <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Current Week</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{currentWeek}</p>
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
                      <div className="p-4 bg-cyan-950/30 border border-cyan-900/50 rounded-lg" title="Heart Rate Variability - higher is generally better for recovery">
                        <p className="text-sm text-gray-400">Latest HRV</p>
                        <p className="text-2xl md:text-3xl font-bold text-cyan-400">
                          {latestHrv ? `${latestHrv}` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">ms</p>
                      </div>
                      <div className="p-4 bg-purple-950/30 border border-purple-900/50 rounded-lg" title="7-day rolling average HRV">
                        <p className="text-sm text-gray-400">Avg HRV (7d)</p>
                        <p className="text-2xl md:text-3xl font-bold text-purple-400">
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

                {/* Chart Type Selector - Dynamic based on exercise type */}
                {(() => {
                  const history = getAllExerciseHistory(selectedExerciseHistory);
                  const exerciseType = history.length > 0 ? (history[0].type || 'strength') : 'strength';

                  if (exerciseType === 'cardio') {
                    return (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setChartType('distance')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            chartType === 'distance'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Distance
                        </button>
                        <button
                          onClick={() => setChartType('pace')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            chartType === 'pace'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Pace
                        </button>
                        <button
                          onClick={() => setChartType('duration')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            chartType === 'duration'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Duration
                        </button>
                      </div>
                    );
                  }

                  if (exerciseType === 'tabata') {
                    return (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setChartType('rounds')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            chartType === 'rounds'
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Rounds
                        </button>
                        <button
                          onClick={() => setChartType('sets')}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            chartType === 'sets'
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Sets
                        </button>
                      </div>
                    );
                  }

                  return (
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
                  );
                })()}

                {/* Personal Records for this Exercise */}
                {personalRecords[selectedExerciseHistory] && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 rounded-lg border border-yellow-600/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h4 className="font-semibold text-yellow-300">Personal Records</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Cardio PRs */}
                      {personalRecords[selectedExerciseHistory].maxDistance && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Max Distance</div>
                          <div className="text-lg font-bold text-blue-400">
                            {personalRecords[selectedExerciseHistory].maxDistance.value} {personalRecords[selectedExerciseHistory].maxDistance.unit || 'mi'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].maxDistance.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].fastestPace && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Fastest Pace</div>
                          <div className="text-lg font-bold text-cyan-400">
                            {personalRecords[selectedExerciseHistory].fastestPace.displayValue}/{personalRecords[selectedExerciseHistory].fastestPace.unit === 'km' ? 'km' : 'mi'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].fastestPace.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].longestDuration && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Longest Duration</div>
                          <div className="text-lg font-bold text-purple-400">
                            {personalRecords[selectedExerciseHistory].longestDuration.displayValue}
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].longestDuration.date}
                          </div>
                        </div>
                      )}
                      {/* Strength PRs */}
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
                          <div className="text-xs text-gray-400 mb-1" title="Estimated one-rep max using Epley formula">Est. 1RM</div>
                          <div className="text-lg font-bold text-purple-400">
                            {personalRecords[selectedExerciseHistory].estimated1RM.value} lb
                          </div>
                          <div className="text-xs text-gray-500">Epley formula</div>
                        </div>
                      )}
                      {/* Tabata PRs */}
                      {personalRecords[selectedExerciseHistory].mostRounds && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Most Rounds</div>
                          <div className="text-lg font-bold text-orange-400">
                            {personalRecords[selectedExerciseHistory].mostRounds.value} rounds
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].mostRounds.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].mostSets && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Most Sets</div>
                          <div className="text-lg font-bold text-orange-400">
                            {personalRecords[selectedExerciseHistory].mostSets.value} sets
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].mostSets.date}
                          </div>
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
                              } else if (chartType === 'reps') {
                                return [`${value}`, 'Max Reps'];
                              } else if (chartType === 'distance') {
                                return [`${value.toFixed(2)} mi`, 'Distance'];
                              } else if (chartType === 'pace') {
                                return [`${formatSecondsToTime(Math.round(value))}/mi`, 'Pace'];
                              } else if (chartType === 'duration') {
                                return [`${value.toFixed(0)} min`, 'Duration'];
                              } else if (chartType === 'rounds') {
                                return [`${value}`, 'Total Rounds'];
                              } else if (chartType === 'sets') {
                                return [`${value}`, 'Sets Completed'];
                              }
                              return [value, 'Value'];
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
                  {getAllExerciseHistory(selectedExerciseHistory).map((entry, idx) => {
                    const exerciseType = entry.type || 'strength';

                    return (
                      <div key={idx} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-100">
                            {formatDate(entry.date)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            exerciseType === 'cardio'
                              ? 'bg-blue-900/50 text-blue-400'
                              : exerciseType === 'tabata'
                                ? 'bg-orange-900/50 text-orange-400'
                                : 'bg-emerald-900/50 text-emerald-400'
                          }`}>
                            {exerciseType}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {entry.sets && entry.sets.map((set, setIdx) => (
                            <div key={setIdx} className="text-sm text-gray-300">
                              {exerciseType === 'cardio' ? (
                                <>
                                  Entry {setIdx + 1}: {set.distance ? `${set.distance} ${set.unit || 'mi'} in ${set.time}` : 'Not logged'}
                                  {set.distance && set.time && (
                                    <span className="text-cyan-400 ml-2">
                                      ({calculatePace(parseTimeToSeconds(set.time), parseFloat(set.distance))}/{set.unit === 'km' ? 'km' : 'mi'})
                                    </span>
                                  )}
                                </>
                              ) : exerciseType === 'tabata' ? (
                                <>
                                  Set {setIdx + 1}: {set.rounds ? `${set.rounds} rounds @ ${set.workSeconds || '20'}s/${set.restSeconds || '10'}s${set.calories ? ` • ${set.calories} kcal` : ''}` : 'Not logged'}
                                </>
                              ) : (
                                <>Set {setIdx + 1}: {set.weight ? `${set.weight} lb × ${set.reps} reps` : 'Not logged'}</>
                              )}
                            </div>
                          ))}
                        </div>
                        {entry.notes && (
                          <p className="mt-2 text-xs text-gray-400 italic">
                            Note: {entry.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
                        setPrefilled(false);
                      } else {
                        setLogDate(new Date().toISOString().split('T')[0]);
                        setLogHrv('');

                        // Auto-populate from previous week's same day
                        const prevWeekKey = currentWeek > 1
                          ? `block${currentBlock}-week${currentWeek - 1}-${day}`
                          : null;
                        const prevWeekLog = prevWeekKey ? workoutLogs[prevWeekKey] : null;

                        if (prevWeekLog && prevWeekLog.exercises && prevWeekLog.exercises.length > 0) {
                          setExercises(prevWeekLog.exercises.map(ex => {
                            const exType = ex.type || 'strength';
                            return {
                              name: ex.name,
                              type: exType,
                              sets: ex.sets.map(s =>
                                exType === 'cardio'
                                  ? { distance: s.distance || '', time: s.time || '', unit: s.unit || 'miles' }
                                  : exType === 'tabata'
                                    ? { rounds: s.rounds || '', workSeconds: s.workSeconds || '20', restSeconds: s.restSeconds || '10', calories: s.calories || '' }
                                    : { weight: s.weight || '', reps: s.reps || '' }
                              ),
                              notes: ex.notes || ''
                            };
                          }));
                          setPrefilled(true);
                        } else {
                          setExercises(workout?.exercises.map(ex => ({
                            name: ex.name,
                            technique: ex.technique,
                            sets: Array(parseInt(ex.sets) || 3).fill(null).map(() => ({
                              weight: '',
                              reps: ''
                            })),
                            notes: ''
                          })) || []);
                          setPrefilled(false);
                        }
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
                onClick={() => { setPrefilled(false); setView('calendar'); }}
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
                  <label className="text-xs text-gray-400 block mb-2" title="Heart Rate Variability - lower when fatigued">Overnight HRV (ms)</label>
                  <input
                    type="text"
                    value={logHrv}
                    onChange={(e) => setLogHrv(e.target.value)}
                    placeholder="e.g., 65"
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 w-full"
                    title="Heart Rate Variability - lower when fatigued"
                  />
                </div>
              </div>
            </div>

            {prefilled && (
              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-300">
                    Pre-filled from Week {currentWeek - 1} {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const workout = getCurrentTemplate()[selectedDay];
                    setExercises(workout?.exercises.map(ex => ({
                      name: ex.name,
                      technique: ex.technique,
                      sets: Array(parseInt(ex.sets) || 3).fill(null).map(() => ({
                        weight: '',
                        reps: ''
                      })),
                      notes: ''
                    })) || []);
                    setPrefilled(false);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 underline"
                  title="Clear pre-filled data and start from template"
                >
                  Clear
                </button>
              </div>
            )}

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
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={(e) => {
                            const newExercises = [...exercises];
                            newExercises[exIdx].name = e.target.value;
                            setExercises(newExercises);

                            // Generate suggestions
                            if (e.target.value.length >= 2) {
                              const results = fuse.search(e.target.value).slice(0, 5);
                              setExerciseSuggestions(results.map(r => r.item));
                              setActiveSuggestionIndex(-1);
                            } else {
                              setExerciseSuggestions([]);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (exerciseSuggestions.length === 0) return;

                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setActiveSuggestionIndex(prev =>
                                Math.min(prev + 1, exerciseSuggestions.length - 1)
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setActiveSuggestionIndex(prev => Math.max(prev - 1, -1));
                            } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
                              e.preventDefault();
                              const newExercises = [...exercises];
                              newExercises[exIdx].name = exerciseSuggestions[activeSuggestionIndex];
                              setExercises(newExercises);
                              setExerciseSuggestions([]);
                            } else if (e.key === 'Escape') {
                              setExerciseSuggestions([]);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setExerciseSuggestions([]), 150);
                          }}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg font-semibold text-gray-100"
                        />

                        {/* Autocomplete dropdown */}
                        {exerciseSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {exerciseSuggestions.map((suggestion, idx) => (
                              <button
                                key={suggestion}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].name = suggestion;
                                  setExercises(newExercises);
                                  setExerciseSuggestions([]);
                                }}
                                className={`w-full text-left px-3 py-2 text-gray-100 hover:bg-gray-700 ${
                                  idx === activeSuggestionIndex ? 'bg-gray-700' : ''
                                }`}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (previousSession && previousSession.sets) {
                            const newExercises = [...exercises];
                            const prevType = previousSession.type || 'strength';
                            newExercises[exIdx].type = prevType;
                            newExercises[exIdx].sets = previousSession.sets.map(s =>
                              prevType === 'cardio'
                                ? { distance: s.distance || '', time: s.time || '', unit: s.unit || 'miles' }
                                : prevType === 'tabata'
                                  ? { rounds: s.rounds || '', workSeconds: s.workSeconds || '20', restSeconds: s.restSeconds || '10', calories: s.calories || '' }
                                  : { weight: s.weight || '', reps: s.reps || '' }
                            );
                            setExercises(newExercises);
                          }
                        }}
                        disabled={!previousSession}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                        title="Load your previous workout data"
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

                    {/* Exercise Type Toggle */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-gray-400">Type:</span>
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          newExercises[exIdx].type = 'strength';
                          // Convert sets to strength format
                          newExercises[exIdx].sets = newExercises[exIdx].sets.map(() => ({
                            weight: '',
                            reps: ''
                          }));
                          setExercises(newExercises);
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          (exercise.type || 'strength') === 'strength'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                        title="Track weight and reps"
                      >
                        Strength
                      </button>
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          newExercises[exIdx].type = 'cardio';
                          // Convert sets to cardio format
                          newExercises[exIdx].sets = newExercises[exIdx].sets.map(() => ({
                            distance: '',
                            time: '',
                            unit: 'miles'
                          }));
                          setExercises(newExercises);
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          exercise.type === 'cardio'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                        title="Track distance and time"
                      >
                        Cardio
                      </button>
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          newExercises[exIdx].type = 'tabata';
                          // Convert sets to tabata format
                          newExercises[exIdx].sets = newExercises[exIdx].sets.map(() => ({
                            rounds: '',
                            workSeconds: '20',
                            restSeconds: '10',
                            calories: ''
                          }));
                          setExercises(newExercises);
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          exercise.type === 'tabata'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                        title="Track interval rounds"
                      >
                        Tabata
                      </button>
                    </div>

                    {/* Previous Session Banner */}
                    {previousSession && (
                      <div className="mb-3 p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-400">Last Session ({formatDate(previousSession.date)})</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            (previousSession.type || 'strength') === 'cardio'
                              ? 'bg-blue-900/50 text-blue-400'
                              : (previousSession.type || 'strength') === 'tabata'
                                ? 'bg-orange-900/50 text-orange-400'
                                : 'bg-emerald-900/50 text-emerald-400'
                          }`}>
                            {previousSession.type || 'strength'}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {previousSession.sets?.map((prevSet, idx) => (
                            <span key={idx} className="text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded">
                              {(previousSession.type || 'strength') === 'cardio'
                                ? `${prevSet.distance || '?'} ${prevSet.unit || 'mi'} in ${prevSet.time || '?'}`
                                : (previousSession.type || 'strength') === 'tabata'
                                  ? `${prevSet.rounds || '?'} rounds @ ${prevSet.workSeconds || '20'}s/${prevSet.restSeconds || '10'}s${prevSet.calories ? ` • ${prevSet.calories} kcal` : ''}`
                                  : `${prevSet.weight || '?'}lb × ${prevSet.reps || '?'}`}
                            </span>
                          ))}
                        </div>
                        {(previousSession.type || 'strength') === 'strength' && (
                          <div className="text-xs text-gray-400 mt-2" title="Total weight × reps for this exercise">
                            Volume: {previousVolume.toLocaleString()} lb
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {exercise.sets.map((set, setIdx) => {
                        const exerciseType = exercise.type || 'strength';
                        const comparison = exerciseType === 'strength' ? compareSetToPrevious(set, previousSession?.sets, setIdx) : null;

                        if (exerciseType === 'cardio') {
                          // Cardio input fields
                          return (
                            <div key={setIdx} className="flex gap-2 items-center flex-wrap">
                              <span className="text-sm font-medium text-gray-400 w-16">Entry {setIdx + 1}</span>
                              <input
                                type="text"
                                placeholder="Distance"
                                value={set.distance || ''}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].distance = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-20 text-gray-100"
                              />
                              <select
                                value={set.unit || 'miles'}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].unit = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                              >
                                <option value="miles">mi</option>
                                <option value="km">km</option>
                                <option value="meters">m</option>
                              </select>
                              <span className="text-gray-400">in</span>
                              <input
                                type="text"
                                placeholder="MM:SS"
                                value={set.time || ''}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].time = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-24 text-gray-100"
                              />
                              {/* Show calculated pace */}
                              {set.distance && set.time && (
                                <span className="text-xs text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded">
                                  {calculatePace(parseTimeToSeconds(set.time), parseFloat(set.distance))}/{set.unit === 'km' ? 'km' : 'mi'}
                                </span>
                              )}
                              {exercise.sets.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                    setExercises(newExercises);
                                  }}
                                  className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                                  title="Remove entry"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        if (exerciseType === 'tabata') {
                          // Tabata input fields
                          return (
                            <div key={setIdx} className="flex gap-2 items-center flex-wrap">
                              <span className="text-sm font-medium text-gray-400 w-12">Set {setIdx + 1}</span>
                              <input
                                type="text"
                                placeholder="Rounds"
                                value={set.rounds || ''}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].rounds = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-20 text-gray-100"
                                title="Number of rounds completed"
                              />
                              <span className="text-gray-400">rounds @</span>
                              <input
                                type="text"
                                placeholder="20"
                                value={set.workSeconds || '20'}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].workSeconds = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg w-14 text-gray-100 text-center"
                                title="Work interval in seconds"
                              />
                              <span className="text-gray-400">s /</span>
                              <input
                                type="text"
                                placeholder="10"
                                value={set.restSeconds || '10'}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].restSeconds = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg w-14 text-gray-100 text-center"
                                title="Rest interval in seconds"
                              />
                              <span className="text-gray-400">s</span>
                              <input
                                type="text"
                                placeholder="Cal"
                                value={set.calories || ''}
                                onChange={(e) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].calories = e.target.value;
                                  setExercises(newExercises);
                                }}
                                className="px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg w-16 text-gray-100 text-center"
                                title="Calories burned (from machine display)"
                              />
                              <span className="text-gray-400">kcal</span>
                              {/* Show total time */}
                              {set.rounds && (
                                <span className="text-xs text-orange-400 bg-orange-950/30 px-2 py-1 rounded" title="Total workout time">
                                  {Math.floor((parseInt(set.rounds) * (parseInt(set.workSeconds || 20) + parseInt(set.restSeconds || 10)) - parseInt(set.restSeconds || 10)) / 60)}:{((parseInt(set.rounds) * (parseInt(set.workSeconds || 20) + parseInt(set.restSeconds || 10)) - parseInt(set.restSeconds || 10)) % 60).toString().padStart(2, '0')} total
                                </span>
                              )}
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
                        }

                        // Strength input fields
                        return (
                          <div key={setIdx} className="flex gap-2 items-center flex-wrap">
                            <span className="text-sm font-medium text-gray-400 w-12">Set {setIdx + 1}</span>
                            <input
                              type="text"
                              placeholder="Weight"
                              value={set.weight || ''}
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
                              value={set.reps || ''}
                              onChange={(e) => {
                                const newExercises = [...exercises];
                                newExercises[exIdx].sets[setIdx].reps = e.target.value;
                                setExercises(newExercises);
                              }}
                              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-20 text-gray-100"
                            />
                            {comparison === 'improved' && (
                              <span className="text-emerald-400 text-sm" title="Improvement over previous session">↑</span>
                            )}
                            {comparison === 'matched' && (
                              <span className="text-blue-400 text-sm" title="Matched previous session">✓</span>
                            )}
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
                          const exerciseType = exercise.type || 'strength';
                          const lastSet = exercise.sets[exercise.sets.length - 1];

                          if (exerciseType === 'cardio') {
                            newExercises[exIdx].sets.push({
                              distance: '',
                              time: '',
                              unit: lastSet?.unit || 'miles'
                            });
                          } else if (exerciseType === 'tabata') {
                            newExercises[exIdx].sets.push({
                              rounds: '',
                              workSeconds: lastSet?.workSeconds || '20',
                              restSeconds: lastSet?.restSeconds || '10'
                            });
                          } else {
                            newExercises[exIdx].sets.push({
                              weight: lastSet?.weight || '',
                              reps: lastSet?.reps || ''
                            });
                          }
                          setExercises(newExercises);
                        }}
                        className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add {(exercise.type || 'strength') === 'cardio' ? 'Entry' : 'Set'}
                      </button>
                    </div>

                    {/* Summary Display - Conditional based on type */}
                    {(() => {
                      const exerciseType = exercise.type || 'strength';

                      if (exerciseType === 'cardio') {
                        const totalDistance = calculateTotalDistance(exercise.sets);
                        const totalDuration = calculateTotalDuration(exercise.sets);
                        const avgPace = totalDistance > 0 ? calculatePace(totalDuration, totalDistance) : null;

                        if (totalDistance > 0 || totalDuration > 0) {
                          return (
                            <div className="mt-3 p-2 bg-gray-750 rounded border border-gray-600">
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-400">Total Distance:</span>
                                  <span className="text-gray-200 font-medium ml-2">
                                    {totalDistance.toFixed(2)} {exercise.sets[0]?.unit || 'mi'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Total Time:</span>
                                  <span className="text-gray-200 font-medium ml-2">
                                    {formatSecondsToTime(totalDuration)}
                                  </span>
                                </div>
                                {avgPace && (
                                  <div>
                                    <span className="text-gray-400">Avg Pace:</span>
                                    <span className="text-cyan-400 font-medium ml-2">
                                      {avgPace}/{exercise.sets[0]?.unit === 'km' ? 'km' : 'mi'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }

                      if (exerciseType === 'tabata') {
                        // Tabata summary
                        const totalRounds = exercise.sets.reduce((sum, s) => sum + (parseInt(s.rounds) || 0), 0);
                        const totalSets = exercise.sets.filter(s => parseInt(s.rounds) > 0).length;
                        const totalCalories = exercise.sets.reduce((sum, s) => sum + (parseInt(s.calories) || 0), 0);

                        if (totalRounds > 0 || totalCalories > 0) {
                          return (
                            <div className="mt-3 p-2 bg-gray-750 rounded border border-gray-600">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-400">Total:</span>
                                  <span className="text-orange-400 font-medium ml-2">
                                    {totalRounds} rounds / {totalSets} set{totalSets !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                {totalCalories > 0 && (
                                  <div className="text-right">
                                    <span className="text-gray-400">Calories:</span>
                                    <span className="text-orange-400 font-medium ml-2">
                                      {totalCalories} kcal
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }

                      // Strength volume display
                      if (currentVolume > 0) {
                        return (
                          <div className="mt-3 p-2 bg-gray-750 rounded border border-gray-600">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400" title="Total weight × reps for this exercise">Current Volume:</span>
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
                        );
                      }
                      return null;
                    })()}

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
                  const exerciseType = exercise.type || 'strength';
                  const prs = checkForPRs(exercise.name, exercise.sets, logDate, exerciseType);
                  allPRs.push(...prs);

                  // Update PRs in state
                  updatePRs(exercise.name, exercise.sets, logDate, logKey, exerciseType);
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
                  setPrefilled(false);
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
                    {pr.type === 'maxDistance' && (
                      <>
                        <p className="font-medium">Longest Distance!</p>
                        <p className="text-gray-400">
                          {pr.value} {pr.unit || 'miles'} in {pr.time}
                          {pr.previous > 0 && ` (previous: ${pr.previous} ${pr.unit || 'miles'})`}
                        </p>
                      </>
                    )}
                    {pr.type === 'fastestPace' && (
                      <>
                        <p className="font-medium">Fastest Pace!</p>
                        <p className="text-gray-400">
                          {pr.displayValue}/{pr.unit === 'km' ? 'km' : 'mi'} for {pr.distance} {pr.unit === 'km' ? 'km' : 'mi'}
                          {pr.previous !== Infinity && pr.previous > 0 && ` (previous: ${formatSecondsToTime(Math.round(pr.previous))}/${pr.unit === 'km' ? 'km' : 'mi'})`}
                        </p>
                      </>
                    )}
                    {pr.type === 'longestDuration' && (
                      <>
                        <p className="font-medium">Longest Duration!</p>
                        <p className="text-gray-400">
                          {pr.displayValue} for {pr.distance} {pr.unit === 'km' ? 'km' : 'mi'}
                          {pr.previous > 0 && ` (previous: ${formatSecondsToTime(pr.previous)})`}
                        </p>
                      </>
                    )}
                    {pr.type === 'mostRounds' && (
                      <>
                        <p className="font-medium">Most Rounds!</p>
                        <p className="text-gray-400">
                          {pr.value} rounds @ {pr.workSeconds}s/{pr.restSeconds}s
                          {pr.previous > 0 && ` (previous: ${pr.previous} rounds)`}
                        </p>
                      </>
                    )}
                    {pr.type === 'mostSets' && (
                      <>
                        <p className="font-medium">Most Tabata Sets!</p>
                        <p className="text-gray-400">
                          {pr.value} sets in one session
                          {pr.previous > 0 && ` (previous: ${pr.previous} sets)`}
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
                setPrefilled(false);
                setView('calendar');
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-lg transition-colors"
            >
              Awesome! Continue
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-100">
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </h2>
              <button
                onClick={() => { setShowAuthModal(false); setAuthError(''); }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Sign in to sync your workouts across devices.
            </p>

            <form onSubmit={handleAuth} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="password"
                placeholder="Password (min 6 chars)"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              {authError && (
                <p className="text-red-400 text-xs">{authError}</p>
              )}
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
              >
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-400 mt-3">
              {authMode === 'login' ? (
                <>No account?{' '}
                  <button onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className="text-blue-400 hover:underline">Sign up</button>
                </>
              ) : (
                <>Have an account?{' '}
                  <button onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className="text-blue-400 hover:underline">Sign in</button>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-gray-100 mb-2">Data Found in Both Places</h2>
            <p className="text-sm text-gray-400 mb-4">
              You have workout data saved locally and in the cloud. What would you like to do?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleMergeChoice('cloud')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center gap-2"
              >
                <Cloud className="w-4 h-4" />
                Use Cloud Data
              </button>
              <button
                onClick={() => handleMergeChoice('local')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Use Local Data
              </button>
              <button
                onClick={() => handleMergeChoice('merge')}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Merge Both (combine workouts)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              "Merge" keeps all workouts from both sources. For duplicate days, the most recent version is kept.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;

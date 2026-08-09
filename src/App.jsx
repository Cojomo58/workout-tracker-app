import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown, TrendingUp, Calendar, Dumbbell, Save, X, History, Settings, Trash2, Edit3, Trophy, LogIn, LogOut, GripVertical, Timer, Check, Volume2, VolumeX } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Fuse from 'fuse.js';
import { supabase } from './supabaseClient';

const DEFAULT_TM_PERCENT = 90;

// --- Exercise-name normalization & similarity (for duplicate detection) ---
// Common gym abbreviations expanded so "DB Bench Press" matches "Dumbbell Bench Press".
const EXERCISE_ABBREV = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  ohp: 'overhead press', rdl: 'romanian deadlift', sldl: 'stiff leg deadlift',
  bp: 'bench press', dl: 'deadlift', sq: 'squat', cg: 'close grip',
  ez: 'ez bar', bw: 'bodyweight', ext: 'extension', exts: 'extension',
  incl: 'incline', lat: 'lateral', lats: 'lateral', pulldown: 'pull down',
  ohd: 'overhead',
};
// Words that add no distinguishing meaning when comparing names.
const EXERCISE_STOP_WORDS = new Set(['the', 'a', 'with', 'and', 'of']);

// Reduce a name to a set of comparable, order-independent tokens.
const normalizeExerciseTokens = (name) => {
  const cleaned = String(name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = [];
  cleaned.split(/\s+/).filter(Boolean).forEach((word) => {
    const expanded = EXERCISE_ABBREV[word] || word;
    expanded.split(' ').forEach((t) => {
      if (!t || EXERCISE_STOP_WORDS.has(t)) return;
      // Crude singularization so "curls" === "curl".
      const singular = t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
      tokens.push(singular);
    });
  });
  return tokens;
};

// Jaccard similarity over normalized token sets. 1 = identical meaning, 0 = nothing shared.
const exerciseSimilarity = (a, b) => {
  const sa = new Set(normalizeExerciseTokens(a));
  const sb = new Set(normalizeExerciseTokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((t) => { if (sb.has(t)) inter++; });
  return inter / (sa.size + sb.size - inter);
};

// Best existing name similar to `name` but not spelled identically. Returns { name, score } or null.
const findSimilarExercise = (name, candidates, threshold = 0.6) => {
  const target = String(name || '').toLowerCase().trim();
  if (!target) return null;
  let best = null;
  candidates.forEach((candidate) => {
    if (!candidate) return;
    if (candidate.toLowerCase().trim() === target) return; // identical spelling — not a "duplicate variation"
    const score = exerciseSimilarity(name, candidate);
    if (score >= threshold && (!best || score > best.score)) {
      best = { name: candidate, score };
    }
  });
  return best;
};

function ExerciseTypeBadge({ type }) {
  const styles = {
    cardio: 'bg-blue-900/50 text-blue-400',
    tabata: 'bg-orange-900/50 text-orange-400',
    bodyweight: 'bg-violet-900/50 text-violet-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[type] ?? 'bg-emerald-900/50 text-emerald-400'}`}>
      {type}
    </span>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-bold text-gray-100">{title}</h2>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// A blank starting block — every new install (and every reset) begins here, not with any
// specific person's programming. `template` keys must stay in sync with `days` below.
const createEmptyBlock = () => ({
  id: 1,
  name: 'My Training Block',
  weeks: 4,
  template: {
    monday: { name: '', exercises: [] },
    tuesday: { name: '', exercises: [] },
    wednesday: { name: '', exercises: [] },
    thursday: { name: '', exercises: [] },
    friday: { name: '', exercises: [] },
  },
});

// Generic starter programs offered during first-run onboarding — deliberately not any
// individual's actual training block, just common, well-known splits.
const STARTER_TEMPLATES = [
  {
    key: 'upper-lower',
    label: 'Upper / Lower',
    description: '4 days — upper and lower body alternating',
    build: () => ({
      monday: { name: 'Upper Body', exercises: [
        { name: 'Bench Press', sets: 4, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Barbell Row', sets: 4, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Lat Pulldown', sets: 3, reps: '10-12', technique: '', rest: '90 sec' },
      ] },
      tuesday: { name: 'Lower Body', exercises: [
        { name: 'Squat', sets: 4, reps: '5-8', technique: '', rest: '3 min' },
        { name: 'Romanian Deadlift', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Leg Press', sets: 3, reps: '10-12', technique: '', rest: '2 min' },
        { name: 'Calf Raise', sets: 3, reps: '12-15', technique: '', rest: '90 sec' },
      ] },
      wednesday: { name: '', exercises: [] },
      thursday: { name: 'Upper Body', exercises: [
        { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Pull-Up', sets: 4, reps: '6-10', technique: '', rest: '2 min' },
        { name: 'Dumbbell Shoulder Press', sets: 3, reps: '8-10', technique: '', rest: '90 sec' },
        { name: 'Cable Row', sets: 3, reps: '10-12', technique: '', rest: '90 sec' },
      ] },
      friday: { name: 'Lower Body', exercises: [
        { name: 'Deadlift', sets: 3, reps: '5', technique: '', rest: '3 min' },
        { name: 'Front Squat', sets: 3, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Walking Lunge', sets: 3, reps: '10-12', technique: '', rest: '90 sec' },
      ] },
    }),
  },
  {
    key: 'push-pull-legs',
    label: 'Push / Pull / Legs',
    description: '5 days — push, pull, and legs across the week',
    build: () => ({
      monday: { name: 'Push', exercises: [
        { name: 'Bench Press', sets: 4, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', technique: '', rest: '90 sec' },
        { name: 'Triceps Pushdown', sets: 3, reps: '10-15', technique: '', rest: '60 sec' },
      ] },
      tuesday: { name: 'Pull', exercises: [
        { name: 'Deadlift', sets: 3, reps: '5', technique: '', rest: '3 min' },
        { name: 'Pull-Up', sets: 4, reps: '6-10', technique: '', rest: '2 min' },
        { name: 'Barbell Row', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Barbell Curl', sets: 3, reps: '10-12', technique: '', rest: '60 sec' },
      ] },
      wednesday: { name: 'Legs', exercises: [
        { name: 'Squat', sets: 4, reps: '5-8', technique: '', rest: '3 min' },
        { name: 'Romanian Deadlift', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Leg Press', sets: 3, reps: '10-12', technique: '', rest: '2 min' },
        { name: 'Calf Raise', sets: 3, reps: '12-15', technique: '', rest: '60 sec' },
      ] },
      thursday: { name: 'Push', exercises: [
        { name: 'Overhead Press', sets: 4, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Incline Bench Press', sets: 3, reps: '8-10', technique: '', rest: '2 min' },
        { name: 'Lateral Raise', sets: 3, reps: '12-15', technique: '', rest: '60 sec' },
        { name: 'Dips', sets: 3, reps: '8-12', technique: '', rest: '90 sec' },
      ] },
      friday: { name: 'Pull', exercises: [
        { name: 'Barbell Row', sets: 4, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Lat Pulldown', sets: 3, reps: '10-12', technique: '', rest: '90 sec' },
        { name: 'Face Pull', sets: 3, reps: '12-15', technique: '', rest: '60 sec' },
        { name: 'Dumbbell Curl', sets: 3, reps: '10-12', technique: '', rest: '60 sec' },
      ] },
    }),
  },
  {
    key: 'full-body',
    label: 'Full Body',
    description: '3 days — whole body each session, one rest day between',
    build: () => ({
      monday: { name: 'Full Body A', exercises: [
        { name: 'Squat', sets: 3, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Bench Press', sets: 3, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Barbell Row', sets: 3, reps: '8-10', technique: '', rest: '90 sec' },
      ] },
      tuesday: { name: '', exercises: [] },
      wednesday: { name: 'Full Body B', exercises: [
        { name: 'Deadlift', sets: 3, reps: '5', technique: '', rest: '3 min' },
        { name: 'Overhead Press', sets: 3, reps: '6-8', technique: '', rest: '2 min' },
        { name: 'Lat Pulldown', sets: 3, reps: '10-12', technique: '', rest: '90 sec' },
      ] },
      thursday: { name: '', exercises: [] },
      friday: { name: 'Full Body C', exercises: [
        { name: 'Front Squat', sets: 3, reps: '6-8', technique: '', rest: '2-3 min' },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', technique: '', rest: '90 sec' },
        { name: 'Pull-Up', sets: 3, reps: '6-10', technique: '', rest: '2 min' },
      ] },
    }),
  },
];

// Compact numeric input with +/- steppers — used for every set field on the logging screen so
// mobile users get large tap targets instead of a bare text box.
function NumberField({ value, onChange, step = 1, placeholder = '', ariaLabel, min = 0 }) {
  const val = value === undefined || value === null ? '' : value;
  const bump = (delta) => {
    const base = parseFloat(val);
    const start = Number.isFinite(base) ? base : (parseFloat(placeholder) || 0);
    let next = start + delta;
    if (min !== null && next < min) next = min;
    const rounded = Math.round(next * 100) / 100;
    onChange(String(rounded));
  };
  return (
    <div className="flex items-center bg-gray-700 border border-gray-600 rounded-lg overflow-hidden h-11 w-full min-w-0">
      <button
        type="button"
        onClick={() => bump(-step)}
        className="w-7 h-11 flex items-center justify-center text-gray-300 hover:bg-gray-600 active:bg-gray-500 shrink-0"
        aria-label={`Decrease ${ariaLabel || ''}`}
        tabIndex={-1}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={val}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="flex-1 min-w-0 text-center text-base bg-transparent text-gray-100 h-11 px-0.5 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => bump(step)}
        className="w-7 h-11 flex items-center justify-center text-gray-300 hover:bg-gray-600 active:bg-gray-500 shrink-0"
        aria-label={`Increase ${ariaLabel || ''}`}
        tabIndex={-1}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const WorkoutTracker = () => {
  const [view, setView] = useState('calendar');
  const [currentBlock, setCurrentBlock] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [blockMetadata, setBlockMetadata] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedTemplateItem, setExpandedTemplateItem] = useState(null);
  const [selectedExerciseHistory, setSelectedExerciseHistory] = useState(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  
  const [logDate, setLogDate] = useState('');

  const [exercises, setExercises] = useState([]);
  const [prefilled, setPrefilled] = useState(false);
  // Accordion: which exercise card is open on the mobile-first logging screen (null = all collapsed)
  const [expandedExIdx, setExpandedExIdx] = useState(0);

  // Draft autosave (workout-drafts) — tracks unsaved edits to the log currently open
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftBanner, setDraftBanner] = useState(null); // { savedAt } when a restored draft is showing
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [footerTick, setFooterTick] = useState(0); // forces the "N min ago" footer text to refresh
  const openedSnapshotRef = useRef(null); // JSON snapshot of exercises/logDate when the day was opened — dirty-checked against
  const draftDebounceRef = useRef(null);
  const [draggedExIdx, setDraggedExIdx] = useState(null);
  const [dragOverExIdx, setDragOverExIdx] = useState(null);
  const [draggedTemplateEx, setDraggedTemplateEx] = useState(null);
  const [dragOverTemplateEx, setDragOverTemplateEx] = useState(null);
  
  const [blocks, setBlocks] = useState([createEmptyBlock()]);

  const [workoutLogs, setWorkoutLogs] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);


  // Personal Records State
  const [personalRecords, setPersonalRecords] = useState({});
  const [newPRs, setNewPRs] = useState([]);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prTMSaved, setPrTMSaved] = useState({}); // tracks which PR indices saved as TM during modal

  // Training Maxes State
  const [trainingMaxes, setTrainingMaxes] = useState({});
  const [showTMModal, setShowTMModal] = useState(false);
  const [tmModalExercise, setTmModalExercise] = useState('');
  const [tmModalIsNew, setTmModalIsNew] = useState(false); // true = adding new, false = editing existing
  const [tmModalCalcWeight, setTmModalCalcWeight] = useState('');
  const [tmModalCalcReps, setTmModalCalcReps] = useState('');
  const [tmModalTrueRM, setTmModalTrueRM] = useState('');
  const [tmModalPercent, setTmModalPercent] = useState(String(DEFAULT_TM_PERCENT));

  // Training-max suggestions (shown after saving a workout; user confirms before applying)
  const [tmSuggestions, setTmSuggestions] = useState([]);
  const [showTMSuggestModal, setShowTMSuggestModal] = useState(false);
  const [tmSuggestSelected, setTmSuggestSelected] = useState({}); // index -> bool

  // Duplicate-exercise merge tool (Manage Exercises): clusterKey -> chosen keeper name
  const [mergeKeeper, setMergeKeeper] = useState({});

  // Charts State
  const [chartType, setChartType] = useState('e1rm');
  const [tmSectionOpen, setTmSectionOpen] = useState(false);
  const [tmFilter, setTmFilter] = useState('');
  const [manageExOpen, setManageExOpen] = useState(false);

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
  // Manage exercises (rename / delete across all logs + PRs)
  const [exRenameTarget, setExRenameTarget] = useState(null); // name being renamed
  const [exRenameValue, setExRenameValue] = useState('');
  const [exFilter, setExFilter] = useState('');
  const saveTimeoutRef = useRef(null);

  // Rest Timer — global, timestamp-based (not tick-decremented) so it survives backgrounding
  // without drifting, and persisted to localStorage so it survives a refresh.
  const [restDuration, setRestDuration] = useState(90);
  const [restTimer, setRestTimer] = useState(null); // { exIdx, exName, endsAt, running, remainingMs }
  const [restMuted, setRestMuted] = useState(() => {
    try { return localStorage.getItem('rest-timer-muted') === 'true'; } catch { return false; }
  });
  const [restTick, setRestTick] = useState(0); // bumped every second while running, just to force a re-render
  const restAudioCtxRef = useRef(null);

  const ensureRestAudioCtx = () => {
    try {
      if (!restAudioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) restAudioCtxRef.current = new Ctx();
      }
      if (restAudioCtxRef.current && restAudioCtxRef.current.state === 'suspended') {
        restAudioCtxRef.current.resume();
      }
    } catch { /* no audio support — vibrate-only fallback below */ }
  };

  const playRestBeep = () => {
    const ctx = restAudioCtxRef.current;
    if (!ctx || restMuted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch { /* ignore */ }
  };

  // exName/durationSeconds let callers (manual button, auto-start-on-set-complete) label the
  // timer and pick a duration without the timer needing to know about the exercise list.
  const startRestTimer = (exIdx, exName, durationSeconds) => {
    ensureRestAudioCtx();
    const seconds = durationSeconds ?? restDuration;
    setRestTimer({ exIdx, exName, endsAt: Date.now() + seconds * 1000, running: true });
  };

  const pauseResumeRestTimer = () => {
    setRestTimer(prev => {
      if (!prev) return prev;
      if (prev.running) {
        return { ...prev, running: false, remainingMs: Math.max(0, prev.endsAt - Date.now()) };
      }
      return { ...prev, running: true, endsAt: Date.now() + Math.max(0, prev.remainingMs ?? 0) };
    });
  };

  const stopRestTimer = () => {
    setRestTimer(null);
  };

  const adjustRestTimer = (deltaSeconds) => {
    setRestTimer(prev => {
      if (!prev) return prev;
      if (prev.running) {
        return { ...prev, endsAt: prev.endsAt + deltaSeconds * 1000 };
      }
      return { ...prev, remainingMs: Math.max(0, (prev.remainingMs ?? 0) + deltaSeconds * 1000) };
    });
  };

  const adjustRestDuration = (deltaSeconds) => {
    setRestDuration(prev => Math.max(15, prev + deltaSeconds));
  };

  // Parse a template rest string like "2-3 min" or "90 sec" into seconds; null if unparseable ("N/A", empty).
  const parseRestSeconds = (restStr) => {
    if (!restStr) return null;
    const s = String(restStr).toLowerCase();
    const match = s.match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const num = parseFloat(match[1]);
    if (s.includes('sec')) return Math.round(num);
    return Math.round(num * 60); // "min", or no unit — assume minutes
  };

  const restRemainingMs = restTimer
    ? (restTimer.running ? Math.max(0, restTimer.endsAt - Date.now()) : Math.max(0, restTimer.remainingMs ?? 0))
    : 0;
  const restRemainingSeconds = Math.ceil(restRemainingMs / 1000);

  // Migrate PRs from historical workout data
  const migrateHistoricalPRs = (logs) => {
    const migratedPRs = {};

    Object.entries(logs).forEach(([logKey, log]) => {
      if (!log.exercises || !log.date) return;

      log.exercises.forEach(exercise => {
        if (!exercise.name || !exercise.sets) return;

        const exerciseName = exercise.name;
        const exerciseType = exercise.type || 'strength';

        if (!migratedPRs[exerciseName]) {
          migratedPRs[exerciseName] = {};
        }

        if (exerciseType === 'bodyweight') {
          exercise.sets.forEach(set => {
            const reps = parseInt(set.reps);
            const holdTime = parseInt(set.holdTime);

            if (reps && (!migratedPRs[exerciseName].maxReps || reps > migratedPRs[exerciseName].maxReps.value)) {
              migratedPRs[exerciseName].maxReps = { value: reps, date: log.date, logKey };
            }

            if (holdTime && (!migratedPRs[exerciseName].longestHold || holdTime > migratedPRs[exerciseName].longestHold.value)) {
              migratedPRs[exerciseName].longestHold = { value: holdTime, date: log.date, logKey };
            }
          });
        } else if (exerciseType === 'cardio') {
          // Cardio PR migration
          exercise.sets.forEach(set => {
            const distance = parseFloat(set.distance);
            const timeSeconds = parseTimeToSeconds(set.time);

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
                displayValue: formatSecondsToTime(Math.round(paceSeconds)),
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
      const savedBlocks = localStorage.getItem('workout-blocks');
      const savedPRs = localStorage.getItem('personal-records');
      const savedCurrentBlock = localStorage.getItem('current-block');
      const savedBlockMetadata = localStorage.getItem('block-metadata');

      const parsedLogs = logs ? JSON.parse(logs) : {};

      setWorkoutLogs(parsedLogs);
      if (savedBlocks) setBlocks(JSON.parse(savedBlocks));

      const parsedBlock = savedCurrentBlock ? parseInt(savedCurrentBlock) || 1 : 1;
      setCurrentBlock(parsedBlock);
      setCurrentWeek(getLastPopulatedWeek(parsedBlock, parsedLogs));

      if (savedBlockMetadata) {
        setBlockMetadata(JSON.parse(savedBlockMetadata));
      } else {
        // Seed block 1 metadata — infer start date from earliest log if possible
        const block1Dates = Object.entries(parsedLogs)
          .filter(([k]) => k.startsWith('block1-'))
          .map(([, v]) => v.date)
          .filter(Boolean)
          .sort();
        const startDate = block1Dates[0] || new Date().toISOString().split('T')[0];
        const seed = { 1: { name: 'Block 1', startDate } };
        setBlockMetadata(seed);
        localStorage.setItem('block-metadata', JSON.stringify(seed));
      }

      if (Object.keys(parsedLogs).length > 0) {
        const migratedPRs = migrateHistoricalPRs(parsedLogs);
        setPersonalRecords(migratedPRs);
      } else if (savedPRs) {
        setPersonalRecords(JSON.parse(savedPRs));
      }

      const savedTM = localStorage.getItem('training-maxes');
      if (savedTM) setTrainingMaxes(JSON.parse(savedTM));
    } catch (error) {
      console.error('Error loading saved data');
    }
  };

  // Load from Supabase cloud data helper
  const loadFromCloud = (data) => {
    const parsedLogs = data.workout_logs || {};
    setWorkoutLogs(parsedLogs);
    if (data.blocks && Array.isArray(data.blocks)) setBlocks(data.blocks);

    if (data.current_block) setCurrentBlock(data.current_block);
    setCurrentWeek(getLastPopulatedWeek(data.current_block || 1, parsedLogs));

    if (data.block_metadata && Object.keys(data.block_metadata).length > 0) {
      setBlockMetadata(data.block_metadata);
    } else {
      // Seed block 1 metadata from earliest log date
      const block1Dates = Object.entries(parsedLogs)
        .filter(([k]) => k.startsWith('block1-'))
        .map(([, v]) => v.date)
        .filter(Boolean)
        .sort();
      const startDate = block1Dates[0] || new Date().toISOString().split('T')[0];
      setBlockMetadata({ 1: { name: 'Block 1', startDate } });
    }

    if (Object.keys(parsedLogs).length > 0) {
      const migratedPRs = migrateHistoricalPRs(parsedLogs);
      setPersonalRecords(migratedPRs);
    } else {
      setPersonalRecords(data.personal_records || {});
    }

    if (data.training_maxes && Object.keys(data.training_maxes).length > 0) {
      setTrainingMaxes(data.training_maxes);
    }

    // Cache in localStorage
    try {
      localStorage.setItem('workout-logs', JSON.stringify(parsedLogs));
      localStorage.setItem('workout-blocks', JSON.stringify(data.blocks || []));
      localStorage.setItem('personal-records', JSON.stringify(data.personal_records || {}));
      if (data.current_block) localStorage.setItem('current-block', JSON.stringify(data.current_block));
      if (data.block_metadata) localStorage.setItem('block-metadata', JSON.stringify(data.block_metadata));
      if (data.training_maxes) localStorage.setItem('training-maxes', JSON.stringify(data.training_maxes));
    } catch (e) {
      console.error('Error caching to localStorage:', e);
    }
  };

  // Does this browser already have a workout template or logs cached locally?
  // Used to decide whether to show first-run onboarding — never fires for a returning user.
  const hasStoredData = () => {
    try {
      const logs = localStorage.getItem('workout-logs');
      if (logs && Object.keys(JSON.parse(logs)).length > 0) return true;
      if (localStorage.getItem('workout-blocks')) return true;
      return false;
    } catch {
      return false;
    }
  };

  // Load data on mount or when user changes
  React.useEffect(() => {
    const loadData = async () => {
      setDataLoaded(false);
      let hadData = hasStoredData();

      if (user && supabase) {
        try {
          const { data, error } = await supabase
            .from('user_data')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error && error.code === 'PGRST116') {
            // No row exists yet — load local data, it will auto-sync to cloud
            await supabase.from('user_data').insert({ id: user.id });
            loadFromLocalStorage();
          } else if (error) {
            throw error;
          } else {
            // Always prefer cloud data
            const hasCloudData = data.workout_logs && Object.keys(data.workout_logs).length > 0;
            if (hasCloudData) {
              loadFromCloud(data);
              hadData = true;
            } else {
              loadFromLocalStorage();
            }
          }
        } catch (error) {
          // No internet or Supabase error — silently fall back to local
          console.error('Error loading from Supabase:', error);
          loadFromLocalStorage();
        }
      } else {
        // Not logged in - use localStorage
        loadFromLocalStorage();
      }

      setDataLoaded(true);

      // First-run onboarding: only for a browser/account with no template and no logs at all,
      // and only once ever (the flag survives so re-opening the app never re-triggers it).
      if (!hadData && !localStorage.getItem('onboarding-complete')) {
        setShowOnboarding(true);
      }
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

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('training-maxes', JSON.stringify(trainingMaxes));
      } catch (error) {
        console.error('Error saving training maxes:', error);
      }
    }
  }, [trainingMaxes, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('current-block', JSON.stringify(currentBlock));
      } catch (error) {
        console.error('Error saving current block:', error);
      }
    }
  }, [currentBlock, dataLoaded]);

  React.useEffect(() => {
    if (dataLoaded) {
      try {
        localStorage.setItem('block-metadata', JSON.stringify(blockMetadata));
      } catch (error) {
        console.error('Error saving block metadata:', error);
      }
    }
  }, [blockMetadata, dataLoaded]);

  // Debounced save to Supabase
  const upsertToSupabase = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { error } = await supabase
        .from('user_data')
        .upsert({
          id: user.id,
          workout_logs: workoutLogs,
          blocks: blocks,
          personal_records: personalRecords,
          current_block: currentBlock,
          block_metadata: blockMetadata,
          training_maxes: trainingMaxes
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
    }
  }, [user, workoutLogs, blocks, personalRecords, currentBlock, blockMetadata, trainingMaxes]);

  const saveToSupabase = useCallback(() => {
    if (!user || !supabase || !dataLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      upsertToSupabase();
    }, 1000);
  }, [user, dataLoaded, upsertToSupabase]);

  // Trigger Supabase sync when data changes
  React.useEffect(() => {
    saveToSupabase();
  }, [saveToSupabase]);

  // Flush any pending cloud save immediately when the tab is hidden/closed,
  // since the 1s debounce timer can get frozen before it fires on mobile.
  React.useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        upsertToSupabase();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingSave);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingSave);
    };
  }, [upsertToSupabase]);

  // Rest timer tick — re-renders every second while running so the countdown display (computed
  // from endsAt/Date.now() at render time, not decremented here) stays live. Also fires the
  // completion vibrate/beep exactly once, when remaining first reaches zero.
  React.useEffect(() => {
    if (!restTimer || !restTimer.running) return;

    const id = setInterval(() => {
      const remaining = Math.max(0, restTimer.endsAt - Date.now());
      if (remaining <= 0) {
        setRestTimer(prev => (prev && prev.running) ? { ...prev, running: false, remainingMs: 0 } : prev);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        playRestBeep();
      } else {
        setRestTick(t => t + 1);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [restTimer?.running, restTimer?.exIdx, restTimer?.endsAt]);

  // Recompute immediately when the tab regains visibility — setInterval is throttled/paused while
  // backgrounded, but since remaining is derived from a wall-clock timestamp this just needs a nudge.
  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setRestTick(t => t + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Persist the rest timer across refresh/close. Restore it on mount, dropping it if stale (the
  // page was closed for more than 10 minutes) rather than showing a wildly wrong countdown.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('rest-timer');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed._savedAt !== 'number' || Date.now() - parsed._savedAt > 10 * 60 * 1000) {
        localStorage.removeItem('rest-timer');
        return;
      }
      delete parsed._savedAt;
      setRestTimer(parsed);
    } catch { /* ignore malformed/unavailable storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      if (restTimer) {
        localStorage.setItem('rest-timer', JSON.stringify({ ...restTimer, _savedAt: Date.now() }));
      } else {
        localStorage.removeItem('rest-timer');
      }
    } catch { /* ignore quota errors */ }
  }, [restTimer]);

  React.useEffect(() => {
    try { localStorage.setItem('rest-timer-muted', String(restMuted)); } catch { /* ignore */ }
  }, [restMuted]);

  // --- Draft autosave (workout-drafts) ---
  // Everything typed on the logging screen lives only in `exercises` state until Save Workout is
  // pressed. Autosave a debounced draft per logKey so an accidental X / refresh / crash doesn't
  // lose the session; Save Workout deletes the draft for that key once it actually commits.
  const readDrafts = () => {
    try {
      const raw = localStorage.getItem('workout-drafts');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const writeDraftsObject = (drafts) => {
    try { localStorage.setItem('workout-drafts', JSON.stringify(drafts)); } catch { /* quota exceeded — drop silently */ }
  };

  const pruneOldDrafts = (drafts) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const next = {};
    Object.entries(drafts).forEach(([k, v]) => { if (v?.savedAt && v.savedAt >= cutoff) next[k] = v; });
    return next;
  };

  const currentLogKey = selectedDay ? `block${currentBlock}-week${currentWeek}-${selectedDay}` : null;

  const saveDraftNow = () => {
    if (!currentLogKey) return;
    const drafts = pruneOldDrafts(readDrafts());
    const savedAt = Date.now();
    drafts[currentLogKey] = { date: logDate, exercises, savedAt };
    writeDraftsObject(drafts);
    setDraftSavedAt(savedAt);
    setDraftSaving(false);
  };

  const deleteDraft = (logKey) => {
    const drafts = readDrafts();
    if (drafts[logKey]) {
      delete drafts[logKey];
      writeDraftsObject(drafts);
    }
  };

  const timeAgo = (ms) => {
    if (!ms) return 'a moment ago';
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
  };

  // Prune stale drafts once on mount
  React.useEffect(() => {
    writeDraftsObject(pruneOldDrafts(readDrafts()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft write — skipped until the exercises/date actually differ from what the day
  // was opened with, so simply opening and closing a log without editing it writes nothing.
  React.useEffect(() => {
    if (view !== 'log' || !currentLogKey) return;
    const snapshot = JSON.stringify({ exercises, logDate });
    if (openedSnapshotRef.current === null) {
      openedSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === openedSnapshotRef.current) return;

    setDraftSaving(true);
    if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = setTimeout(() => {
      draftDebounceRef.current = null;
      saveDraftNow();
    }, 500);

    return () => {
      if (draftDebounceRef.current) {
        clearTimeout(draftDebounceRef.current);
        draftDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, logDate, view, currentLogKey]);

  // Flush a pending draft write immediately when the tab is hidden/closed — the 500ms debounce
  // can get frozen before it fires on mobile.
  React.useEffect(() => {
    const flushDraft = () => {
      if (draftDebounceRef.current) {
        clearTimeout(draftDebounceRef.current);
        draftDebounceRef.current = null;
        saveDraftNow();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraft();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushDraft);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushDraft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLogKey, logDate, exercises]);

  // Native "leave site?" prompt only while a debounced draft write hasn't landed yet (~500ms window) —
  // switching app tabs (Calendar/Progress/Template) never hits this since it doesn't unload the page.
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (draftDebounceRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Refresh the "N min ago" footer text periodically without re-running the autosave logic
  React.useEffect(() => {
    if (view !== 'log') return;
    const id = setInterval(() => setFooterTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [view]);

  // Accordion defaults to the first exercise expanded whenever a new day's log is opened

  // Accordion defaults to the first exercise expanded whenever a new day's log is opened
  React.useEffect(() => {
    if (view === 'log') setExpandedExIdx(0);
  }, [view, selectedDay]);

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

  // Training Max utility functions
  const roundToNearest2_5 = (w) => Math.round(w / 2.5) * 2.5;

  const deriveTrainingMax = (true1RM, pct) =>
    roundToNearest2_5(parseFloat(true1RM) * parseFloat(pct) / 100);

  const getPercentageWeight = (exerciseName, percentage) => {
    const tm = trainingMaxes[exerciseName];
    if (!tm || !percentage) return null;
    return roundToNearest2_5(tm.trainingMax * percentage / 100);
  };

  // Get the best available 1RM for an exercise (explicit TM > estimated 1RM from PRs)
  const getBest1RM = (exerciseName) => {
    const tm = trainingMaxes[exerciseName];
    if (tm) return tm.true1RM;
    const pr = personalRecords[exerciseName]?.estimated1RM?.value;
    return pr || null;
  };

  // Suggest weight from reps using best available 1RM, returns { weight, pct, source }
  const getSuggestedWeight = (exerciseName, reps) => {
    const pct = repToTMPercent(reps);
    if (!pct) return null;
    const base = getBest1RM(exerciseName);
    if (!base) return null;
    return { weight: roundToNearest2_5(base * pct / 100), pct, source: trainingMaxes[exerciseName] ? 'tm' : 'e1rm' };
  };

  const saveTrainingMax = (exerciseName, true1RM, pct = DEFAULT_TM_PERCENT) => {
    setTrainingMaxes(prev => {
      const existing = prev[exerciseName];
      const prevHistory = existing?.history || [];
      const newHistory = existing
        ? [...prevHistory, { true1RM: existing.true1RM, trainingMax: existing.trainingMax, date: existing.lastUpdated || new Date().toISOString().split('T')[0] }]
        : prevHistory;
      return {
        ...prev,
        [exerciseName]: {
          true1RM: parseFloat(true1RM),
          trainingMaxPercent: parseFloat(pct),
          trainingMax: deriveTrainingMax(true1RM, pct),
          lastUpdated: new Date().toISOString().split('T')[0],
          history: newHistory
        }
      };
    });
  };

  // Rep-to-TM-percentage lookup (standard powerlifting percentage chart)
  const REP_PERCENTAGES = { 1:100, 2:95, 3:92, 4:89, 5:86, 6:83, 7:80, 8:78, 9:76, 10:74, 11:72, 12:70, 15:65, 20:60 };

  const repToTMPercent = (reps) => {
    const r = parseInt(reps);
    if (!r || r < 1) return null;
    if (REP_PERCENTAGES[r] !== undefined) return REP_PERCENTAGES[r];
    const keys = Object.keys(REP_PERCENTAGES).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (r > keys[i] && r < keys[i + 1]) {
        const t = (r - keys[i]) / (keys[i + 1] - keys[i]);
        return Math.round(REP_PERCENTAGES[keys[i]] * (1 - t) + REP_PERCENTAGES[keys[i + 1]] * t);
      }
    }
    return r > 20 ? 55 : null;
  };

  const renameExercise = (oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const n = newName.trim();
    // Rename in all workout logs
    setWorkoutLogs(prev => {
      const updated = {};
      Object.entries(prev).forEach(([key, log]) => {
        updated[key] = {
          ...log,
          exercises: log.exercises?.map(ex =>
            ex.name === oldName ? { ...ex, name: n } : ex
          ) || []
        };
      });
      return updated;
    });
    // Rename in personal records
    setPersonalRecords(prev => {
      if (!prev[oldName]) return prev;
      const updated = { ...prev };
      updated[n] = updated[oldName];
      delete updated[oldName];
      return updated;
    });
    // Rename in training maxes
    setTrainingMaxes(prev => {
      if (!prev[oldName]) return prev;
      const updated = { ...prev };
      updated[n] = updated[oldName];
      delete updated[oldName];
      return updated;
    });
    // Rename in template exercises
    setBlocks(prev => {
      const newBlocks = JSON.parse(JSON.stringify(prev));
      Object.values(newBlocks[0]?.template || {}).forEach(day => {
        day.exercises?.forEach(ex => { if (ex.name === oldName) ex.name = n; });
      });
      return newBlocks;
    });
  };

  const deleteExercise = (name) => {
    setWorkoutLogs(prev => {
      const updated = {};
      Object.entries(prev).forEach(([key, log]) => {
        const filtered = log.exercises?.filter(ex => ex.name !== name) || [];
        updated[key] = { ...log, exercises: filtered };
      });
      return updated;
    });
    setPersonalRecords(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
    setTrainingMaxes(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
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

    if (exerciseType === 'bodyweight') {
      sets.forEach(set => {
        const reps = parseInt(set.reps);
        const holdTime = parseInt(set.holdTime);

        if (reps && (!currentPRs.maxReps || reps > currentPRs.maxReps.value)) {
          prsDetected.push({
            type: 'maxReps',
            exerciseName,
            value: reps,
            previous: currentPRs.maxReps?.value || 0,
            date: logDate
          });
        }

        if (holdTime && (!currentPRs.longestHold || holdTime > currentPRs.longestHold.value)) {
          prsDetected.push({
            type: 'longestHold',
            exerciseName,
            value: holdTime,
            previous: currentPRs.longestHold?.value || 0,
            date: logDate
          });
        }
      });
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
    } else if (exerciseType === 'bodyweight') {
      sets.forEach(set => {
        const reps = parseInt(set.reps);
        const holdTime = parseInt(set.holdTime);

        if (reps && (!updatedPRs.maxReps || reps > updatedPRs.maxReps.value)) {
          updatedPRs.maxReps = { value: reps, date: logDate, logKey };
        }

        if (holdTime && (!updatedPRs.longestHold || holdTime > updatedPRs.longestHold.value)) {
          updatedPRs.longestHold = { value: holdTime, date: logDate, logKey };
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
        } else if (exerciseType === 'bodyweight') {
          if (type === 'reps') {
            value = Math.max(...entry.sets.map(s => parseInt(s.reps) || 0));
          } else if (type === 'holdTime') {
            value = Math.max(...entry.sets.map(s => parseInt(s.holdTime) || 0));
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
          if (type === 'e1rm') {
            // Best estimated 1RM (Epley) across the session's sets
            value = Math.max(...entry.sets.map(s => calculateEstimated1RM(s.weight, s.reps)));
          } else if (type === 'weight') {
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
      blocks,
      personalRecords,
      currentBlock,
      blockMetadata,
      exportDate: new Date().toISOString(),
      version: '2.0'
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

  const importData = (event, onSuccess) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== 'object') {
          alert('Invalid backup file: not a valid JSON object.');
          return;
        }
        if (data.workoutLogs !== undefined && typeof data.workoutLogs !== 'object') {
          alert('Invalid backup file: workoutLogs has unexpected format.');
          return;
        }
        if (data.workoutLogs) setWorkoutLogs(data.workoutLogs);
        if (data.blocks) setBlocks(data.blocks);
        if (data.currentBlock) setCurrentBlock(data.currentBlock);
        if (data.blockMetadata) setBlockMetadata(data.blockMetadata);
        if (data.trainingMaxes && typeof data.trainingMaxes === 'object') setTrainingMaxes(data.trainingMaxes);
        if (data.personalRecords) {
          setPersonalRecords(data.personalRecords);
        } else if (data.workoutLogs) {
          // Backward compatibility: recalculate PRs for old exports
          const migratedPRs = migrateHistoricalPRs(data.workoutLogs);
          setPersonalRecords(migratedPRs);
        }
        alert('Data imported successfully!');
        if (onSuccess) onSuccess();
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

  const handleSetWeek1AsTemplate = () => {
    const allDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const hasData = allDays.some(day =>
      workoutLogs[`block${currentBlock}-week1-${day}`]?.exercises?.length > 0
    );
    if (!hasData) return;
    if (!window.confirm(
      'Use your Week 1 workouts as the template baseline?\n\nThis updates each day\'s exercises and default % of TM. Weekly progressions you\'ve already set are kept.'
    )) return;

    const newBlocks = [...blocks];

    allDays.forEach(day => {
      const log = workoutLogs[`block${currentBlock}-week1-${day}`];
      if (!log?.exercises?.length) return;

      const existingDay = newBlocks[0].template[day] || {
        name: day.charAt(0).toUpperCase() + day.slice(1),
        exercises: []
      };

      const newExercises = log.exercises.map(logEx => {
        const exType = logEx.type || 'strength';
        const existingEx = existingDay.exercises.find(t => t.name === logEx.name);

        let percentage;
        let reps = '';

        if (exType === 'strength') {
          const weights = logEx.sets.map(s => parseFloat(s.weight)).filter(w => w > 0);
          const tmKey = existingEx?.tmLink || logEx.name;
          const tm = trainingMaxes[tmKey];
          if (tm && weights.length > 0) {
            const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
            percentage = Math.round(avg / tm.trainingMax * 100);
          }
          reps = logEx.sets[0]?.reps || '';
        } else if (exType === 'tabata') {
          reps = `${logEx.sets[0]?.rounds || 8} rounds`;
        } else if (exType === 'cardio') {
          const s = logEx.sets[0];
          reps = s?.distance ? `${s.distance} ${s.unit || 'miles'}` : '';
        } else if (exType === 'bodyweight') {
          reps = logEx.sets[0]?.reps || '';
        }

        return {
          name: logEx.name,
          ...(exType !== 'strength' && { type: exType }),
          sets: String(logEx.sets.length),
          reps,
          technique: logEx.technique || existingEx?.technique || '',
          rest: existingEx?.rest || '',
          ...(percentage !== undefined && { percentage }),
          ...(existingEx?.tmLink && { tmLink: existingEx.tmLink }),
          ...(existingEx?.weeklyProgression?.length && { weeklyProgression: existingEx.weeklyProgression }),
        };
      });

      newBlocks[0].template[day] = { ...existingDay, exercises: newExercises };
    });

    setBlocks(newBlocks);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.removeItem('workout-logs');
    localStorage.removeItem('workout-blocks');
    localStorage.removeItem('personal-records');
    localStorage.removeItem('current-block');
    localStorage.removeItem('block-metadata');
    localStorage.removeItem('training-maxes');
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const getCurrentTemplate = () => {
    return blocks[0]?.template || {};
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

  // The 6 most-frequently-logged exercises — the quick-select chips above the Progress trend chart
  const topExerciseNames = useMemo(() => {
    const nameMap = new Map();
    Object.values(workoutLogs).forEach(log => {
      if (log.exercises) {
        log.exercises.forEach(ex => {
          if (ex.name) {
            const key = ex.name.toLowerCase().trim();
            const existing = nameMap.get(key);
            if (existing) existing.count++;
            else nameMap.set(key, { name: ex.name.trim(), count: 1 });
          }
        });
      }
    });
    return Array.from(nameMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(v => v.name);
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

  // Every exercise name known anywhere — logs, training maxes, and the template.
  // Used as the candidate pool for duplicate detection.
  const allKnownExerciseNames = useMemo(() => {
    const seen = new Map(); // lowercase -> display name
    const add = (n) => {
      const name = (n || '').trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    };
    getAllExerciseNames.forEach(add);
    Object.keys(trainingMaxes).forEach(add);
    Object.values(blocks[0]?.template || {}).forEach(day =>
      (day.exercises || []).forEach(ex => add(ex.name))
    );
    return Array.from(seen.values());
  }, [getAllExerciseNames, trainingMaxes, blocks]);

  // Cluster known names into groups of likely-duplicate variations (e.g. "DB Bench" + "Dumbbell Bench Press").
  const duplicateClusters = useMemo(() => {
    const names = allKnownExerciseNames;
    const parent = names.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (i, j) => { parent[find(i)] = find(j); };
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (exerciseSimilarity(names[i], names[j]) >= 0.6) union(i, j);
      }
    }
    const groups = new Map();
    names.forEach((name, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(name);
    });
    // Only clusters with more than one distinct name are duplicates worth flagging.
    return Array.from(groups.values()).filter(g => g.length > 1);
  }, [allKnownExerciseNames]);

  // Build training-max suggestions from the strength exercises just logged.
  // Never writes state — returns a list the user confirms in a modal.
  const buildTMSuggestions = (exerciseList) => {
    const tmKeys = Object.keys(trainingMaxes);
    const suggestions = [];
    const usedKeys = new Set();
    exerciseList.forEach(ex => {
      if ((ex.type || 'strength') !== 'strength' || !ex.name) return;
      // Best estimated 1RM across this exercise's sets.
      let best1RM = 0, bestWeight = 0, bestReps = 0;
      (ex.sets || []).forEach(set => {
        const e1rm = calculateEstimated1RM(set.weight, set.reps);
        if (e1rm > best1RM) { best1RM = e1rm; bestWeight = parseFloat(set.weight); bestReps = parseFloat(set.reps); }
      });
      if (!best1RM) return;

      // Resolve which TM this exercise maps to: exact match, else a similar existing TM (avoids duplicate TM entries).
      let targetKey = tmKeys.find(k => k.toLowerCase().trim() === ex.name.toLowerCase().trim());
      if (!targetKey) {
        const similar = findSimilarExercise(ex.name, tmKeys);
        if (similar) targetKey = similar.name;
      }
      const resolvedKey = targetKey || ex.name;
      if (usedKeys.has(resolvedKey.toLowerCase())) return; // one suggestion per TM per save
      const existing = targetKey ? trainingMaxes[targetKey] : null;
      const pct = existing?.trainingMaxPercent || DEFAULT_TM_PERCENT;

      if (!existing) {
        suggestions.push({ exerciseName: ex.name, targetKey: resolvedKey, isNew: true, currentTrue1RM: null, suggestedTrue1RM: best1RM, pct, weight: bestWeight, reps: bestReps });
        usedKeys.add(resolvedKey.toLowerCase());
      } else if (best1RM > existing.true1RM) {
        suggestions.push({ exerciseName: ex.name, targetKey: resolvedKey, isNew: false, currentTrue1RM: existing.true1RM, suggestedTrue1RM: best1RM, pct, weight: bestWeight, reps: bestReps, matchedByName: targetKey.toLowerCase().trim() !== ex.name.toLowerCase().trim() });
        usedKeys.add(resolvedKey.toLowerCase());
      }
    });
    return suggestions;
  };

  // Merge one or more exercises' entire history into another (relabel logs, recompute PRs, fold TMs & template).
  // fromNames may be a single name or an array; all are folded into toName in one pass.
  const mergeExercises = (fromNames, toName) => {
    const sources = new Set((Array.isArray(fromNames) ? fromNames : [fromNames]).filter(n => n && n !== toName));
    if (!toName || sources.size === 0) return;
    // Relabel logs.
    const newLogs = {};
    Object.entries(workoutLogs).forEach(([key, log]) => {
      newLogs[key] = {
        ...log,
        exercises: (log.exercises || []).map(ex =>
          sources.has(ex.name) ? { ...ex, name: toName } : ex
        )
      };
    });
    setWorkoutLogs(newLogs);
    // Recompute PRs from the merged logs so nothing is lost or double-counted.
    setPersonalRecords(migrateHistoricalPRs(newLogs));
    // Fold training maxes — keep the highest true1RM across the whole cluster.
    setTrainingMaxes(prev => {
      const updated = { ...prev };
      let best = updated[toName] || null;
      sources.forEach(src => {
        const from = updated[src];
        if (from && (!best || from.true1RM > best.true1RM)) best = from;
        delete updated[src];
      });
      if (best) updated[toName] = { ...best };
      return updated;
    });
    // Relabel template exercises.
    setBlocks(prev => {
      const nb = JSON.parse(JSON.stringify(prev));
      Object.values(nb[0]?.template || {}).forEach(day =>
        (day.exercises || []).forEach(ex => {
          if (sources.has(ex.name)) ex.name = toName;
          if (sources.has(ex.tmLink)) ex.tmLink = toName;
        })
      );
      return nb;
    });
  };

  const calculateVolume = (sets) => {
    if (!sets || !Array.isArray(sets)) return 0;
    return sets.reduce((total, set) => {
      const weight = parseFloat(set.weight) || 0;
      const reps = parseFloat(set.reps) || 0;
      return total + (weight * reps);
    }, 0);
  };

  // Total strength volume logged across a block — the "am I progressing" stat tile + block chart
  const getTotalVolumeForBlock = (blockNum) => {
    return Object.entries(workoutLogs)
      .filter(([k]) => k.startsWith(`block${blockNum}-`))
      .reduce((sum, [, log]) => sum + (log.exercises || []).reduce(
        (s, ex) => s + (((ex.type || 'strength') === 'strength') ? calculateVolume(ex.sets) : 0), 0
      ), 0);
  };

  const getSessionsInLastNDays = (days) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Object.values(workoutLogs).filter(log => log.date && new Date(log.date).getTime() >= cutoff).length;
  };

  // Total strength volume per week within a block, for the block volume bar chart
  const getBlockWeeklyVolume = (blockNum) => {
    const weekTotals = {};
    Object.entries(workoutLogs).forEach(([key, log]) => {
      const m = key.match(new RegExp(`^block${blockNum}-week(\\d+)-`));
      if (!m || !log.exercises) return;
      const week = parseInt(m[1]);
      const vol = log.exercises.reduce((s, ex) => s + (((ex.type || 'strength') === 'strength') ? calculateVolume(ex.sets) : 0), 0);
      weekTotals[week] = (weekTotals[week] || 0) + vol;
    });
    return Object.entries(weekTotals)
      .map(([week, volume]) => ({ week: `Wk ${week}`, weekNum: parseInt(week), volume: Math.round(volume) }))
      .sort((a, b) => a.weekNum - b.weekNum);
  };

  const getLastPopulatedWeek = (blockNum, logs) => {
    const regex = new RegExp(`^block${blockNum}-week(\\d+)-`);
    const weeks = Object.keys(logs)
      .map(k => { const m = k.match(regex); return m ? parseInt(m[1]) : null; })
      .filter(Boolean);
    return weeks.length > 0 ? Math.max(...weeks) : 1;
  };

  const getPreviousSession = (exerciseName) => {
    const history = getAllExerciseHistory(exerciseName);
    // Get the most recent session (first item in sorted array)
    return history.length > 0 ? history[0] : null;
  };

  // Returns true if exercise sets contain any entered data (guards type-switch data loss)
  const setsHaveData = (sets, type) => {
    if (!sets || sets.length === 0) return false;
    return sets.some(s => {
      if (type === 'cardio') return (s.distance && String(s.distance).trim()) || (s.time && String(s.time).trim());
      if (type === 'tabata') return s.rounds && String(s.rounds).trim();
      if (type === 'bodyweight') return (s.reps && String(s.reps).trim()) || (s.holdTime && String(s.holdTime).trim());
      return (s.weight && String(s.weight).trim()) || (s.reps && String(s.reps).trim());
    });
  };

  // Parse first number from a reps string like "8-12" or "6" for pre-filling set inputs
  const parseTargetReps = (repsStr) => {
    if (!repsStr) return '';
    const match = String(repsStr).match(/\d+/);
    return match ? match[0] : '';
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

  // Touch-friendly reorder (drag-and-drop doesn't work on touch) — swaps exercise at idx with its neighbor.
  const moveExercise = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= exercises.length) return;
    const newExercises = [...exercises];
    [newExercises[idx], newExercises[targetIdx]] = [newExercises[targetIdx], newExercises[idx]];
    setExercises(newExercises);
    setExpandedExIdx(prev => (prev === idx ? targetIdx : prev === targetIdx ? idx : prev));
  };

  // Opens a day's log: restores an in-progress draft if one exists (unless skipDraft, used by
  // "Start fresh"), else loads the saved log, else prefills from last week or the template.
  const loadDayIntoLogView = (day, { skipDraft = false } = {}) => {
    const logKey = `block${currentBlock}-week${currentWeek}-${day}`;
    setSelectedDay(day);
    openedSnapshotRef.current = null;
    setDraftSavedAt(null); // avoid showing the previous day's "Saved Ns ago" until this one autosaves

    if (!skipDraft) {
      const draft = readDrafts()[logKey];
      if (draft) {
        setLogDate(draft.date || new Date().toISOString().split('T')[0]);
        setExercises(draft.exercises || []);
        setPrefilled(false);
        setDraftBanner({ savedAt: draft.savedAt });
        setDraftSavedAt(draft.savedAt);
        setView('log');
        return;
      }
    }
    setDraftBanner(null);

    const template = getCurrentTemplate();
    const workout = template[day];
    const existingLog = workoutLogs[logKey];

    if (existingLog) {
      setLogDate(existingLog.date);
      setExercises(existingLog.exercises);
      setPrefilled(false);
    } else {
      setLogDate(new Date().toISOString().split('T')[0]);

      // Auto-populate from previous week's same day
      const prevWeekKey = currentWeek > 1
        ? `block${currentBlock}-week${currentWeek - 1}-${day}`
        : null;
      const prevWeekLog = prevWeekKey ? workoutLogs[prevWeekKey] : null;

      if (prevWeekLog && prevWeekLog.exercises && prevWeekLog.exercises.length > 0) {
        const templateExercises = workout?.exercises || [];
        setExercises(prevWeekLog.exercises.map(ex => {
          const exType = ex.type || 'strength';
          const tmplEx = templateExercises.find(t => t.name === ex.name);

          // If template has a weekly progression for this week, use it to set weight
          const weekOverride = tmplEx?.weeklyProgression?.find(w => w.week === currentWeek) ?? null;
          const effectivePct  = weekOverride?.percentage ?? null;
          const effectiveSets = weekOverride?.sets ?? null;
          const effectiveReps = weekOverride?.reps ?? null;

          const tmLookup = tmplEx?.tmLink || ex.name;
          const pctWeight = (effectivePct && exType === 'strength')
            ? getPercentageWeight(tmLookup, effectivePct)
            : null;
          const targetReps = effectiveReps ? parseTargetReps(effectiveReps) : null;

          return {
            name: ex.name,
            type: exType,
            technique: ex.technique,
            templateTarget: (effectiveSets && effectiveReps)
              ? `${effectiveSets}×${effectiveReps}`
              : (tmplEx ? `${tmplEx.sets}×${tmplEx.reps}` : null),
            templatePercentage: effectivePct || tmplEx?.percentage || null,
            templateReps: effectiveReps || tmplEx?.reps || null,
            templateRest: tmplEx?.rest || null,
            tmLink: tmplEx?.tmLink || null,
            sets: ex.sets.map(s =>
              exType === 'bodyweight'
                ? { reps: s.reps || '', holdTime: s.holdTime || '' }
                : exType === 'cardio'
                  ? { distance: s.distance || '', time: s.time || '', unit: s.unit || 'miles' }
                  : exType === 'tabata'
                    ? { rounds: s.rounds || '', workSeconds: s.workSeconds || '20', restSeconds: s.restSeconds || '10', calories: s.calories || '' }
                    : {
                        weight: pctWeight ? String(pctWeight) : (s.weight || ''),
                        reps: targetReps || s.reps || '',
                        ...(pctWeight ? { weightSource: 'tm-pct' } : {})
                      }
            ),
            notes: ex.notes || ''
          };
        }));
        setPrefilled(true);
      } else {
        setExercises(workout?.exercises.map(ex => {
          const exType = ex.type || 'strength';

          // Apply weekly progression override if one exists for currentWeek
          const weekOverride = ex.weeklyProgression?.find(w => w.week === currentWeek) ?? null;
          const effectivePct  = weekOverride?.percentage  ?? ex.percentage;
          const effectiveSets = weekOverride?.sets        ?? ex.sets;
          const effectiveReps = weekOverride?.reps        ?? ex.reps;

          // Auto-fill weight from % of TM (use tmLink if set)
          const tmLookup = ex.tmLink || ex.name;
          const pctWeight = (effectivePct && exType === 'strength')
            ? getPercentageWeight(tmLookup, effectivePct)
            : null;
          const targetReps = parseTargetReps(effectiveReps);
          return {
            name: ex.name,
            type: exType,
            technique: ex.technique,
            templateTarget: (effectiveSets && effectiveReps) ? `${effectiveSets}×${effectiveReps}` : null,
            templatePercentage: effectivePct || null,
            templateReps: effectiveReps || null,
            templateRest: ex.rest || null,
            tmLink: ex.tmLink || null,
            sets: Array(parseInt(effectiveSets) || 3).fill(null).map(() => ({
              weight: pctWeight ? String(pctWeight) : '',
              reps: targetReps,
              weightSource: pctWeight ? 'tm-pct' : 'manual'
            })),
            notes: ''
          };
        }) || []);
        setPrefilled(false);
      }
    }
    setView('log');
  };

  // Best available fill for a set's empty fields when it's marked complete: the previous set in
  // this exercise, then the template target/%TM, then the matching set from the last session.
  const prefillSetOnComplete = (exercise, setIdx, previousSession) => {
    const type = exercise.type || 'strength';
    const set = exercise.sets[setIdx];
    const prevSetInExercise = setIdx > 0 ? exercise.sets[setIdx - 1] : null;
    const prevSessionSet = previousSession?.sets?.[setIdx] || null;
    const filled = { ...set };

    if (type === 'bodyweight') {
      if (!filled.reps) filled.reps = prevSetInExercise?.reps || parseTargetReps(exercise.templateReps) || prevSessionSet?.reps || '';
      if (!filled.holdTime) filled.holdTime = prevSetInExercise?.holdTime || prevSessionSet?.holdTime || '';
    } else if (type === 'cardio') {
      if (!filled.distance) filled.distance = prevSetInExercise?.distance || prevSessionSet?.distance || '';
      if (!filled.time) filled.time = prevSetInExercise?.time || prevSessionSet?.time || '';
    } else if (type === 'tabata') {
      if (!filled.rounds) filled.rounds = prevSetInExercise?.rounds || prevSessionSet?.rounds || '';
    } else {
      if (!filled.weight) {
        const tmLookup = exercise.tmLink || exercise.name;
        const pctWeight = exercise.templatePercentage ? getPercentageWeight(tmLookup, exercise.templatePercentage) : null;
        filled.weight = prevSetInExercise?.weight || (pctWeight ? String(pctWeight) : '') || prevSessionSet?.weight || '';
      }
      if (!filled.reps) {
        filled.reps = prevSetInExercise?.reps || parseTargetReps(exercise.templateReps) || prevSessionSet?.reps || '';
      }
    }
    return filled;
  };

  // Toggles a set's completed flag. Completing a set prefills empty fields, auto-starts the rest
  // timer (using the exercise's template rest if it parses, else the user's default duration),
  // and — once every set in the card is done — auto-advances the accordion to the next exercise
  // that still has incomplete sets (unless the user is mid-typing in a field).
  const toggleSetCompleted = (exIdx, setIdx) => {
    const newExercises = [...exercises];
    const exercise = { ...newExercises[exIdx], sets: [...newExercises[exIdx].sets] };
    const set = exercise.sets[setIdx];
    const nowCompleting = !set.completed;

    if (nowCompleting) {
      const previousSession = getPreviousSession(exercise.name);
      exercise.sets[setIdx] = { ...prefillSetOnComplete(exercise, setIdx, previousSession), completed: true };
    } else {
      exercise.sets[setIdx] = { ...set, completed: false };
    }
    newExercises[exIdx] = exercise;
    setExercises(newExercises);

    if (nowCompleting) {
      const restSeconds = parseRestSeconds(exercise.templateRest) || restDuration;
      startRestTimer(exIdx, exercise.name, restSeconds);

      const cardFullyDone = exercise.sets.every(s => s.completed);
      const isTyping = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (cardFullyDone && !isTyping) {
        const nextIdx = newExercises.findIndex((ex, i) => i > exIdx && ex.sets.some(s => !s.completed));
        if (nextIdx !== -1) setExpandedExIdx(nextIdx);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-gray-900 min-h-screen overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-2">Workout Tracker</h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm md:text-base">Periodized training with progression tracking</p>
          <div className="flex items-center gap-2">
            {!authLoading && supabase && (
              user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden md:inline">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors"
                    title="Sign out of cloud sync"
                  >
                    <LogOut className="w-3 h-3" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                  title="Sign in to sync data across devices"
                >
                  <LogIn className="w-3 h-3" />
                  Login
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-gray-800 rounded-xl border border-gray-700">
        <button
          onClick={() => setView('calendar')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base font-medium rounded-lg transition-colors ${
            view === 'calendar'
              ? 'bg-gray-700 text-emerald-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Calendar
        </button>
        <button
          onClick={() => setView('progress')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base font-medium rounded-lg transition-colors ${
            view === 'progress'
              ? 'bg-gray-700 text-emerald-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Progress
        </button>
        <button
          onClick={() => setView('template')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base font-medium rounded-lg transition-colors ${
            view === 'template'
              ? 'bg-gray-700 text-emerald-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Settings className="w-4 h-4" />
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
                  <p className="text-sm text-gray-400">Workouts (Block)</p>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">
                    {Object.keys(workoutLogs).filter(k => k.startsWith(`block${currentBlock}`)).length}
                  </p>
                </div>
                <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Current Week</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{currentWeek}</p>
                </div>
                <div className="p-4 bg-purple-950/30 border border-purple-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Volume (Block)</p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-400">
                    {Math.round(getTotalVolumeForBlock(currentBlock)).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Sessions (7d)</p>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">
                    {getSessionsInLastNDays(7)}
                  </p>
                </div>
              </div>
            </div>

            {/* Exercise Trend — the hero chart: pick a frequently-logged exercise or search for one */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Exercise Trend
              </h3>

              {Object.keys(workoutLogs).length === 0 ? (
                <p className="text-gray-400 text-sm">Log a few workouts to see trends here.</p>
              ) : (
                <>
                  {topExerciseNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {topExerciseNames.map(name => (
                        <button
                          key={name}
                          onClick={() => setSelectedExerciseHistory(name)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            selectedExerciseHistory === name
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Search for another exercise..."
                    value={exerciseSearchTerm}
                    onChange={(e) => setExerciseSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 mb-1 placeholder-gray-500 text-sm"
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
                      <div className="space-y-2 max-h-96 overflow-y-auto mt-2">
                        {Array.from(allExercises).map(exerciseName => {
                          const hist = getAllExerciseHistory(exerciseName);
                          const isStrength = hist.length > 0 && (hist[0].type || 'strength') === 'strength';
                          const e1rmSeries = isStrength ? getExerciseProgressionData(exerciseName, 'e1rm') : [];
                          return (
                            <button
                              key={exerciseName}
                              onClick={() => { setSelectedExerciseHistory(exerciseName); setExerciseSearchTerm(''); }}
                              className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors"
                            >
                              <p className="font-medium text-gray-100">{exerciseName}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {hist.length} session{hist.length !== 1 ? 's' : ''}
                                {e1rmSeries.length >= 2 && (
                                  <> · e1RM {e1rmSeries[0].value} → <span className="text-emerald-400">{e1rmSeries[e1rmSeries.length - 1].value}</span></>
                                )}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm mt-2">No exercises found matching "{exerciseSearchTerm}"</p>
                    );
                  })()}
                </>
              )}

              {selectedExerciseHistory && (
                <div className="mt-4 pt-4 border-t border-gray-700">
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

                  if (exerciseType === 'bodyweight') {
                    return (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setChartType('reps')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            chartType === 'reps'
                              ? 'bg-violet-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Reps
                        </button>
                        <button
                          onClick={() => setChartType('holdTime')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            chartType === 'holdTime'
                              ? 'bg-violet-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Hold Time
                        </button>
                      </div>
                    );
                  }

                  if (exerciseType === 'cardio') {
                    return (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setChartType('distance')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            chartType === 'distance'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Distance
                        </button>
                        <button
                          onClick={() => setChartType('pace')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            chartType === 'pace'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Pace
                        </button>
                        <button
                          onClick={() => setChartType('duration')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
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
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            chartType === 'rounds'
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Rounds
                        </button>
                        <button
                          onClick={() => setChartType('sets')}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
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
                        onClick={() => setChartType('e1rm')}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          chartType === 'e1rm'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        title="Estimated one-rep max (Epley formula) from the best set of each session"
                      >
                        e1RM
                      </button>
                      <button
                        onClick={() => setChartType('weight')}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          chartType === 'weight'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Top Set
                      </button>
                      <button
                        onClick={() => setChartType('volume')}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          chartType === 'volume'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Volume
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
                          <button
                            onClick={() => {
                              setTmModalExercise(selectedExerciseHistory);
                              setTmModalIsNew(!trainingMaxes[selectedExerciseHistory]);
                              setTmModalTrueRM(String(personalRecords[selectedExerciseHistory].estimated1RM.value));
                              setTmModalPercent(String(trainingMaxes[selectedExerciseHistory]?.trainingMaxPercent || DEFAULT_TM_PERCENT));
                              setTmModalCalcWeight('');
                              setTmModalCalcReps('');
                              setShowTMModal(true);
                            }}
                            className="mt-2 w-full text-xs py-1 px-2 bg-purple-700/40 hover:bg-purple-700/60 text-purple-300 rounded-lg border border-purple-700/50"
                          >
                            {trainingMaxes[selectedExerciseHistory] ? 'Update Training Max' : 'Set as Training Max'}
                          </button>
                        </div>
                      )}
                      {/* Bodyweight PRs */}
                      {personalRecords[selectedExerciseHistory].maxReps && !personalRecords[selectedExerciseHistory].maxWeight && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Max Reps</div>
                          <div className="text-lg font-bold text-violet-400">
                            {personalRecords[selectedExerciseHistory].maxReps.value} reps
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].maxReps.date}
                          </div>
                        </div>
                      )}
                      {personalRecords[selectedExerciseHistory].longestHold && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Longest Hold</div>
                          <div className="text-lg font-bold text-violet-400">
                            {personalRecords[selectedExerciseHistory].longestHold.value}s
                          </div>
                          <div className="text-xs text-gray-500">
                            {personalRecords[selectedExerciseHistory].longestHold.date}
                          </div>
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
                              if (chartType === 'e1rm') {
                                return [`${value} lb`, 'Est. 1RM'];
                              } else if (chartType === 'volume') {
                                return [`${value.toLocaleString()} lb`, 'Volume'];
                              } else if (chartType === 'weight') {
                                return [`${value} lb`, 'Top Set'];
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

                {(() => {
                  const history = getAllExerciseHistory(selectedExerciseHistory);
                  const exerciseType = history.length > 0 ? (history[0].type || 'strength') : 'strength';
                  const strengthHistory = exerciseType === 'strength'
                    ? history.map(e => calculateVolume(e.sets)).filter(v => v > 0)
                    : [];
                  const firstVol = strengthHistory.length > 0 ? strengthHistory[strengthHistory.length - 1] : null;
                  const bestVol = strengthHistory.length > 0 ? Math.max(...strengthHistory) : null;
                  const volGrowth = firstVol && bestVol && firstVol > 0
                    ? Math.round((bestVol - firstVol) / firstVol * 100)
                    : null;
                  return (
                    <>
                      {firstVol !== null && (
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-750 border border-gray-700 rounded-lg text-xs text-gray-400 mb-3">
                          <span>Volume</span>
                          <span className="text-gray-300">First: <span className="text-white font-medium">{firstVol.toLocaleString()} lbs</span></span>
                          <span className="text-gray-600">→</span>
                          <span className="text-gray-300">Best: <span className="text-emerald-400 font-medium">{bestVol.toLocaleString()} lbs</span></span>
                          {volGrowth !== null && (
                            <span className={volGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              ({volGrowth >= 0 ? '+' : ''}{volGrowth}%)
                            </span>
                          )}
                        </div>
                      )}
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {history.map((entry, idx) => {
                          const entryType = entry.type || 'strength';
                          return (
                            <div key={idx} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-100">
                                  {formatDate(entry.date)}
                                </span>
                                <ExerciseTypeBadge type={entryType} />
                              </div>
                              <div className="space-y-1">
                                {entry.sets && entry.sets.map((set, setIdx) => (
                                  <div key={setIdx} className="text-sm text-gray-300">
                                    {entryType === 'cardio' ? (
                                      <>
                                        Entry {setIdx + 1}: {set.distance ? `${set.distance} ${set.unit || 'mi'} in ${set.time}` : 'Not logged'}
                                        {set.distance && set.time && (
                                          <span className="text-cyan-400 ml-2">
                                            ({calculatePace(parseTimeToSeconds(set.time), parseFloat(set.distance))}/{set.unit === 'km' ? 'km' : 'mi'})
                                          </span>
                                        )}
                                      </>
                                    ) : entryType === 'tabata' ? (
                                      <>
                                        Set {setIdx + 1}: {set.rounds ? `${set.rounds} rounds @ ${set.workSeconds || '20'}s/${set.restSeconds || '10'}s${set.calories ? ` • ${set.calories} kcal` : ''}` : 'Not logged'}
                                      </>
                                    ) : entryType === 'bodyweight' ? (
                                      <>
                                        Set {setIdx + 1}: {set.reps || set.holdTime ? `${set.reps ? `${set.reps} reps` : ''}${set.reps && set.holdTime ? ' • ' : ''}${set.holdTime ? `${set.holdTime}s hold` : ''}` : 'Not logged'}
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
                    </>
                  );
                })()}
                </div>
              )}
            </div>

            {/* Block volume — total strength volume per week for the current block */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-3">Block Volume by Week</h3>
              {(() => {
                const weeklyVolume = getBlockWeeklyVolume(currentBlock);
                if (weeklyVolume.length < 2) {
                  return (
                    <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 text-center text-gray-400 text-sm">
                      Log 2+ weeks of strength training to see a trend
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                        formatter={(value) => [`${value.toLocaleString()} lb`, 'Volume']}
                      />
                      <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            {/* Training Maxes — collapsed by default, this is admin/reference not a trend */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <button
                onClick={() => setTmSectionOpen(o => !o)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-gray-100 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-purple-400" />
                  Training Maxes ({Object.keys(trainingMaxes).length})
                </h3>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${tmSectionOpen ? 'rotate-180' : ''}`} />
              </button>
              {tmSectionOpen && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <input
                      type="text"
                      placeholder="Filter training maxes..."
                      value={tmFilter}
                      onChange={e => setTmFilter(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm placeholder-gray-500"
                    />
                    <button
                      onClick={() => {
                        setTmModalExercise('');
                        setTmModalIsNew(true);
                        setTmModalTrueRM('');
                        setTmModalPercent(String(DEFAULT_TM_PERCENT));
                        setTmModalCalcWeight('');
                        setTmModalCalcReps('');
                        setShowTMModal(true);
                      }}
                      className="text-xs px-3 py-2 bg-purple-700/40 hover:bg-purple-700/60 text-purple-300 rounded-lg border border-purple-700/50 flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {Object.keys(trainingMaxes).length === 0 ? (
                    <p className="text-gray-400 text-sm">No training maxes set. Select an exercise with an Est. 1RM and click "Set as Training Max".</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-2">
                      {Object.entries(trainingMaxes)
                        .filter(([name]) => name.toLowerCase().includes(tmFilter.toLowerCase()))
                        .map(([name, tm]) => {
                          const startTM = tm.history && tm.history.length > 0 ? tm.history[0].trainingMax : null;
                          const delta = startTM !== null ? Math.round((tm.trainingMax - startTM) * 10) / 10 : null;
                          return (
                            <div key={name} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-100 text-sm truncate">{name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  1RM: {tm.true1RM} lb · {tm.trainingMaxPercent}% →{' '}
                                  <span className="text-purple-300 font-medium">TM: {tm.trainingMax} lb</span>
                                </p>
                                {delta !== null && delta !== 0 && (
                                  <p className={`text-xs mt-0.5 font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {delta > 0 ? '+' : ''}{delta} lb since {tm.history[0].date}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500">Updated {tm.lastUpdated}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setTmModalExercise(name);
                                  setTmModalIsNew(false);
                                  setTmModalTrueRM(String(tm.true1RM));
                                  setTmModalPercent(String(tm.trainingMaxPercent));
                                  setTmModalCalcWeight('');
                                  setTmModalCalcReps('');
                                  setShowTMModal(true);
                                }}
                                className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors shrink-0"
                                title="Edit training max"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manage Exercises — admin, not progress, so it lives collapsed at the bottom */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <button
                onClick={() => setManageExOpen(o => !o)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-gray-100 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-gray-400" />
                  Manage Exercises
                </h3>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${manageExOpen ? 'rotate-180' : ''}`} />
              </button>
              {manageExOpen && (
                <div className="mt-3">
                  {/* Possible duplicates — clusters of similarly-named exercises that can be merged */}
                  {duplicateClusters.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg">
                      <p className="text-xs font-semibold text-amber-300 mb-2">
                        Possible duplicates ({duplicateClusters.length}) — pick the name to keep, then merge.
                      </p>
                      <div className="space-y-3">
                        {duplicateClusters.map(cluster => {
                          const clusterKey = [...cluster].sort().join('|');
                          // Default keeper: a training-max entry if one exists, else the most descriptive (longest) name.
                          const defaultKeeper = cluster.find(n => trainingMaxes[n])
                            || [...cluster].sort((a, b) => b.length - a.length)[0];
                          const keeper = mergeKeeper[clusterKey] || defaultKeeper;
                          return (
                            <div key={clusterKey} className="p-2 bg-gray-900/40 rounded-lg">
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {cluster.map(n => (
                                  <button
                                    key={n}
                                    onClick={() => setMergeKeeper(prev => ({ ...prev, [clusterKey]: n }))}
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                      n === keeper
                                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                    title={n === keeper ? 'Keeping this name' : 'Click to keep this name'}
                                  >
                                    {n === keeper && '✓ '}{n}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  const others = cluster.filter(n => n !== keeper);
                                  if (window.confirm(`Merge ${others.map(n => `"${n}"`).join(', ')} into "${keeper}"? History and PRs will be combined under "${keeper}".`)) {
                                    mergeExercises(others, keeper);
                                    setMergeKeeper(prev => { const c = { ...prev }; delete c[clusterKey]; return c; });
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium"
                              >
                                Merge into "{keeper}"
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {getAllExerciseNames.length === 0 ? (
                    <p className="text-gray-400 text-sm">No exercises logged yet.</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Filter exercises..."
                        value={exFilter}
                        onChange={e => setExFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm mb-3 placeholder-gray-500"
                      />
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {getAllExerciseNames
                          .filter(n => n.toLowerCase().includes(exFilter.toLowerCase()))
                          .map(name => (
                            <div key={name} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700/50 group">
                              {exRenameTarget === name ? (
                                <>
                                  <input
                                    type="text"
                                    value={exRenameValue}
                                    onChange={e => setExRenameValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { renameExercise(name, exRenameValue); setExRenameTarget(null); }
                                      if (e.key === 'Escape') setExRenameTarget(null);
                                    }}
                                    autoFocus
                                    className="flex-1 px-2 py-1 bg-gray-600 border border-purple-500 rounded-lg text-gray-100 text-sm"
                                  />
                                  <button
                                    onClick={() => { renameExercise(name, exRenameValue); setExRenameTarget(null); }}
                                    className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                  >Save</button>
                                  <button
                                    onClick={() => setExRenameTarget(null)}
                                    className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg"
                                  >Cancel</button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 text-sm text-gray-200">{name}</span>
                                  <button
                                    onClick={() => { setExRenameTarget(name); setExRenameValue(name); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-200 transition-opacity"
                                    title="Rename"
                                  ><Edit3 className="w-3.5 h-3.5" /></button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete all history for "${name}"? This removes it from all logs and PRs.`))
                                        deleteExercise(name);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                                    title="Delete"
                                  ><Trash2 className="w-3.5 h-3.5" /></button>
                                </>
                              )}
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

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
                  <label className="text-xs text-gray-400 block mb-2">Training Cycle Name (Block {currentBlock})</label>
                  <input
                    type="text"
                    value={blockMetadata[currentBlock]?.name || ''}
                    onChange={(e) => {
                      setBlockMetadata({
                        ...blockMetadata,
                        [currentBlock]: {
                          ...blockMetadata[currentBlock],
                          name: e.target.value
                        }
                      });
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                    placeholder={`e.g., Spring 2025 Hypertrophy`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Number of Weeks</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={blocks[0]?.weeks || 4}
                    onChange={(e) => {
                      const newBlocks = [...blocks];
                      newBlocks[0].weeks = parseInt(e.target.value) || 4;
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
                    const template = newBlocks[0].template;
                    const existingDays = Object.keys(template);
                    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    const availableDays = allDays.filter(d => !existingDays.includes(d));
                    if (availableDays.length > 0) {
                      template[availableDays[0]] = { name: 'New Workout', exercises: [] };
                      setBlocks(newBlocks);
                    }
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Day
                </button>
              </div>

              <div className="grid gap-3">
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
                  .filter(d => blocks[0]?.template[d])
                  .map(dayKey => {
                    const dayData = blocks[0].template[dayKey];
                    return (
                      <div key={dayKey} className="p-4 rounded-lg border border-gray-700 bg-gray-800">

                        {/* Day header — mirrors calendar card */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-100">
                              {dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}
                            </h3>
                            <input
                              type="text"
                              value={dayData.name}
                              onChange={(e) => {
                                const newBlocks = [...blocks];
                                newBlocks[0].template[dayKey].name = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              className="text-sm text-gray-400 bg-transparent border-none outline-none mt-0.5 w-full"
                              placeholder="Workout name"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)} from template?`)) {
                                const newBlocks = [...blocks];
                                delete newBlocks[0].template[dayKey];
                                setBlocks(newBlocks);
                              }
                            }}
                            className="ml-3 p-2 text-red-400 hover:bg-red-600/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Exercise list */}
                        <div className="space-y-2">
                          {dayData.exercises.length === 0 && (
                            <p className="text-sm text-gray-500 italic py-2">
                              No exercises yet — add your first exercise below.
                            </p>
                          )}
                          {dayData.exercises.map((exercise, exIdx) => {
                            const itemKey = `${dayKey}-${exIdx}`;
                            const isExpanded = expandedTemplateItem === itemKey;
                            return (
                              <div
                                key={exIdx}
                                draggable
                                onDragStart={() => setDraggedTemplateEx({ dayKey, exIdx })}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedTemplateEx?.dayKey === dayKey) setDragOverTemplateEx({ dayKey, exIdx });
                                }}
                                onDragLeave={() => setDragOverTemplateEx(null)}
                                onDrop={() => {
                                  if (!draggedTemplateEx || draggedTemplateEx.dayKey !== dayKey || draggedTemplateEx.exIdx === exIdx) {
                                    setDraggedTemplateEx(null);
                                    setDragOverTemplateEx(null);
                                    return;
                                  }
                                  const newBlocks = [...blocks];
                                  const exList = newBlocks[0].template[dayKey].exercises;
                                  const [moved] = exList.splice(draggedTemplateEx.exIdx, 1);
                                  exList.splice(exIdx, 0, moved);
                                  setBlocks(newBlocks);
                                  setDraggedTemplateEx(null);
                                  setDragOverTemplateEx(null);
                                }}
                                onDragEnd={() => { setDraggedTemplateEx(null); setDragOverTemplateEx(null); }}
                                className={`bg-gray-900/50 rounded-lg border p-3 transition-all ${
                                  draggedTemplateEx?.dayKey === dayKey && draggedTemplateEx.exIdx === exIdx
                                    ? 'opacity-40 border-gray-500'
                                    : dragOverTemplateEx?.dayKey === dayKey && dragOverTemplateEx.exIdx === exIdx
                                    ? 'border-blue-500'
                                    : 'border-gray-600'
                                }`}
                              >

                                {/* Exercise name row + Edit toggle + remove */}
                                <div className="flex items-center gap-2 mb-2">
                                  <GripVertical size={16} className="text-gray-500 cursor-grab flex-shrink-0" title="Drag to reorder" />
                                  <input
                                    type="text"
                                    value={exercise.name}
                                    onChange={(e) => {
                                      const newBlocks = [...blocks];
                                      newBlocks[0].template[dayKey].exercises[exIdx].name = e.target.value;
                                      setBlocks(newBlocks);
                                    }}
                                    className="flex-1 text-sm font-medium text-gray-100 bg-transparent border-none outline-none"
                                    placeholder="Exercise name"
                                  />
                                  <button
                                    onClick={() => setExpandedTemplateItem(isExpanded ? null : itemKey)}
                                    className="text-xs text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded bg-gray-700/50 shrink-0"
                                  >
                                    {isExpanded ? 'Done' : 'Edit'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!window.confirm(`Remove "${exercise.name || 'this exercise'}" from the template?`)) return;
                                      const newBlocks = [...blocks];
                                      newBlocks[0].template[dayKey].exercises = dayData.exercises.filter((_, i) => i !== exIdx);
                                      setBlocks(newBlocks);
                                    }}
                                    className="text-red-400 hover:bg-red-600/20 rounded p-0.5 shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Advanced fields — only shown when expanded */}
                                {isExpanded && (
                                  <div className="mb-3 space-y-2">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                      <div>
                                        <label className="text-xs text-gray-500">Sets</label>
                                        <input
                                          type="text"
                                          value={exercise.sets}
                                          onChange={(e) => {
                                            const newBlocks = [...blocks];
                                            newBlocks[0].template[dayKey].exercises[exIdx].sets = e.target.value;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
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
                                            newBlocks[0].template[dayKey].exercises[exIdx].reps = e.target.value;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
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
                                            newBlocks[0].template[dayKey].exercises[exIdx].technique = e.target.value;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
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
                                            newBlocks[0].template[dayKey].exercises[exIdx].rest = e.target.value;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                                          placeholder="2-3 min"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-500 flex items-center gap-1" title="Percentage of Training Max — auto-fills weight when you open this workout">% of TM</label>
                                        <input
                                          type="number"
                                          min="50"
                                          max="110"
                                          placeholder="—"
                                          value={exercise.percentage || ''}
                                          onChange={(e) => {
                                            const newBlocks = [...blocks];
                                            const val = e.target.value;
                                            newBlocks[0].template[dayKey].exercises[exIdx].percentage = val ? parseInt(val) : undefined;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                                        />
                                        {(() => {
                                          const tmKey = exercise.tmLink || exercise.name;
                                          const tm = trainingMaxes[tmKey];
                                          if (exercise.percentage && tm) return <p className="text-xs text-purple-400 mt-1">= {getPercentageWeight(tmKey, exercise.percentage)} lb</p>;
                                          if (exercise.percentage && !tm) return <p className="text-xs text-gray-500 mt-1">No TM set</p>;
                                          return null;
                                        })()}
                                      </div>
                                    </div>
                                    {Object.keys(trainingMaxes).length > 0 && (
                                      <div>
                                        <label className="text-xs text-gray-500" title="Link this exercise to a specific Training Max for % auto-fill and live % display">Linked TM</label>
                                        <select
                                          value={exercise.tmLink || ''}
                                          onChange={(e) => {
                                            const newBlocks = [...blocks];
                                            const val = e.target.value;
                                            newBlocks[0].template[dayKey].exercises[exIdx].tmLink = val || undefined;
                                            setBlocks(newBlocks);
                                          }}
                                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm mt-1"
                                        >
                                          <option value="">— match by name —</option>
                                          {Object.keys(trainingMaxes).map(name => (
                                            <option key={name} value={name}>{name} ({trainingMaxes[name].trainingMax} lb)</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Weekly progression — always visible */}
                                <div className={isExpanded ? 'mt-3 pt-3 border-t border-gray-700/50' : ''}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-gray-400">Weekly progression</span>
                                    <button
                                      onClick={() => {
                                        const newBlocks = [...blocks];
                                        const prog = newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression || [];
                                        const nextWeek = prog.length > 0 ? Math.max(...prog.map(p => p.week)) + 1 : 1;
                                        prog.push({ week: nextWeek, percentage: exercise.percentage || '', sets: exercise.sets || 3, reps: exercise.reps || '' });
                                        newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression = [...prog];
                                        setBlocks(newBlocks);
                                      }}
                                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                                    >
                                      <Plus className="w-3 h-3" /> Add week
                                    </button>
                                  </div>
                                  {(exercise.weeklyProgression || []).length > 0 && (
                                    <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_auto_auto] gap-x-2 gap-y-1 text-xs mb-1">
                                      <span />
                                      <span className="text-gray-500">% of TM</span>
                                      <span className="text-gray-500">Sets</span>
                                      <span className="text-gray-500">Reps</span>
                                      <span className="text-gray-500">Weight</span>
                                      <span />
                                    </div>
                                  )}
                                  {(exercise.weeklyProgression || []).map((entry, wIdx) => (
                                    <div key={wIdx} className="grid grid-cols-[2.5rem_1fr_1fr_1fr_auto_auto] items-center gap-x-2 gap-y-1 mb-1.5 text-xs">
                                      <span className="text-gray-500">Wk {entry.week}</span>
                                      <input
                                        type="number"
                                        value={entry.percentage}
                                        placeholder="—"
                                        inputMode="decimal"
                                        onChange={(e) => {
                                          const newBlocks = [...blocks];
                                          newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression[wIdx].percentage = e.target.value ? parseFloat(e.target.value) : '';
                                          setBlocks(newBlocks);
                                        }}
                                        className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                                      />
                                      <input
                                        type="text"
                                        value={entry.sets}
                                        placeholder="—"
                                        inputMode="decimal"
                                        onChange={(e) => {
                                          const newBlocks = [...blocks];
                                          newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression[wIdx].sets = e.target.value;
                                          setBlocks(newBlocks);
                                        }}
                                        className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                                      />
                                      <input
                                        type="text"
                                        value={entry.reps}
                                        placeholder="—"
                                        onChange={(e) => {
                                          const newBlocks = [...blocks];
                                          newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression[wIdx].reps = e.target.value;
                                          setBlocks(newBlocks);
                                        }}
                                        className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                                      />
                                      <span className="text-purple-400 whitespace-nowrap">
                                        {(() => {
                                          const tmKey = exercise.tmLink || exercise.name;
                                          const w = getPercentageWeight(tmKey, entry.percentage);
                                          return w ? `${w} lb` : '—';
                                        })()}
                                      </span>
                                      <button
                                        onClick={() => {
                                          const newBlocks = [...blocks];
                                          newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression =
                                            newBlocks[0].template[dayKey].exercises[exIdx].weeklyProgression.filter((_, i) => i !== wIdx);
                                          setBlocks(newBlocks);
                                        }}
                                        className="text-red-400 hover:text-red-300"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                              </div>
                            );
                          })}
                        </div>

                        {/* Add Exercise */}
                        <button
                          onClick={() => {
                            const newBlocks = [...blocks];
                            const exList = newBlocks[0].template[dayKey].exercises;
                            exList.push({ name: '', sets: '3', reps: '8-12', technique: '', rest: '2-3 min' });
                            setBlocks(newBlocks);
                            setExpandedTemplateItem(`${dayKey}-${exList.length - 1}`);
                          }}
                          className="mt-3 w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Exercise
                        </button>

                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Reset Template */}
            <div className="pt-4 border-t border-gray-700 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (window.confirm('Reset template to default? This will clear all your custom workout days and exercises.')) {
                    const newBlocks = [...blocks];
                    newBlocks[0] = createEmptyBlock();
                    setBlocks(newBlocks);
                  }
                }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"
              >
                Reset to Default Template
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Full reset? This will clear all workout logs, your template, and training maxes — but keep your personal records (PRs). This cannot be undone.')) {
                    setBlocks([createEmptyBlock()]);
                    setWorkoutLogs({});
                    setTrainingMaxes({});
                    setCurrentBlock(1);
                    setBlockMetadata({});
                    setCurrentWeek(1);
                  }
                }}
                className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/40 rounded-lg text-sm"
              >
                Full Reset (Keep PRs)
              </button>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="space-y-6">
            <div className="space-y-3">
              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                {(() => {
                  const allDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
                  const week1HasData = allDays.some(day =>
                    workoutLogs[`block${currentBlock}-week1-${day}`]?.exercises?.length > 0
                  );
                  return week1HasData ? (
                    <button
                      onClick={handleSetWeek1AsTemplate}
                      className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                      title="Copy your Week 1 workouts into the template as the baseline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Set as Template
                    </button>
                  ) : null;
                })()}
                <button
                  onClick={() => {
                    if (!window.confirm("Start a new training cycle? You'll return to Week 1.")) return;
                    const newBlockNum = currentBlock + 1;
                    const today = new Date().toISOString().split('T')[0];
                    setBlockMetadata({ ...blockMetadata, [newBlockNum]: { name: `Block ${newBlockNum}`, startDate: today } });
                    setCurrentBlock(newBlockNum);
                    setCurrentWeek(1);
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                  title="Start a new training cycle"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Cycle
                </button>
              </div>

              {/* Week navigation row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-100">Current Block · Week {currentWeek}</h2>
                  {blockMetadata[currentBlock]?.name && (
                    <p className="text-sm text-gray-400 mt-0.5">{blockMetadata[currentBlock].name}</p>
                  )}
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
                    disabled={currentWeek >= (blocks[0]?.weeks || 52)}
                    className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
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
                    onClick={() => loadDayIntoLogView(day)}
                    className={`p-4 rounded-lg border transition-all ${
                      log
                        ? 'border-emerald-500 bg-emerald-950/30 hover:bg-emerald-950/50 cursor-pointer'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-750 hover:border-gray-600 cursor-pointer'
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

                        </div>
                        <p className="text-sm text-gray-400">
                          {workout?.name || <span className="italic text-gray-500">No workout planned</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {workout?.exercises?.length > 0 ? (
                            `${workout.exercises.length} exercise${workout.exercises.length !== 1 ? 's' : ''}`
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setView('template'); }}
                              className="text-emerald-400 hover:underline"
                              title="Add exercises to this day in the Template tab"
                            >
                              Set up in Template &rarr;
                            </button>
                          )}
                        </p>
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
                  {getCurrentTemplate()[selectedDay]?.name || 'Workout'}
                </h2>
                <p className="text-gray-400">
                  Week {currentWeek} - {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}
                </p>
              </div>
              <button
                onClick={() => {
                  const isDirty = openedSnapshotRef.current !== null && JSON.stringify({ exercises, logDate }) !== openedSnapshotRef.current;
                  if (isDirty) {
                    setShowExitConfirm(true);
                  } else {
                    setPrefilled(false);
                    setView('calendar');
                  }
                }}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-300"
                title={openedSnapshotRef.current !== null ? 'Close (draft autosaves)' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {draftBanner && (
              <div className="flex items-center justify-between p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">Restored unsaved draft from {timeAgo(draftBanner.savedAt)}</span>
                </div>
                <button
                  onClick={() => {
                    deleteDraft(currentLogKey);
                    setDraftBanner(null);
                    setDraftSavedAt(null);
                    loadDayIntoLogView(selectedDay, { skipDraft: true });
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline shrink-0"
                  title="Discard the draft and reload from the template"
                >
                  Start fresh
                </button>
              </div>
            )}

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
                    setExercises(workout?.exercises.map(ex => {
                      const exType = ex.type || 'strength';
                      const tmLookup = ex.tmLink || ex.name;
                      const pctWeight = (ex.percentage && exType === 'strength') ? getPercentageWeight(tmLookup, ex.percentage) : null;
                      const targetReps = parseTargetReps(ex.reps);
                      return {
                        name: ex.name,
                        type: exType,
                        technique: ex.technique,
                        templateTarget: (ex.sets && ex.reps) ? `${ex.sets}×${ex.reps}` : null,
                        templatePercentage: ex.percentage || null,
                        templateReps: ex.reps || null,
                        templateRest: ex.rest || null,
                        tmLink: ex.tmLink || null,
                        sets: Array(parseInt(ex.sets) || 3).fill(null).map(() => ({
                          weight: pctWeight ? String(pctWeight) : '',
                          reps: targetReps,
                          weightSource: pctWeight ? 'tm-pct' : 'manual'
                        })),
                        notes: ''
                      };
                    }) || []);
                    setPrefilled(false);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 underline"
                  title="Clear pre-filled data and start from template"
                >
                  Use Template
                </button>
              </div>
            )}
            {(() => {
              const prevWeekKey = currentWeek > 1 ? `block${currentBlock}-week${currentWeek - 1}-${selectedDay}` : null;
              const prevWeekLog = prevWeekKey ? workoutLogs[prevWeekKey] : null;
              if (!prefilled && prevWeekLog && prevWeekLog.exercises?.length > 0) {
                const templateExercises = getCurrentTemplate()[selectedDay]?.exercises || [];
                return (
                  <div className="flex items-center justify-between p-3 bg-blue-950/30 border border-blue-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-300">
                        Last week available — load Week {currentWeek - 1} sets?
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setExercises(prevWeekLog.exercises.map(ex => {
                          const exType = ex.type || 'strength';
                          const tmplEx = templateExercises.find(t => t.name === ex.name);
                          return {
                            name: ex.name,
                            type: exType,
                            technique: ex.technique,
                            templateTarget: tmplEx ? `${tmplEx.sets}×${tmplEx.reps}` : null,
                            templatePercentage: tmplEx?.percentage || null,
                            templateReps: tmplEx?.reps || null,
                            templateRest: tmplEx?.rest || null,
                            tmLink: tmplEx?.tmLink || null,
                            sets: ex.sets.map(s =>
                              exType === 'bodyweight'
                                ? { reps: s.reps || '', holdTime: s.holdTime || '' }
                                : exType === 'cardio'
                                  ? { distance: s.distance || '', time: s.time || '', unit: s.unit || 'miles' }
                                  : exType === 'tabata'
                                    ? { rounds: s.rounds || '', workSeconds: s.workSeconds || '20', restSeconds: s.restSeconds || '10', calories: s.calories || '' }
                                    : { weight: s.weight || '', reps: s.reps || '' }
                            ),
                            notes: ex.notes || ''
                          };
                        }));
                        setPrefilled(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline shrink-0"
                      title="Load exact sets and weights from last week"
                    >
                      Load Last Week
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-4">
              {exercises.map((exercise, exIdx) => {
                const previousSession = getPreviousSession(exercise.name);
                const currentVolume = calculateVolume(exercise.sets);
                const previousVolume = previousSession ? calculateVolume(previousSession.sets) : 0;
                const volumeChange = previousVolume > 0
                  ? ((currentVolume - previousVolume) / previousVolume * 100).toFixed(1)
                  : null;

                const isExpanded = expandedExIdx === exIdx;
                const exType = exercise.type || 'strength';
                const completedCount = exercise.sets.filter(s => s.completed).length;

                return (
                  <div
                    key={exIdx}
                    className={`bg-gray-800 rounded-lg border transition-all overflow-hidden ${
                      draggedExIdx === exIdx
                        ? 'opacity-40 border-gray-500'
                        : dragOverExIdx === exIdx
                        ? 'border-blue-500'
                        : 'border-gray-700'
                    }`}
                    draggable
                    onDragStart={() => setDraggedExIdx(exIdx)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverExIdx(exIdx); }}
                    onDragLeave={() => setDragOverExIdx(null)}
                    onDrop={() => {
                      if (draggedExIdx === null || draggedExIdx === exIdx) {
                        setDraggedExIdx(null);
                        setDragOverExIdx(null);
                        return;
                      }
                      const newExercises = [...exercises];
                      const [moved] = newExercises.splice(draggedExIdx, 1);
                      newExercises.splice(exIdx, 0, moved);
                      setExercises(newExercises);
                      setDraggedExIdx(null);
                      setDragOverExIdx(null);
                    }}
                    onDragEnd={() => { setDraggedExIdx(null); setDragOverExIdx(null); }}
                  >
                    {/* Collapsed header row — always visible. Tap the name area to expand/collapse. */}
                    <div className="flex items-center gap-1.5 p-3">
                      <GripVertical size={16} className="hidden md:block text-gray-500 cursor-grab flex-shrink-0" title="Drag to reorder" />
                      <div className="flex flex-col shrink-0 md:hidden">
                        <button
                          type="button"
                          onClick={() => moveExercise(exIdx, -1)}
                          disabled={exIdx === 0}
                          className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20 disabled:pointer-events-none"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExercise(exIdx, 1)}
                          disabled={exIdx === exercises.length - 1}
                          className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20 disabled:pointer-events-none"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedExIdx(isExpanded ? null : exIdx)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <span className="font-semibold text-gray-100 truncate">{exercise.name || 'New Exercise'}</span>
                        <ExerciseTypeBadge type={exType} />
                        {exercise.templateTarget && (
                          <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{exercise.templateTarget}</span>
                        )}
                        {exercise.sets.length > 0 && (
                          <span className="text-xs text-gray-500 shrink-0 ml-auto">{completedCount}/{exercise.sets.length}</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-700/70">
                    <div className="relative mb-2 mt-2">
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
                          className="w-full min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg font-semibold text-gray-100"
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

                    <div className="flex items-center gap-2 flex-wrap mb-2">
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
                            setExpandedExIdx(prev => {
                              if (prev === null) return prev;
                              if (prev === exIdx) return newExercises.length > 0 ? Math.min(exIdx, newExercises.length - 1) : null;
                              if (prev > exIdx) return prev - 1;
                              return prev;
                            });
                          }
                        }}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                        title="Remove exercise"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Similar-exercise warning — flags likely duplicate variations (e.g. "DB Bench" vs "Dumbbell Bench Press") */}
                    {(() => {
                      if (!exercise.name || exercise.name.trim().length < 3) return null;
                      const candidates = allKnownExerciseNames.filter(
                        n => n.toLowerCase().trim() !== exercise.name.toLowerCase().trim()
                      );
                      const similar = findSimilarExercise(exercise.name, candidates);
                      if (!similar) return null;
                      return (
                        <div className="mb-2 flex items-center gap-2 flex-wrap p-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-xs">
                          <span className="text-amber-300">
                            Similar to existing <span className="font-semibold">"{similar.name}"</span> — same exercise?
                          </span>
                          <button
                            onClick={() => {
                              const newExercises = [...exercises];
                              newExercises[exIdx].name = similar.name;
                              setExercises(newExercises);
                              setExerciseSuggestions([]);
                            }}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium"
                            title={`Rename this exercise to "${similar.name}"`}
                          >
                            Use "{similar.name}"
                          </button>
                        </div>
                      );
                    })()}

                    {/* Exercise Type Toggle */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs text-gray-400 hidden sm:inline">Type:</span>
                      {[
                        { key: 'strength', label: 'Strength', activeClass: 'bg-emerald-600 text-white', title: 'Track weight and reps' },
                        { key: 'cardio', label: 'Cardio', activeClass: 'bg-blue-600 text-white', title: 'Track distance and time' },
                        { key: 'tabata', label: 'Tabata', activeClass: 'bg-orange-600 text-white', title: 'Track interval rounds' },
                        { key: 'bodyweight', label: 'Bodyweight', activeClass: 'bg-violet-600 text-white', title: 'Track reps and hold time' },
                      ].map(({ key, label, activeClass, title }) => {
                        const currentType = exercise.type || 'strength';
                        const isActive = currentType === key;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              if (isActive) return;
                              if (setsHaveData(exercise.sets, currentType)) {
                                const newExercises = [...exercises];
                                newExercises[exIdx].pendingTypeChange = key;
                                setExercises(newExercises);
                              } else {
                                const newExercises = [...exercises];
                                newExercises[exIdx].type = key;
                                newExercises[exIdx].pendingTypeChange = null;
                                newExercises[exIdx].sets = key === 'cardio'
                                  ? [{ distance: '', time: '', unit: 'miles' }]
                                  : key === 'tabata'
                                    ? [{ rounds: '', workSeconds: '20', restSeconds: '10', calories: '' }]
                                    : key === 'bodyweight'
                                      ? [{ reps: '', holdTime: '' }]
                                      : [{ weight: '', reps: '' }];
                                setExercises(newExercises);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? activeClass : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                            title={title}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {exercise.pendingTypeChange && (
                      <div className="mb-3 mt-2 p-2 bg-orange-950/40 border border-orange-700/50 rounded-lg flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs text-orange-300">Switching type will clear {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}. Continue?</span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const newType = exercise.pendingTypeChange;
                              const newExercises = [...exercises];
                              newExercises[exIdx].type = newType;
                              newExercises[exIdx].pendingTypeChange = null;
                              newExercises[exIdx].sets = newType === 'cardio'
                                ? [{ distance: '', time: '', unit: 'miles' }]
                                : newType === 'tabata'
                                  ? [{ rounds: '', workSeconds: '20', restSeconds: '10', calories: '' }]
                                  : newType === 'bodyweight'
                                    ? [{ reps: '', holdTime: '' }]
                                    : [{ weight: '', reps: '' }];
                              setExercises(newExercises);
                            }}
                            className="text-xs px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white rounded-lg"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => {
                              const newExercises = [...exercises];
                              newExercises[exIdx].pendingTypeChange = null;
                              setExercises(newExercises);
                            }}
                            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!exercise.pendingTypeChange && <div className="mb-3" />}

                    {/* Previous Session Banner */}
                    {previousSession && (
                      <div className="mb-3 p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-400">Last Session ({formatDate(previousSession.date)})</span>
                          <ExerciseTypeBadge type={previousSession.type || 'strength'} />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {previousSession.sets?.map((prevSet, idx) => (
                            <span key={idx} className="text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded">
                              {(previousSession.type || 'strength') === 'cardio'
                                ? `${prevSet.distance || '?'} ${prevSet.unit || 'mi'} in ${prevSet.time || '?'}`
                                : (previousSession.type || 'strength') === 'tabata'
                                  ? `${prevSet.rounds || '?'} rounds @ ${prevSet.workSeconds || '20'}s/${prevSet.restSeconds || '10'}s${prevSet.calories ? ` • ${prevSet.calories} kcal` : ''}`
                                  : (previousSession.type || 'strength') === 'bodyweight'
                                    ? `${prevSet.reps ? `${prevSet.reps} reps` : ''}${prevSet.reps && prevSet.holdTime ? ' • ' : ''}${prevSet.holdTime ? `${prevSet.holdTime}s hold` : ''}`
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

                    {(exType === 'strength' || exType === 'bodyweight') && (
                      <div className="grid grid-cols-[2.25rem_1fr_1fr_2rem] gap-2 px-0.5 mb-1">
                        <span />
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">{exType === 'bodyweight' ? 'Reps' : 'Weight'}</span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">{exType === 'bodyweight' ? 'Hold (s)' : 'Reps'}</span>
                        <span />
                      </div>
                    )}
                    <div className="space-y-2">
                      {exercise.sets.map((set, setIdx) => {
                        const exerciseType = exercise.type || 'strength';
                        const comparison = exerciseType === 'strength' ? compareSetToPrevious(set, previousSession?.sets, setIdx) : null;

                        if (exerciseType === 'cardio') {
                          // Cardio input fields
                          return (
                            <div key={setIdx} className={`space-y-1 ${set.completed ? 'border-l-2 border-emerald-500 pl-1.5 -ml-1.5' : ''}`}>
                              <div className={`grid grid-cols-[2.25rem_1fr_3.25rem_5rem_2rem] gap-2 items-center ${set.completed ? 'opacity-60' : ''}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleSetCompleted(exIdx, setIdx)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center justify-self-center text-sm font-medium transition-colors ${set.completed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                  title={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                                >
                                  {set.completed ? <Check className="w-4 h-4" /> : setIdx + 1}
                                </button>
                                <NumberField
                                  value={set.distance || ''}
                                  onChange={(v) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].distance = v;
                                    setExercises(newExercises);
                                  }}
                                  step={0.1}
                                  placeholder="Dist"
                                  ariaLabel={`Entry ${setIdx + 1} distance`}
                                />
                                <select
                                  value={set.unit || 'miles'}
                                  onChange={(e) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].unit = e.target.value;
                                    setExercises(newExercises);
                                  }}
                                  className="h-11 px-1 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm min-w-0"
                                >
                                  <option value="miles">mi</option>
                                  <option value="km">km</option>
                                  <option value="meters">m</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="MM:SS"
                                  value={set.time || ''}
                                  onChange={(e) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].time = e.target.value;
                                    setExercises(newExercises);
                                  }}
                                  className="h-11 px-2 min-w-0 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-center"
                                />
                                {exercise.sets.length > 1 ? (
                                  <button
                                    onClick={() => {
                                      const newExercises = [...exercises];
                                      newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                      setExercises(newExercises);
                                    }}
                                    className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors justify-self-center"
                                    title="Remove entry"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                ) : <span />}
                              </div>
                              {/* Show calculated pace */}
                              {set.distance && set.time && (
                                <div className="pl-11">
                                  <span className="text-xs text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded">
                                    {calculatePace(parseTimeToSeconds(set.time), parseFloat(set.distance))}/{set.unit === 'km' ? 'km' : 'mi'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (exerciseType === 'bodyweight') {
                          return (
                            <div key={setIdx} className={`grid grid-cols-[2.25rem_1fr_1fr_2rem] gap-2 items-center ${set.completed ? 'opacity-60 border-l-2 border-emerald-500 pl-1.5 -ml-1.5' : ''}`}>
                              <button
                                type="button"
                                onClick={() => toggleSetCompleted(exIdx, setIdx)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center justify-self-center text-sm font-medium transition-colors ${set.completed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                title={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                              >
                                {set.completed ? <Check className="w-4 h-4" /> : setIdx + 1}
                              </button>
                              <NumberField
                                value={set.reps || ''}
                                onChange={(v) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].reps = v;
                                  setExercises(newExercises);
                                }}
                                step={1}
                                placeholder="Reps"
                                ariaLabel={`Set ${setIdx + 1} reps`}
                              />
                              <NumberField
                                value={set.holdTime || ''}
                                onChange={(v) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].holdTime = v;
                                  setExercises(newExercises);
                                }}
                                step={5}
                                placeholder="Hold"
                                ariaLabel={`Set ${setIdx + 1} hold time in seconds`}
                              />
                              {exercise.sets.length > 1 ? (
                                <button
                                  onClick={() => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                    setExercises(newExercises);
                                  }}
                                  className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors justify-self-center"
                                  title="Remove set"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : <span />}
                            </div>
                          );
                        }

                        if (exerciseType === 'tabata') {
                          // Tabata input fields
                          const totalSeconds = set.rounds
                            ? (parseInt(set.rounds) * (parseInt(set.workSeconds || 20) + parseInt(set.restSeconds || 10)) - parseInt(set.restSeconds || 10))
                            : null;
                          return (
                            <div key={setIdx} className={`space-y-1.5 p-2 rounded-lg bg-gray-750/50 border ${set.completed ? 'border-emerald-600/50' : 'border-gray-700'}`}>
                              <div className={`grid grid-cols-[2.25rem_1fr_2rem] gap-2 items-center ${set.completed ? 'opacity-60' : ''}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleSetCompleted(exIdx, setIdx)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center justify-self-center text-sm font-medium transition-colors ${set.completed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                  title={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                                >
                                  {set.completed ? <Check className="w-4 h-4" /> : setIdx + 1}
                                </button>
                                <NumberField
                                  value={set.rounds || ''}
                                  onChange={(v) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].rounds = v;
                                    setExercises(newExercises);
                                  }}
                                  step={1}
                                  placeholder="Rounds"
                                  ariaLabel={`Set ${setIdx + 1} rounds`}
                                />
                                {exercise.sets.length > 1 ? (
                                  <button
                                    onClick={() => {
                                      const newExercises = [...exercises];
                                      newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                      setExercises(newExercises);
                                    }}
                                    className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors justify-self-center"
                                    title="Remove set"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                ) : <span />}
                              </div>
                              <div className="grid grid-cols-3 gap-2 pl-11">
                                <NumberField
                                  value={set.workSeconds || '20'}
                                  onChange={(v) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].workSeconds = v;
                                    setExercises(newExercises);
                                  }}
                                  step={5}
                                  placeholder="Work(s)"
                                  ariaLabel={`Set ${setIdx + 1} work seconds`}
                                />
                                <NumberField
                                  value={set.restSeconds || '10'}
                                  onChange={(v) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].restSeconds = v;
                                    setExercises(newExercises);
                                  }}
                                  step={5}
                                  placeholder="Rest(s)"
                                  ariaLabel={`Set ${setIdx + 1} rest seconds`}
                                />
                                <NumberField
                                  value={set.calories || ''}
                                  onChange={(v) => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets[setIdx].calories = v;
                                    setExercises(newExercises);
                                  }}
                                  step={10}
                                  placeholder="Cal"
                                  ariaLabel={`Set ${setIdx + 1} calories`}
                                />
                              </div>
                              {totalSeconds != null && (
                                <div className="pl-11">
                                  <span className="text-xs text-orange-400 bg-orange-950/30 px-2 py-1 rounded" title="Total workout time">
                                    {Math.floor(totalSeconds / 60)}:{(totalSeconds % 60).toString().padStart(2, '0')} total
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Strength input fields
                        const lookupKey = exercise.tmLink || exercise.name;
                        const nameLower = lookupKey?.toLowerCase().trim();
                        const tmData = trainingMaxes[lookupKey] ||
                          Object.entries(trainingMaxes).find(([k]) => k.toLowerCase().trim() === nameLower)?.[1];
                        const tmBase = tmData?.trainingMax;
                        const wNum = parseFloat(set.weight);
                        const pctOfTM = (tmBase && wNum) ? (wNum / tmBase * 100).toFixed(1).replace(/\.0$/, '') : null;
                        const hasSubline = pctOfTM || comparison === 'improved' || comparison === 'matched';

                        return (
                          <div key={setIdx} className={`space-y-0.5 ${set.completed ? 'border-l-2 border-emerald-500 pl-1.5 -ml-1.5' : ''}`}>
                            <div className={`grid grid-cols-[2.25rem_1fr_1fr_2rem] gap-2 items-center ${set.completed ? 'opacity-60' : ''}`}>
                              <button
                                type="button"
                                onClick={() => toggleSetCompleted(exIdx, setIdx)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center justify-self-center text-sm font-medium transition-colors ${set.completed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                title={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                              >
                                {set.completed ? <Check className="w-4 h-4" /> : setIdx + 1}
                              </button>
                              <NumberField
                                value={set.weight || ''}
                                onChange={(v) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].weight = v;
                                  newExercises[exIdx].sets[setIdx].weightSource = 'manual';
                                  delete newExercises[exIdx].sets[setIdx].tmPct;
                                  setExercises(newExercises);
                                }}
                                step={5}
                                placeholder="Weight"
                                ariaLabel={`Set ${setIdx + 1} weight`}
                              />
                              <NumberField
                                value={set.reps || ''}
                                onChange={(v) => {
                                  const newExercises = [...exercises];
                                  newExercises[exIdx].sets[setIdx].reps = v;
                                  setExercises(newExercises);
                                }}
                                step={1}
                                placeholder="Reps"
                                ariaLabel={`Set ${setIdx + 1} reps`}
                              />
                              {exercise.sets.length > 1 ? (
                                <button
                                  onClick={() => {
                                    const newExercises = [...exercises];
                                    newExercises[exIdx].sets = newExercises[exIdx].sets.filter((_, idx) => idx !== setIdx);
                                    setExercises(newExercises);
                                  }}
                                  className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors justify-self-center"
                                  title="Remove set"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : <span />}
                            </div>
                            {hasSubline && (
                              <div className="grid grid-cols-[2.25rem_1fr_1fr_2rem] gap-2">
                                <span />
                                <div className="flex items-center gap-2 text-xs">
                                  {pctOfTM && (
                                    <span className="text-purple-300" title={`${pctOfTM}% of TM (${tmBase} lb)`}>
                                      {pctOfTM}%TM
                                    </span>
                                  )}
                                  {comparison === 'improved' && (
                                    <span className="text-emerald-400" title="Improvement over previous session">↑ improved</span>
                                  )}
                                  {comparison === 'matched' && (
                                    <span className="text-blue-400" title="Matched previous session">✓ matched</span>
                                  )}
                                </div>
                                <span />
                                <span />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          const exerciseType = exercise.type || 'strength';
                          const lastSet = exercise.sets[exercise.sets.length - 1];

                          if (exerciseType === 'bodyweight') {
                            newExercises[exIdx].sets.push({
                              reps: '',
                              holdTime: ''
                            });
                          } else if (exerciseType === 'cardio') {
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
                              reps: lastSet?.reps || parseTargetReps(exercise.templateReps) || ''
                            });
                          }
                          setExercises(newExercises);
                        }}
                        className="w-full py-2.5 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add {(exercise.type || 'strength') === 'cardio' ? 'Entry' : 'Set'}
                      </button>
                    </div>

                    {/* Summary Display - Conditional based on type */}
                    {(() => {
                      const exerciseType = exercise.type || 'strength';

                      if (exerciseType === 'bodyweight') {
                        const totalReps = exercise.sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
                        const maxHold = Math.max(...exercise.sets.map(s => parseInt(s.holdTime) || 0));

                        if (totalReps > 0 || maxHold > 0) {
                          return (
                            <div className="mt-3 p-2 bg-gray-750 rounded border border-gray-600">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {totalReps > 0 && (
                                  <div>
                                    <span className="text-gray-400">Total Reps:</span>
                                    <span className="text-violet-400 font-medium ml-2">{totalReps}</span>
                                  </div>
                                )}
                                {maxHold > 0 && (
                                  <div>
                                    <span className="text-gray-400">Max Hold:</span>
                                    <span className="text-violet-400 font-medium ml-2">{maxHold}s</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }

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

                    {exercise.notes || exercise._notesOpen ? (
                      <textarea
                        placeholder="Notes"
                        autoFocus={exercise._notesOpen && !exercise.notes}
                        value={exercise.notes || ''}
                        onChange={(e) => {
                          const newExercises = [...exercises];
                          newExercises[exIdx].notes = e.target.value;
                          setExercises(newExercises);
                        }}
                        onBlur={() => {
                          if (!exercise.notes) {
                            const newExercises = [...exercises];
                            newExercises[exIdx]._notesOpen = false;
                            setExercises(newExercises);
                          }
                        }}
                        className="w-full mt-3 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100"
                        rows={2}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          const newExercises = [...exercises];
                          newExercises[exIdx]._notesOpen = true;
                          setExercises(newExercises);
                        }}
                        className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        + Add note
                      </button>
                    )}
                    </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => {
                  const newExercises = [...exercises, {
                    name: 'New Exercise',
                    technique: '',
                    sets: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }],
                    notes: ''
                  }];
                  setExercises(newExercises);
                  setExpandedExIdx(newExercises.length - 1);
                }}
                className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Exercise
              </button>
            </div>

            {/* Global rest timer — one per session, survives which card is expanded, view changes,
                backgrounding, and refresh (see restTimer effects above). */}
            {restTimer ? (
              <div className={`p-3 rounded-lg border flex items-center justify-between gap-2 flex-wrap ${restRemainingMs === 0 ? 'timer-warning border-red-700/50' : 'bg-gray-800 border-gray-700'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-2xl font-mono font-bold tabular-nums shrink-0 ${restRemainingMs === 0 ? 'text-red-400' : restRemainingSeconds <= 10 ? 'text-red-400 animate-timer-pulse' : 'text-emerald-400'}`}
                  >
                    {formatSecondsToTime(restRemainingSeconds)}
                  </span>
                  <span className="text-xs text-gray-400 truncate">rest &middot; {restTimer.exName}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => adjustRestTimer(-15)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg"
                    title="Subtract 15 seconds"
                  >
                    -15s
                  </button>
                  <button
                    onClick={() => adjustRestTimer(15)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg"
                    title="Add 15 seconds"
                  >
                    +15s
                  </button>
                  <button
                    onClick={pauseResumeRestTimer}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded-lg font-medium"
                  >
                    {restTimer.running ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => setRestMuted(m => !m)}
                    className="p-1.5 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                    title={restMuted ? 'Unmute rest timer sound' : 'Mute rest timer sound'}
                  >
                    {restMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={stopRestTimer}
                    className="p-1.5 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                    title="Stop rest timer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              expandedExIdx != null && exercises[expandedExIdx] && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => startRestTimer(
                      expandedExIdx,
                      exercises[expandedExIdx].name,
                      parseRestSeconds(exercises[expandedExIdx].templateRest) || restDuration
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                    title={`Start ${restDuration}s rest timer`}
                  >
                    <Timer className="w-4 h-4" />
                    Start Rest ({restDuration}s)
                  </button>
                  <button
                    onClick={() => adjustRestDuration(-15)}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg"
                    title="Decrease default rest duration"
                  >
                    -15s
                  </button>
                  <button
                    onClick={() => adjustRestDuration(15)}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg"
                    title="Increase default rest duration"
                  >
                    +15s
                  </button>
                </div>
              )
            )}

            {/* Sticky action bar — keeps Save reachable without hunting past a long exercise list. */}
            <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-700 flex items-center gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col text-[10px] sm:text-xs text-gray-500 shrink-0 min-w-0 leading-tight">
              <span>
                {(() => {
                  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                  const doneSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
                  return totalSets > 0 ? `${doneSets}/${totalSets} sets` : null;
                })()}
              </span>
              <span className="truncate max-w-[7rem] sm:max-w-none">
                {draftSaving ? 'Saving…' : draftSavedAt ? `Saved ${timeAgo(draftSavedAt)}` : ''}
              </span>
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

                // Save workout log — strip UI-only metadata before persisting
                const exercisesToSave = exercises.map(({ _notesOpen, templateTarget, templatePercentage, pendingTypeChange, templateReps, templateRest, ...ex }) => ({
                  ...ex,
                  sets: ex.sets.map(({ weightSource, ...set }) => set)
                }));
                setWorkoutLogs({
                  ...workoutLogs,
                  [logKey]: {
                    date: logDate,
                    exercises: exercisesToSave,
                    prsHit: allPRs.length
                  }
                });

                // The workout is committed — the draft and any running rest timer no longer apply
                deleteDraft(logKey);
                setDraftSavedAt(null);
                stopRestTimer();

                // Build training-max suggestions from what was just logged (applied only on user confirm)
                const suggestions = buildTMSuggestions(exercises);
                setTmSuggestions(suggestions);
                setTmSuggestSelected(suggestions.reduce((acc, _, i) => { acc[i] = true; return acc; }, {}));

                // Chain modals: PRs first, then TM suggestions, then back to calendar
                if (allPRs.length > 0) {
                  setNewPRs(allPRs);
                  setShowPRModal(true);
                } else if (suggestions.length > 0) {
                  setShowTMSuggestModal(true);
                } else {
                  setPrefilled(false);
                  setView('calendar');
                }
              }}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Workout
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Exit-guard modal — shown from the log view's X when there are unsaved edits */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-sm w-full">
            <ModalHeader title="Unsaved changes" onClose={() => setShowExitConfirm(false)} />
            <p className="text-sm text-gray-300 mb-5">
              You have edits that haven't been saved as a workout yet. Your draft is autosaved, so it's safe to leave — but Save Workout is what actually logs it for PRs and progress.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
              >
                Stay and Save Workout
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  setPrefilled(false);
                  setView('calendar');
                }}
                className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium"
                title="The draft stays saved — you can reopen this day to pick up where you left off"
              >
                Leave (keep draft)
              </button>
              <button
                onClick={() => {
                  if (currentLogKey) deleteDraft(currentLogKey);
                  setDraftSavedAt(null);
                  setShowExitConfirm(false);
                  setPrefilled(false);
                  setView('calendar');
                }}
                className="w-full py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium"
              >
                Discard draft
              </button>
            </div>
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
                        {prTMSaved[idx] ? (
                          <p className="mt-2 text-xs text-purple-300">✓ Saved as Training Max ({trainingMaxes[pr.exerciseName]?.trainingMaxPercent || 90}%)</p>
                        ) : (
                          <button
                            onClick={() => {
                              const existingPct = trainingMaxes[pr.exerciseName]?.trainingMaxPercent || DEFAULT_TM_PERCENT;
                              saveTrainingMax(pr.exerciseName, pr.value, existingPct);
                              setPrTMSaved(prev => ({ ...prev, [idx]: true }));
                            }}
                            className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
                          >
                            Use as Training Max
                          </button>
                        )}
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
                    {pr.type === 'maxReps' && !pr.weight && (
                      <>
                        <p className="font-medium">Most Reps!</p>
                        <p className="text-gray-400">
                          {pr.value} reps
                          {pr.previous > 0 && ` (previous: ${pr.previous} reps)`}
                        </p>
                      </>
                    )}
                    {pr.type === 'longestHold' && (
                      <>
                        <p className="font-medium">Longest Hold!</p>
                        <p className="text-gray-400">
                          {pr.value}s
                          {pr.previous > 0 && ` (previous: ${pr.previous}s)`}
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
                setPrTMSaved({});
                if (tmSuggestions.length > 0) {
                  setShowTMSuggestModal(true);
                } else {
                  setPrefilled(false);
                  setView('calendar');
                }
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-lg transition-colors"
            >
              Awesome! Continue
            </button>
          </div>
        </div>
      )}

      {/* Training Max Suggestions Modal — shown after saving; user confirms which TMs to apply */}
      {showTMSuggestModal && tmSuggestions.length > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 rounded-lg border-2 border-purple-500 p-6 max-w-lg w-full">
            <div className="text-center mb-5">
              <Dumbbell className="w-10 h-10 text-purple-400 mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-purple-300 mb-1">Update Training Maxes?</h2>
              <p className="text-gray-400 text-sm">
                Based on today's lifts. Uncheck any you don't want to change.
              </p>
            </div>

            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
              {tmSuggestions.map((s, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-gray-900/50 border border-purple-700/30 rounded-lg cursor-pointer hover:bg-gray-900"
                >
                  <input
                    type="checkbox"
                    checked={!!tmSuggestSelected[idx]}
                    onChange={(e) => setTmSuggestSelected(prev => ({ ...prev, [idx]: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-purple-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-100 text-sm">
                      {s.targetKey}
                      {s.isNew
                        ? <span className="ml-2 text-xs px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">New</span>
                        : <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded">Update</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.isNew
                        ? <>Set 1RM to <span className="text-purple-300 font-medium">{s.suggestedTrue1RM} lb</span> · TM {deriveTrainingMax(s.suggestedTrue1RM, s.pct)} lb ({s.pct}%)</>
                        : <>1RM <span className="text-gray-500">{s.currentTrue1RM} lb</span> → <span className="text-purple-300 font-medium">{s.suggestedTrue1RM} lb</span> · TM {deriveTrainingMax(s.suggestedTrue1RM, s.pct)} lb ({s.pct}%)</>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      from {s.weight} lb × {s.reps} reps
                      {s.matchedByName && <span className="text-amber-400"> · logged as "{s.exerciseName}"</span>}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTMSuggestModal(false);
                  setTmSuggestions([]);
                  setTmSuggestSelected({});
                  setPrefilled(false);
                  setView('calendar');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-3 rounded-lg transition-colors"
              >
                Not now
              </button>
              <button
                onClick={() => {
                  tmSuggestions.forEach((s, idx) => {
                    if (tmSuggestSelected[idx]) saveTrainingMax(s.targetKey, s.suggestedTrue1RM, s.pct);
                  });
                  setShowTMSuggestModal(false);
                  setTmSuggestions([]);
                  setTmSuggestSelected({});
                  setPrefilled(false);
                  setView('calendar');
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Apply Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Max Modal */}
      {showTMModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <ModalHeader
              title={<span className="flex items-center gap-2"><Dumbbell className="w-5 h-5 text-purple-400" />{tmModalIsNew ? 'Add Training Max' : 'Edit Training Max'}</span>}
              onClose={() => setShowTMModal(false)}
            />
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Exercise Name</label>
              {tmModalIsNew ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Incline Bench Press"
                    value={tmModalExercise}
                    onChange={(e) => setTmModalExercise(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                  />
                  {tmModalExercise.length >= 1 && (() => {
                    const matches = getAllExerciseNames
                      .filter(n => n.toLowerCase().includes(tmModalExercise.toLowerCase()) && n !== tmModalExercise)
                      .slice(0, 6);
                    if (matches.length === 0) return null;
                    return (
                      <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {matches.map(n => (
                          <button
                            key={n}
                            onMouseDown={e => {
                            e.preventDefault();
                            setTmModalExercise(n);
                            if (personalRecords[n]?.estimated1RM && !tmModalTrueRM) {
                              setTmModalTrueRM(String(personalRecords[n].estimated1RM.value));
                            }
                          }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center justify-between"
                          >
                            <span>{n}</span>
                            {personalRecords[n]?.estimated1RM && (
                              <span className="text-xs text-purple-400">Est. 1RM: {personalRecords[n].estimated1RM.value} lb</span>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-700/50 border border-gray-700 rounded-lg text-gray-200 font-medium">
                  {tmModalExercise}
                </div>
              )}
            </div>

            {/* Calculator */}
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Calculate from a recent set</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Weight (lb)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="185"
                    value={tmModalCalcWeight}
                    onChange={(e) => setTmModalCalcWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Reps</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="5"
                    value={tmModalCalcReps}
                    onChange={(e) => setTmModalCalcReps(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
                  />
                </div>
                <div className="text-right">
                  {tmModalCalcWeight && tmModalCalcReps && parseInt(tmModalCalcReps) > 0 && (
                    <div className="text-purple-300 text-sm font-semibold mb-1">
                      {calculateEstimated1RM(tmModalCalcWeight, tmModalCalcReps)} lb
                    </div>
                  )}
                  <button
                    disabled={!tmModalCalcWeight || !tmModalCalcReps || parseInt(tmModalCalcReps) <= 0}
                    onClick={() => setTmModalTrueRM(String(calculateEstimated1RM(tmModalCalcWeight, tmModalCalcReps)))}
                    className="text-xs px-3 py-2 bg-purple-700/40 hover:bg-purple-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 rounded-lg border border-purple-700/50 whitespace-nowrap"
                  >
                    Use as 1RM
                  </button>
                </div>
              </div>
            </div>

            {/* Direct entry */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 block mb-1">True 1RM (lb)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="225"
                  value={tmModalTrueRM}
                  onChange={(e) => setTmModalTrueRM(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Training Max % <span className="text-gray-500">(typically 85–90%)</span></label>
                <input
                  type="number"
                  min="70"
                  max="100"
                  value={tmModalPercent}
                  onChange={(e) => setTmModalPercent(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                />
              </div>
              {tmModalTrueRM && parseFloat(tmModalTrueRM) > 0 && (
                <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Training Max</p>
                  <p className="text-2xl font-bold text-purple-300">
                    {deriveTrainingMax(tmModalTrueRM, tmModalPercent)} lb
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tmModalPercent}% of {tmModalTrueRM} lb
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTMModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                disabled={!tmModalTrueRM || parseFloat(tmModalTrueRM) <= 0}
                onClick={() => {
                  saveTrainingMax(tmModalExercise, tmModalTrueRM, tmModalPercent);
                  setShowTMModal(false);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
              >
                Save Training Max
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <ModalHeader
              title={authMode === 'login' ? 'Sign In' : 'Create Account'}
              onClose={() => { setShowAuthModal(false); setAuthError(''); }}
            />
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="password"
                placeholder="Password (min 6 chars)"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              {authError && (
                <p className="text-red-400 text-xs">{authError}</p>
              )}
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
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

      {/* First-Run Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <ModalHeader
              title={<span className="flex items-center gap-2"><Dumbbell className="w-5 h-5 text-emerald-400" />Welcome to Workout Tracker</span>}
              onClose={() => {
                setShowOnboarding(false);
                localStorage.setItem('onboarding-complete', 'true');
              }}
            />
            <p className="text-sm text-gray-400 mb-5">
              Let's set up your training template. You can always change this later in the Template tab.
            </p>

            <div className="space-y-3 mb-4">
              {STARTER_TEMPLATES.map(preset => (
                <button
                  key={preset.key}
                  onClick={() => {
                    setBlocks([{ id: 1, name: preset.label, weeks: 4, template: preset.build() }]);
                    setShowOnboarding(false);
                    localStorage.setItem('onboarding-complete', 'true');
                  }}
                  className="w-full text-left p-4 bg-gray-900/50 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                >
                  <p className="font-medium text-gray-100">{preset.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{preset.description}</p>
                </button>
              ))}

              <button
                onClick={() => {
                  setShowOnboarding(false);
                  localStorage.setItem('onboarding-complete', 'true');
                  setView('template');
                }}
                className="w-full text-left p-4 bg-gray-900/50 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
              >
                <p className="font-medium text-gray-100">Build my own</p>
                <p className="text-xs text-gray-400 mt-1">Start blank and add your own days and exercises</p>
              </button>

              <label className="flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-gray-100">Import a backup</p>
                  <p className="text-xs text-gray-400 mt-1">Restore from a previously exported JSON file</p>
                </div>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    importData(e, () => {
                      setShowOnboarding(false);
                      localStorage.setItem('onboarding-complete', 'true');
                    });
                  }}
                />
              </label>
            </div>

            <p className="text-xs text-gray-500 text-center">
              You can skip this and set things up later from the Template tab.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkoutTracker;

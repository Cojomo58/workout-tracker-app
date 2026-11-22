// Set list for a new week opened from last week's log.
//
// The calendar labels a day with prescriptionForWeek (weeklyProgression for that week, otherwise
// the base template). The editor has to use that same row for how many sets to show and what
// reps to put in them. Starting load is the percentage × training max when one was resolved,
// otherwise the weight from the same set last week. A set added past last week's length repeats
// the last logged weight. Extra sets beyond the template count are dropped.

export function findTemplateExercise(templateExercises, name) {
  const list = Array.isArray(templateExercises) ? templateExercises : [];
  const exact = list.find(t => t && t.name === name);
  if (exact) return exact;
  const target = String(name || '').toLowerCase().trim();
  if (!target) return undefined;
  return list.find(t => String(t?.name || '').toLowerCase().trim() === target);
}

function firstRepNumber(repsStr) {
  if (repsStr === null || repsStr === undefined || repsStr === '') return '';
  const match = String(repsStr).match(/\d+/);
  return match ? match[0] : '';
}

function setFromSource(type, src, targetReps, pctWeight) {
  const set = src || {};
  if (type === 'bodyweight') {
    return {
      reps: targetReps || set.reps || '',
      holdTime: set.holdTime || '',
    };
  }
  if (type === 'cardio') {
    return {
      distance: set.distance || '',
      time: set.time || '',
      unit: set.unit || 'miles',
    };
  }
  if (type === 'tabata') {
    return {
      rounds: set.rounds || '',
      workSeconds: set.workSeconds || '20',
      restSeconds: set.restSeconds || '10',
      calories: set.calories || '',
    };
  }
  const next = {
    weight: pctWeight ? String(pctWeight) : (set.weight || ''),
    reps: targetReps || set.reps || '',
  };
  if (pctWeight) next.weightSource = 'tm-pct';
  return next;
}

// `prescription` is the result of prescriptionForWeek, or null when this exercise is not in the
// template (last week's sets are then copied as logged). `pctWeight` is already resolved; null
// means "no percentage load", so last week's weight stays.
export function setsForNewWeek(lastSets, { type = 'strength', prescription = null, pctWeight = null } = {}) {
  const last = Array.isArray(lastSets) ? lastSets : [];
  if (!prescription) return last.map(s => setFromSource(type, s, '', null));

  const parsed = parseInt(prescription.sets, 10);
  const count = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.max(last.length, 1);
  const targetReps = firstRepNumber(prescription.reps);
  return Array.from({ length: count }, (_, i) => {
    const src = last[i] || last[last.length - 1] || {};
    return setFromSource(type, src, targetReps, pctWeight);
  });
}

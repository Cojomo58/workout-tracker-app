/** Synthetic localStorage fixtures — never real user data. */

export const BASE_BLOCK = {
  id: 1,
  name: 'My Training Block',
  weeks: 4,
  template: {
    monday: {
      name: 'Lower',
      exercises: [
        {
          name: 'Squat',
          sets: 3,
          reps: '5',
          percentage: 65,
          weeklyProgression: [{ week: 3, sets: 5, reps: '3', percentage: 75 }],
        },
        {
          name: 'Mystery Press',
          sets: 3,
          reps: '8',
          percentage: 70,
        },
      ],
    },
    tuesday: { name: '', exercises: [] },
    wednesday: { name: 'Bench', exercises: [{ name: 'Bench Press', sets: 3, reps: '5' }] },
    thursday: { name: '', exercises: [] },
    friday: { name: 'Future', exercises: [{ name: 'Deadlift', sets: 1, reps: '5' }] },
  },
};

export function storageWithSavedMonday() {
  return {
    'onboarding-complete': 'true',
    'current-block': '1',
    'current-week': JSON.stringify({ block: 1, week: 1 }),
    'workout-blocks': JSON.stringify([BASE_BLOCK]),
    'workout-logs': JSON.stringify({
      'block1-week1-monday': {
        date: '2026-11-01',
        exercises: [
          {
            name: 'Squat',
            type: 'strength',
            notes: 'saved log',
            sets: [{ weight: '225', reps: '5', completed: true }],
          },
        ],
        durationSeconds: 600,
        prsHit: 0,
      },
    }),
    'personal-records': JSON.stringify({}),
    'block-metadata': JSON.stringify({
      1: { name: 'Fixture Cycle', startDate: '2026-11-01', currentWeek: 1 },
    }),
    'training-maxes': JSON.stringify({}),
  };
}

export function storageCopyLastFixture() {
  return {
    ...storageWithSavedMonday(),
    'current-week': JSON.stringify({ block: 1, week: 2 }),
    'workout-logs': JSON.stringify({
      'block1-week1-monday': {
        date: '2026-11-01',
        exercises: [
          {
            name: 'Bench Press',
            type: 'strength',
            notes: 'prior-session-note',
            sets: [{ weight: '185', reps: '5' }],
          },
        ],
        durationSeconds: 400,
        prsHit: 0,
      },
    }),
    'block-metadata': JSON.stringify({
      1: { name: 'Fixture Cycle', startDate: '2026-11-01', currentWeek: 2 },
    }),
  };
}

export function storageCalendarWeek3Fixture() {
  return {
    'onboarding-complete': 'true',
    'current-block': '1',
    'current-week': JSON.stringify({ block: 1, week: 3 }),
    'workout-blocks': JSON.stringify([BASE_BLOCK]),
    'workout-logs': JSON.stringify({}),
    'personal-records': JSON.stringify({}),
    'block-metadata': JSON.stringify({
      1: { name: 'Fixture Cycle', startDate: '2026-11-01', currentWeek: 3 },
    }),
    'training-maxes': JSON.stringify({}),
  };
}

export function storageMergeFixture() {
  return {
    'onboarding-complete': 'true',
    'current-block': '1',
    'workout-blocks': JSON.stringify([
      {
        ...BASE_BLOCK,
        template: {
          ...BASE_BLOCK.template,
          monday: {
            name: 'Merge day',
            exercises: [
              { name: 'db bench', sets: 3, reps: '8' },
              { name: 'Dumbbell Bench Press', sets: 3, reps: '8' },
            ],
          },
        },
      },
    ]),
    'workout-logs': JSON.stringify({
      'block1-week1-monday': {
        date: '2026-11-01',
        exercises: [
          { name: 'db bench', type: 'strength', sets: [{ weight: '50', reps: '8' }], notes: 'merge-me' },
        ],
        prsHit: 0,
      },
    }),
    'personal-records': JSON.stringify({
      'db bench': { estimated1RM: { value: 70, weight: 50, reps: 8 } },
    }),
    'training-maxes': JSON.stringify({
      'db bench': { true1RM: 70, trainingMax: 62.5, trainingMaxPercent: 90, lastUpdated: '2026-11-01', history: [] },
      'Dumbbell Bench Press': { true1RM: 80, trainingMax: 72.5, trainingMaxPercent: 90, lastUpdated: '2026-11-01', history: [] },
    }),
    'block-metadata': JSON.stringify({
      1: {
        name: 'Fixture',
        currentWeek: 1,
        plans: { 'week2-friday': { savedAt: 1, exercises: [{ name: 'db bench', sets: [] }] } },
        trainingMaxSnapshot: { 'db bench': { trainingMax: 62.5, true1RM: 70, trainingMaxPercent: 90 } },
      },
    }),
    'workout-drafts': JSON.stringify({
      'block1-week1-tuesday': { savedAt: Date.now(), date: '2026-11-02', exercises: [{ name: 'db bench', notes: 'draft-preserved', sets: [] }] },
    }),
  };
}

export function storageTemplateTmFlagFixture() {
  return {
    'onboarding-complete': 'true',
    'current-block': '1',
    'workout-blocks': JSON.stringify([BASE_BLOCK]),
    'workout-logs': JSON.stringify({}),
    'personal-records': JSON.stringify({}),
    'training-maxes': JSON.stringify({}),
    'block-metadata': JSON.stringify({ 1: { name: 'Template Fixture', currentWeek: 1 } }),
  };
}

export function storageOfflineFallbackFixture() {
  const data = storageWithSavedMonday();
  data['block-metadata'] = JSON.stringify({
    1: { name: 'Offline Fixture Cycle', startDate: '2026-11-01', currentWeek: 1 },
  });
  data['__wt_verify_slow_load'] = '1';
  return data;
}

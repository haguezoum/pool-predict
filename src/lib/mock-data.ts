import type {
  DayExerciseScore,
  LeaderboardEntry,
  LogtimeIntensity,
  LogtimeSlot,
  Match,
  User,
} from '@/types'

export const mockUser: User = {
  id: '42-1337',
  login: 'hben-ali',
  displayName: 'Hassan Ben Ali',
  avatarUrl: 'https://cdn.intra.42.fr/users/medium_default.png',
  campus: '42 Rabat',
  level: 8.42,
  rank: 12,
  points: 1840,
  wins: 47,
  losses: 19,
  streak: 5,
  predictions: 66,
  accuracy: 71.2,
}

/** First Friday = Exam 1, second = Exam 2, etc. */
const fridayLabels = ['Exam 1', 'Exam 2', 'Exam 3', 'Exam 4'] as const

const TIME_SLOTS = ['6am', '10am', '12am', '5pm', '8pm'] as const

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeLogtime(seed: number): LogtimeSlot[] {
  const rand = seeded(seed)
  return TIME_SLOTS.map((time) => ({
    time,
    days: Array.from({ length: 7 }, () => {
      const r = rand()
      if (r < 0.25) return 0 as LogtimeIntensity
      if (r < 0.45) return 1 as LogtimeIntensity
      if (r < 0.65) return 2 as LogtimeIntensity
      if (r < 0.85) return 3 as LogtimeIntensity
      return 4 as LogtimeIntensity
    }),
  }))
}

function makeExercises(seed: number): DayExerciseScore[] {
  const rand = seeded(seed + 99)
  return Array.from({ length: 28 }, (_, i) => {
    const missing = rand() < 0.12
    if (missing) {
      return { day: i + 1, day1: null, day2: null, day3: null }
    }
    return {
      day: i + 1,
      day1: Math.round(40 + rand() * 60),
      day2: Math.round(35 + rand() * 65),
      day3: Math.round(30 + rand() * 70),
    }
  })
}

/** Mock until API is wired — value is exam score 0–100 */
export const matches: Match[] = [
  {
    id: 'm1',
    login: 'anass',
    fullName: 'Anass El',
    avatarUrl: '',
    rank: 1,
    fridays: [
      { label: fridayLabels[0], validated: true, value: 85, score: '85' },
      { label: fridayLabels[1], validated: false, value: null },
      { label: fridayLabels[2], validated: true, value: 72, score: '72' },
      { label: fridayLabels[3], validated: true, value: 91, score: '91' },
    ],
    logtime: makeLogtime(11),
    exercises: makeExercises(11),
  },
  {
    id: 'm2',
    login: 'sara',
    fullName: 'Sara M.',
    avatarUrl: '',
    rank: 2,
    fridays: [
      { label: fridayLabels[0], validated: true, value: 78, score: '78' },
      { label: fridayLabels[1], validated: true, value: 88, score: '88' },
      { label: fridayLabels[2], validated: false, value: null },
      { label: fridayLabels[3], validated: true, value: 95, score: '95' },
    ],
    logtime: makeLogtime(22),
    exercises: makeExercises(22),
  },
  {
    id: 'm3',
    login: 'youssef',
    fullName: 'Youssef K.',
    avatarUrl: '',
    rank: 3,
    fridays: [
      { label: fridayLabels[0], validated: false, value: null },
      { label: fridayLabels[1], validated: true, value: 64, score: '64' },
      { label: fridayLabels[2], validated: true, value: 70, score: '70' },
      { label: fridayLabels[3], validated: false, value: null },
    ],
    logtime: makeLogtime(33),
    exercises: makeExercises(33),
  },
  {
    id: 'm4',
    login: 'amina',
    fullName: 'Amina B.',
    avatarUrl: '',
    rank: 4,
    fridays: [
      { label: fridayLabels[0], validated: true, value: 92, score: '92' },
      { label: fridayLabels[1], validated: true, value: 80, score: '80' },
      { label: fridayLabels[2], validated: true, value: 87, score: '87' },
      { label: fridayLabels[3], validated: true, value: 75, score: '75' },
    ],
    logtime: makeLogtime(44),
    exercises: makeExercises(44),
  },
  {
    id: 'm5',
    login: 'karim',
    fullName: 'Karim T.',
    avatarUrl: '',
    rank: 5,
    fridays: [
      { label: fridayLabels[0], validated: false, value: null },
      { label: fridayLabels[1], validated: false, value: null },
      { label: fridayLabels[2], validated: true, value: 58, score: '58' },
      { label: fridayLabels[3], validated: false, value: null },
    ],
    logtime: makeLogtime(55),
    exercises: makeExercises(55),
  },
  {
    id: 'm6',
    login: 'lina',
    fullName: 'Lina R.',
    avatarUrl: '',
    rank: 6,
    fridays: [
      { label: fridayLabels[0], validated: true, value: 66, score: '66' },
      { label: fridayLabels[1], validated: false, value: null },
      { label: fridayLabels[2], validated: false, value: null },
      { label: fridayLabels[3], validated: true, value: 83, score: '83' },
    ],
    logtime: makeLogtime(66),
    exercises: makeExercises(66),
  },
]

export const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    login: 'anass',
    displayName: 'Anass El',
    avatarUrl: '',
    points: 3120,
    accuracy: 82.4,
    predictions: 98,
    streak: 9,
  },
  {
    rank: 2,
    login: 'sara',
    displayName: 'Sara M.',
    avatarUrl: '',
    points: 2890,
    accuracy: 79.1,
    predictions: 112,
    streak: 4,
  },
  {
    rank: 3,
    login: 'youssef',
    displayName: 'Youssef K.',
    avatarUrl: '',
    points: 2650,
    accuracy: 76.8,
    predictions: 87,
    streak: 6,
  },
  {
    rank: 4,
    login: 'amina',
    displayName: 'Amina B.',
    avatarUrl: '',
    points: 2410,
    accuracy: 74.2,
    predictions: 91,
    streak: 2,
  },
  {
    rank: 5,
    login: 'karim',
    displayName: 'Karim T.',
    avatarUrl: '',
    points: 2180,
    accuracy: 72.5,
    predictions: 76,
    streak: 3,
  },
  {
    rank: 6,
    login: 'lina',
    displayName: 'Lina R.',
    avatarUrl: '',
    points: 2050,
    accuracy: 71.8,
    predictions: 84,
    streak: 1,
  },
  {
    rank: 7,
    login: 'mehdi',
    displayName: 'Mehdi A.',
    avatarUrl: '',
    points: 1960,
    accuracy: 70.4,
    predictions: 79,
    streak: 0,
  },
  {
    rank: 8,
    login: 'nour',
    displayName: 'Nour H.',
    avatarUrl: '',
    points: 1910,
    accuracy: 69.9,
    predictions: 71,
    streak: 5,
  },
  {
    rank: 9,
    login: 'omar',
    displayName: 'Omar S.',
    avatarUrl: '',
    points: 1880,
    accuracy: 68.5,
    predictions: 93,
    streak: 2,
  },
  {
    rank: 10,
    login: 'imane',
    displayName: 'Imane Z.',
    avatarUrl: '',
    points: 1860,
    accuracy: 72.1,
    predictions: 64,
    streak: 7,
  },
  {
    rank: 11,
    login: 'zayd',
    displayName: 'Zayd F.',
    avatarUrl: '',
    points: 1850,
    accuracy: 67.3,
    predictions: 88,
    streak: 1,
  },
  {
    rank: 12,
    login: 'hben-ali',
    displayName: 'Hassan Ben Ali',
    avatarUrl: '',
    points: 1840,
    accuracy: 71.2,
    predictions: 66,
    streak: 5,
  },
]

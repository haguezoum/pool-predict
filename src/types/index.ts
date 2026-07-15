export type User = {
  id: string
  login: string
  displayName: string
  avatarUrl: string
  campus: string
  level: number
  rank: number
  points: number
  wins: number
  losses: number
  streak: number
  predictions: number
  accuracy: number
}

/**
 * Exam session for a candidate (Friday 1 = Exam 1, Friday 2 = Exam 2, …).
 * `value` is chart Y (null = not validated / gap). Will be provided by API later.
 * `score` is the exact score shown on hover when validated.
 */
export type FridayResult = {
  /** X-axis label, e.g. "Exam 1" */
  label: string
  validated: boolean
  /** Exam score 0–100 for the line chart; null when not validated */
  value: number | null
  /** Exact score for tooltip, e.g. "85" */
  score?: string
}

/** Intensity 0–4 for logtime heatmap cells (GitHub-style) */
export type LogtimeIntensity = 0 | 1 | 2 | 3 | 4

export type LogtimeSlot = {
  /** Row label, e.g. "6am" */
  time: string
  /** 7 values Mon–Sun */
  days: LogtimeIntensity[]
}

export type DayExerciseScore = {
  day: number
  day1: number | null
  day2: number | null
  day3: number | null
}

export type Match = {
  id: string
  login: string
  fullName: string
  avatarUrl: string
  /** Campus rank (1 = best) */
  rank: number
  /** Last 4 exams — Exam 1 … Exam 4 */
  fridays: FridayResult[]
  /** Weekly logtime heatmap (API soon) */
  logtime: LogtimeSlot[]
  /** Exercise scores for 28 days (API soon) */
  exercises: DayExerciseScore[]
}

export type LeaderboardEntry = {
  rank: number
  login: string
  displayName: string
  avatarUrl: string
  points: number
  accuracy: number
  predictions: number
  streak: number
}

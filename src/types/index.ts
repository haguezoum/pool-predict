import type { ExamResultView, LeaderboardEntry as ApiLeaderboardEntry, Viewer } from '@shared/contracts'

export type User = Viewer

export type FridayResult = {
  label: string
  validated: boolean
  value: number | null
  score?: string
}

export type LogtimeIntensity = 0 | 1 | 2 | 3 | 4

export type LogtimeSlot = {
  time: string
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
  intraUserId: number
  login: string
  fullName: string
  avatarUrl: string
  rank: number
  fridays: FridayResult[]
  results: ExamResultView[]
}

export type LeaderboardEntry = ApiLeaderboardEntry

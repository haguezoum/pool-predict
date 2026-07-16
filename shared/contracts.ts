export const EXAM_CODES = ['00', '01', '02', '03'] as const
export type ExamCode = (typeof EXAM_CODES)[number]

export type Prediction = 'validate' | 'not_validate'
export type ExamStatus = 'open' | 'locked' | 'settling' | 'settled'

export type Viewer = {
  intraUserId: number
  login: string
  displayName: string
  avatarUrl: string
  campus: string
  totalScore: number
  rank: number
  predictions: number
  correct: number
  wrong: number
  exactHits: number
  missedExams: number
  accuracy: number
}

export type ExamView = {
  id: string
  code: ExamCode
  lockAt: string
  endsAt: string | null
  status: ExamStatus
  locked: boolean
}

export type PoolView = {
  id: string
  externalRef: string
  startsAt: string
  endsAt: string
  status: 'upcoming' | 'open' | 'settling' | 'closed'
  sourceAvailable: boolean
  enrolledAt: string | null
  exams: ExamView[]
}

export type PoolSummary = Pick<
  PoolView,
  'id' | 'externalRef' | 'startsAt' | 'endsAt' | 'status'
>

export type ExamResultView = {
  code: ExamCode
  validated: boolean | null
  score: number | null
}

export type PoolerView = {
  intraUserId: number
  login: string
  displayName: string
  avatarUrl: string
  results: ExamResultView[]
}

export type ProjectResultView = {
  projectId: number
  name: string
  validated: boolean | null
  score: number | null
  week: number
}

export type BetView = {
  id: string
  examId: string
  poolerIntraId: number
  prediction: Prediction
  predictedScore: number | null
  createdAt: string
  updatedAt: string
}

export type BetInput = {
  prediction: Prediction
  predictedScore: number | null
}

export type RevealedBetView = BetView & {
  bettorIntraId: number
  bettorLogin: string
  poolerLogin: string
}

export type PredictionHistoryEntryView = BetView & {
  examCode: ExamCode
  examEnded: boolean
  poolerLogin: string
  poolerDisplayName: string
  poolerAvatarUrl: string
}

export type PredictionHistoryView = {
  user: Pick<Viewer, 'intraUserId' | 'login' | 'displayName' | 'avatarUrl'>
  isViewer: boolean
  predictions: PredictionHistoryEntryView[]
}

export type LeaderboardEntry = {
  rank: number
  intraUserId: number
  login: string
  displayName: string
  avatarUrl: string
  totalScore: number
  predictions: number
  correct: number
  wrong: number
  exactHits: number
  missedExams: number
  accuracy: number
}

export type ApiErrorBody = {
  error: string
  message: string
}

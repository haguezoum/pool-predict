import type {
  ApiErrorBody,
  BetInput,
  BetView,
  LeaderboardEntry,
  PredictionHistoryView,
  PoolSummary,
  PoolerView,
  PoolView,
  ProjectResultView,
  RevealedBetView,
  Viewer,
} from '@shared/contracts'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    status: number,
    code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let body: ApiErrorBody = {
      error: 'REQUEST_FAILED',
      message: `Request failed with status ${response.status}`,
    }
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Keep the stable fallback for non-JSON infrastructure errors.
    }
    throw new ApiError(response.status, body.error, body.message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const POOLER_PROJECTS_CACHE_MS = 5 * 60_000

function withCampus(path: string, campusId: number) {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}campusId=${encodeURIComponent(campusId)}`
}

export function poolerProjectsQueryKey(
  campusId: number,
  poolId: string,
  poolerIntraId: number
) {
  return ['pooler-projects', campusId, poolId, poolerIntraId] as const
}

export const api = {
  me: () => request<Viewer>('/api/me'),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  currentPool: (campusId: number) => request<PoolView>(withCampus('/api/pools/current', campusId)),
  pools: (campusId: number) => request<PoolSummary[]>(withCampus('/api/pools', campusId)),
  pool: (poolId: string, campusId: number) =>
    request<PoolView>(withCampus(`/api/pools/${poolId}`, campusId)),
  poolers: (poolId: string, campusId: number) =>
    request<PoolerView[]>(withCampus(`/api/pools/${poolId}/poolers`, campusId)),
  poolerProjects: (poolId: string, poolerIntraId: number, campusId: number) =>
    request<ProjectResultView[]>(
      withCampus(`/api/pools/${poolId}/poolers/${poolerIntraId}/projects`, campusId)
    ),
  myBets: (poolId: string, campusId: number) =>
    request<BetView[]>(withCampus(`/api/bets/mine?poolId=${encodeURIComponent(poolId)}`, campusId)),
  predictionHistory: (poolId: string, intraUserId: number, campusId: number) =>
    request<PredictionHistoryView>(
      withCampus(`/api/pools/${encodeURIComponent(poolId)}/users/${intraUserId}/predictions`, campusId)
    ),
  saveBet: (examId: string, poolerIntraId: number, campusId: number, input: BetInput) =>
    request<BetView>(withCampus(`/api/bets/${examId}/${poolerIntraId}`, campusId), {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteBet: (examId: string, poolerIntraId: number, campusId: number) =>
    request<void>(withCampus(`/api/bets/${examId}/${poolerIntraId}`, campusId), { method: 'DELETE' }),
  revealedBets: (examId: string, campusId: number) =>
    request<RevealedBetView[]>(withCampus(`/api/exams/${examId}/revealed-bets`, campusId)),
  leaderboard: (campusId: number, poolId?: string) =>
    request<LeaderboardEntry[]>(
      withCampus(`/api/leaderboard${poolId ? `?poolId=${encodeURIComponent(poolId)}` : ''}`, campusId)
    ),
}

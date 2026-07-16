import type {
  ApiErrorBody,
  BetInput,
  BetView,
  LeaderboardEntry,
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

export const api = {
  me: () => request<Viewer>('/api/me'),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  currentPool: () => request<PoolView>('/api/pools/current'),
  pools: () => request<PoolSummary[]>('/api/pools'),
  pool: (poolId: string) => request<PoolView>(`/api/pools/${poolId}`),
  poolers: (poolId: string) => request<PoolerView[]>(`/api/pools/${poolId}/poolers`),
  poolerProjects: (poolId: string, poolerIntraId: number) =>
    request<ProjectResultView[]>(
      `/api/pools/${poolId}/poolers/${poolerIntraId}/projects`
    ),
  myBets: (poolId: string) =>
    request<BetView[]>(`/api/bets/mine?poolId=${encodeURIComponent(poolId)}`),
  saveBet: (examId: string, poolerIntraId: number, input: BetInput) =>
    request<BetView>(`/api/bets/${examId}/${poolerIntraId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteBet: (examId: string, poolerIntraId: number) =>
    request<void>(`/api/bets/${examId}/${poolerIntraId}`, { method: 'DELETE' }),
  revealedBets: (examId: string) =>
    request<RevealedBetView[]>(`/api/exams/${examId}/revealed-bets`),
  leaderboard: (poolId?: string) =>
    request<LeaderboardEntry[]>(
      `/api/leaderboard${poolId ? `?poolId=${encodeURIComponent(poolId)}` : ''}`
    ),
}

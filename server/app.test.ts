import type { Server } from 'node:http'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import type { Env } from './env.js'
import type { FortyTwoClient } from './services/forty-two.js'
import type { LivePoolSnapshot } from './services/forty-two.js'
import type { Repository } from './services/repository.js'

const env: Env = {
  nodeEnv: 'test',
  appOrigin: 'http://localhost:5173',
  apiPort: 3001,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:5173/api/auth/42/callback',
  campusId: 55,
  allowedKinds: ['student'],
  allowedCampusIds: [],
  allowPoolers: false,
  databaseUrl: 'postgres://unused',
  databaseRole: 'pool_predict_api',
  sessionSecret: 'test-session-secret-long-enough',
}

function testApp() {
  const repository = {
    checkConnection: vi.fn().mockResolvedValue(undefined),
  } as unknown as Repository
  const fortyTwo = {} as FortyTwoClient
  return { app: createApp({ env, repository, fortyTwo }), repository }
}

const servers: Server[] = []

async function localRequest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
    listening.once('error', reject)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind')
  return { client: request(`http://127.0.0.1:${address.port}`) }
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  )
})

describe('Express API boundary', () => {
  it('reports database-backed health without exposing implementation secrets', async () => {
    const { app, repository } = testApp()
    const { client } = await localRequest(app)
    const response = await client.get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      database: 'connected',
      service: 'pool-predict-api',
    })
    expect(repository.checkConnection).toHaveBeenCalledOnce()
  })

  it('requires a local session for protected routes', async () => {
    const { app } = testApp()
    const { client } = await localRequest(app)
    const response = await client.get('/api/me')

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('UNAUTHENTICATED')
  })

  it('rejects API requests for another campus before reading pool data', async () => {
    const getLatestPool = vi.fn()
    const repository = {
      getSession: vi.fn().mockResolvedValue({
        user: { id: 'user-id', intraUserId: 42, campusId: 55 },
      }),
      getLatestPool,
    } as unknown as Repository
    const app = createApp({ env, repository, fortyTwo: {} as FortyTwoClient })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/leaderboard?campusId=16')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('CROSS_CAMPUS_ACCESS')
    expect(getLatestPool).not.toHaveBeenCalled()
  })

  it('returns the signed-in viewer without synchronizing or settling the live pool', async () => {
    const user = { id: 'user-id', intraUserId: 42, campusId: 55 }
    const repository = {
      getSession: vi.fn().mockResolvedValue({ user }),
      listUserPools: vi.fn().mockResolvedValue([{ pool: { id: 'pool-id' } }]),
      getUserStats: vi.fn().mockResolvedValue({
        total_score: 7,
        rank: 2,
        predictions: 4,
        correct: 3,
        wrong: 1,
        exact_hits: 1,
        missed_exams: 0,
      }),
    } as unknown as Repository
    const fortyTwo = {
      getUser: vi.fn().mockResolvedValue({
        id: 42,
        login: 'tester',
        displayname: 'Test User',
        kind: 'student',
        campus: [{ id: 55, name: '1337 MED' }],
        campus_users: [{ campus_id: 55, is_primary: true }],
      }),
      getCurrentPool: vi.fn(),
      getExamResults: vi.fn(),
    } as unknown as FortyTwoClient
    const app = createApp({ env, repository, fortyTwo })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/me')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      intraUserId: 42,
      login: 'tester',
      totalScore: 7,
      rank: 2,
    })
    expect(fortyTwo.getCurrentPool).not.toHaveBeenCalled()
    expect(fortyTwo.getExamResults).not.toHaveBeenCalled()
  })

  it('loads poolers without requesting results for exams that are still open', async () => {
    const user = { id: 'user-id', intraUserId: 7, campusId: 55 }
    const now = Date.now()
    const snapshot: LivePoolSnapshot = {
      externalRef: 'piscine-c:55:2026-07-06',
      campusId: 55,
      cursusId: 9,
      startsAt: new Date(now - 7 * 24 * 60 * 60 * 1_000),
      endsAt: new Date(now + 21 * 24 * 60 * 60 * 1_000),
      poolers: [{ intraUserId: 42, login: 'pooler', displayName: 'Pooler', avatarUrl: '', level: 4.2 }],
      projects: [],
      exams: [
        {
          code: '00',
          externalExamId: 1,
          externalProjectId: 1301,
          lockAt: new Date(now - 60_000),
          endsAt: new Date(now + 60_000),
        },
        {
          code: '01',
          externalExamId: 2,
          externalProjectId: 1302,
          lockAt: new Date(now + 24 * 60 * 60 * 1_000),
          endsAt: new Date(now + 25 * 60 * 60 * 1_000),
        },
      ],
    }
    const repository = {
      getSession: vi.fn().mockResolvedValue({ user }),
      upsertPool: vi.fn().mockResolvedValue({ pool: { id: 'pool-id' }, exams: [] }),
    } as unknown as Repository
    const getExamResults = vi.fn().mockResolvedValue(
      new Map([[42, { validated: true, score: 80 }]])
    )
    const fortyTwo = {
      getCurrentPool: vi.fn().mockResolvedValue(snapshot),
      getExamResults,
    } as unknown as FortyTwoClient
    const app = createApp({ env, repository, fortyTwo })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/pools/pool-id/poolers')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(200)
    expect(getExamResults).toHaveBeenCalledOnce()
    expect(getExamResults).toHaveBeenCalledWith(snapshot, snapshot.exams[0])
    expect(response.body[0].level).toBe(4.2)
    expect(response.body[0].results).toEqual([
      { code: '00', validated: true, score: 80 },
      { code: '01', validated: null, score: null },
    ])
  })

  it('loads a pooler project history only from the live 42 source', async () => {
    const user = { id: 'user-id', intraUserId: 7, campusId: 55 }
    const snapshot: LivePoolSnapshot = {
      externalRef: 'piscine-c:55:2026-07-06',
      campusId: 55,
      cursusId: 9,
      startsAt: new Date('2026-07-06T08:30:00.000Z'),
      endsAt: new Date('2026-08-03T08:30:00.000Z'),
      poolers: [{ intraUserId: 42, login: 'pooler', displayName: 'Pooler', avatarUrl: '', level: 4.2 }],
      exams: [],
      projects: [{ id: 100, name: 'C Piscine C 00', position: 1 }],
    }
    const projectResults = [
      { projectId: 100, name: 'C Piscine C 00', validated: true, score: 75, week: 0 },
    ]
    const repository = {
      getSession: vi.fn().mockResolvedValue({ user }),
      upsertPool: vi.fn().mockResolvedValue({ pool: { id: 'pool-id' }, exams: [] }),
    } as unknown as Repository
    const fortyTwo = {
      getCurrentPool: vi.fn().mockResolvedValue(snapshot),
      getPoolerProjectResults: vi.fn().mockResolvedValue(projectResults),
    } as unknown as FortyTwoClient
    const app = createApp({ env, repository, fortyTwo })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/pools/pool-id/poolers/42/projects')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual(projectResults)
    expect(response.headers['cache-control']).toBe('private, max-age=300')
    expect(fortyTwo.getPoolerProjectResults).toHaveBeenCalledWith(snapshot, 42)
  })

  it('sorts all leaderboard members by rank, login tie-break, then creation date', async () => {
    const user = { id: 'user-id', intraUserId: 7, campusId: 55 }
    const leaderboardRow = (
      intraUserId: number,
      rank: number,
      createdAt: string,
      totalScore = 0
    ) => ({
      user_id: `user-${intraUserId}`,
      intra_user_id: intraUserId,
      created_at: createdAt,
      total_score: totalScore,
      rank,
      predictions: 0,
      correct: 0,
      wrong: 0,
      exact_hits: 0,
      missed_exams: 0,
    })
    const repository = {
      getSession: vi.fn().mockResolvedValue({ user }),
      getLatestPool: vi.fn().mockResolvedValue({ pool: { id: 'pool-id' }, exams: [] }),
      getPool: vi.fn().mockResolvedValue({ pool: { id: 'pool-id', campusId: 55 }, exams: [] }),
      rebuildLeaderboard: vi.fn().mockResolvedValue(undefined),
      getLeaderboard: vi.fn().mockResolvedValue([
        leaderboardRow(5, 0, '2026-01-01T00:00:00.000Z'),
        leaderboardRow(2, 2, '2026-01-03T00:00:00.000Z', 10),
        leaderboardRow(4, 0, '2026-01-02T00:00:00.000Z'),
        leaderboardRow(1, 1, '2026-01-04T00:00:00.000Z', 20),
        leaderboardRow(3, 2, '2026-01-05T00:00:00.000Z', 10),
      ]),
    } as unknown as Repository
    const fortyTwo = {
      getCurrentPool: vi.fn(),
      getUsers: vi.fn().mockResolvedValue([
        { id: 1, login: 'champ', displayname: 'Champion' },
        { id: 2, login: 'zebra', displayname: 'Zebra' },
        { id: 3, login: 'alpha', displayname: 'Alpha' },
        { id: 4, login: 'newer', displayname: 'Newer' },
        { id: 5, login: 'older', displayname: 'Older' },
      ]),
    } as unknown as FortyTwoClient
    const app = createApp({ env, repository, fortyTwo })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/leaderboard')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(200)
    expect(response.body.map((entry: { login: string }) => entry.login)).toEqual([
      'champ',
      'alpha',
      'zebra',
      'older',
      'newer',
    ])
    expect(response.body.at(-1)).toMatchObject({ login: 'newer', rank: 0 })
    expect(fortyTwo.getCurrentPool).not.toHaveBeenCalled()
    expect(repository.rebuildLeaderboard).toHaveBeenCalledWith('pool-id', 55)
  })

  it('shows another player predictions only for exams that have ended', async () => {
    const now = Date.now()
    const viewer = { id: 'viewer-id', intraUserId: 7, campusId: 55 }
    const target = { id: 'target-id', intraUserId: 8, campusId: 55 }
    const endedExam = {
      id: 'ended-exam',
      poolId: 'pool-id',
      code: '00' as const,
      lockAt: new Date(now - 2 * 60 * 60_000),
      endsAt: new Date(now - 60_000),
    }
    const activeExam = {
      id: 'active-exam',
      poolId: 'pool-id',
      code: '01' as const,
      lockAt: new Date(now - 60_000),
      endsAt: new Date(now + 60 * 60_000),
    }
    const bets = [endedExam, activeExam].map((exam, index) => ({
      id: `bet-${index}`,
      poolId: 'pool-id',
      examId: exam.id,
      userId: target.id,
      poolerIntraId: 42 + index,
      prediction: 'validate' as const,
      predictedScore: 80 + index,
      createdAt: new Date(now - 10_000),
      updatedAt: new Date(now - 5_000),
    }))
    const getSession = vi.fn().mockResolvedValue({ user: viewer })
    const repository = {
      getSession,
      getPool: vi.fn().mockResolvedValue({ pool: { id: 'pool-id' }, exams: [endedExam, activeExam] }),
      getPoolMemberByIntraId: vi.fn().mockResolvedValue(target),
      listUserBets: vi.fn().mockResolvedValue(bets),
    } as unknown as Repository
    const fortyTwo = {
      getUsers: vi.fn().mockResolvedValue([
        { id: 8, login: 'player', displayname: 'Player User' },
        { id: 42, login: 'pooler', displayname: 'Pooler User' },
      ]),
    } as unknown as FortyTwoClient
    const app = createApp({ env, repository, fortyTwo })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/pools/pool-id/users/8/predictions')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(200)
    expect(response.body.isViewer).toBe(false)
    expect(response.body.predictions).toHaveLength(1)
    expect(response.body.predictions[0]).toMatchObject({
      examCode: '00',
      examEnded: true,
      poolerLogin: 'pooler',
    })

    getSession.mockResolvedValue({ user: target })
    const ownResponse = await client
      .get('/api/pools/pool-id/users/8/predictions')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(ownResponse.status).toBe(200)
    expect(ownResponse.body.isViewer).toBe(true)
    expect(ownResponse.body.predictions).toHaveLength(2)
    expect(ownResponse.body.predictions[1]).toMatchObject({
      examCode: '01',
      examEnded: false,
    })
  })

  it('keeps revealed predictions private until the exam has ended', async () => {
    const user = { id: 'user-id', intraUserId: 7, campusId: 55 }
    const repository = {
      getSession: vi.fn().mockResolvedValue({ user }),
      getExam: vi.fn().mockResolvedValue({
        id: 'exam-id',
        poolId: 'pool-id',
        lockAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      }),
      listExamBets: vi.fn(),
    } as unknown as Repository
    const app = createApp({ env, repository, fortyTwo: {} as FortyTwoClient })
    const { client } = await localRequest(app)

    const response = await client
      .get('/api/exams/exam-id/revealed-bets')
      .set('Cookie', 'pool_predict_session=session-token')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: 'BETS_PRIVATE',
      message: 'Predictions are private until the exam ends',
    })
    expect(repository.listExamBets).not.toHaveBeenCalled()
  })

  it('rejects cross-origin state-changing requests', async () => {
    const { app } = testApp()
    const { client } = await localRequest(app)
    const response = await client.post('/api/auth/logout')
      .set('Origin', 'https://attacker.example')

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('INVALID_ORIGIN')
  })

  it('starts OAuth with state and an HttpOnly cookie', async () => {
    const { app } = testApp()
    const { client } = await localRequest(app)
    const response = await client.get('/api/auth/42')

    expect(response.status).toBe(302)
    const location = new URL(response.headers.location)
    expect(location.origin).toBe('https://api.intra.42.fr')
    expect(location.searchParams.get('client_id')).toBe(env.clientId)
    expect(location.searchParams.get('state')).toBeTruthy()
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly')
  })
})

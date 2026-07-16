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

  it('returns the signed-in viewer without synchronizing or settling the live pool', async () => {
    const user = { id: 'user-id', intraUserId: 42 }
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
    const user = { id: 'user-id', intraUserId: 7 }
    const now = Date.now()
    const snapshot: LivePoolSnapshot = {
      externalRef: 'piscine-c:55:2026-07-06',
      campusId: 55,
      cursusId: 9,
      startsAt: new Date(now - 7 * 24 * 60 * 60 * 1_000),
      endsAt: new Date(now + 21 * 24 * 60 * 60 * 1_000),
      poolers: [{ intraUserId: 42, login: 'pooler', displayName: 'Pooler', avatarUrl: '' }],
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
    expect(response.body[0].results).toEqual([
      { code: '00', validated: true, score: 80 },
      { code: '01', validated: null, score: null },
    ])
  })

  it('loads a pooler project history only from the live 42 source', async () => {
    const user = { id: 'user-id', intraUserId: 7 }
    const snapshot: LivePoolSnapshot = {
      externalRef: 'piscine-c:55:2026-07-06',
      campusId: 55,
      cursusId: 9,
      startsAt: new Date('2026-07-06T08:30:00.000Z'),
      endsAt: new Date('2026-08-03T08:30:00.000Z'),
      poolers: [{ intraUserId: 42, login: 'pooler', displayName: 'Pooler', avatarUrl: '' }],
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
    expect(fortyTwo.getPoolerProjectResults).toHaveBeenCalledWith(snapshot, 42)
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

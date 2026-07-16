import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FortyTwoClient,
  isEligibleUser,
  selectActiveCohort,
  type FortyTwoUser,
  type LivePoolSnapshot,
} from './forty-two.js'
import type { Env, UserKind } from '../env.js'

function user(overrides: Partial<FortyTwoUser> = {}): FortyTwoUser {
  return {
    id: 42,
    login: 'student',
    kind: 'student',
    'active?': true,
    'alumni?': false,
    'staff?': false,
    campus_users: [{ campus_id: 77, is_primary: true }],
    cursus_users: [{ end_at: null, cursus: { id: 2, slug: '42' } }],
    ...overrides,
  }
}

function policy(overrides: {
  allowedCampusIds?: number[]
  allowedKinds?: UserKind[]
  allowPoolers?: boolean
} = {}) {
  return {
    allowedCampusIds: new Set<number>(overrides.allowedCampusIds ?? [77]),
    allowedKinds: new Set<UserKind>(overrides.allowedKinds ?? ['student']),
    allowPoolers: overrides.allowPoolers ?? false,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('42 eligibility', () => {
  it('allows an active Tetouan core student', () => {
    expect(isEligibleUser(user(), policy(), new Set()).eligible).toBe(true)
  })

  it('rejects another primary campus', () => {
    expect(
      isEligibleUser(user(), policy({ allowedCampusIds: [12] }), new Set()).reason
    ).toBe('INELIGIBLE_CAMPUS')
  })

  it('allows an explicitly configured additional campus', () => {
    expect(
      isEligibleUser(user(), policy({ allowedCampusIds: [77, 993, 444] }), new Set())
        .eligible
    ).toBe(true)
  })

  it('rejects current poolers', () => {
    expect(isEligibleUser(user(), policy(), new Set([42])).reason).toBe(
      'POOLER_ACCESS_DENIED'
    )
  })

  it('allows current poolers when configured', () => {
    expect(
      isEligibleUser(user(), policy({ allowPoolers: true }), new Set([42])).eligible
    ).toBe(true)
  })

  it('allows admin only when admin is configured', () => {
    const admin = user({ kind: 'admin' })
    expect(isEligibleUser(admin, policy(), new Set()).reason).toBe('USER_KIND_NOT_ALLOWED')
    expect(
      isEligibleUser(admin, policy({ allowedKinds: ['admin'] }), new Set()).eligible
    ).toBe(true)
  })

  it('allows external only when external is configured', () => {
    const external = user({ kind: 'external' })
    expect(isEligibleUser(external, policy(), new Set()).reason).toBe(
      'USER_KIND_NOT_ALLOWED'
    )
    expect(
      isEligibleUser(external, policy({ allowedKinds: ['external'] }), new Set()).eligible
    ).toBe(true)
  })

  it('uses kind directly without conflicting with active or alumni flags', () => {
    const alumniStudent = user({
      kind: 'student',
      'alumni?': true,
      'active?': false,
      cursus_users: [],
    })
    expect(isEligibleUser(alumniStudent, policy(), new Set()).eligible).toBe(true)
  })

  it('rejects an undocumented kind', () => {
    expect(
      isEligibleUser(user({ kind: 'staff' }), policy(), new Set()).reason
    ).toBe('USER_KIND_NOT_ALLOWED')
  })
})

describe('Piscine cohort selection', () => {
  const cohortUser = (id: number, beginAt: string) => ({
    id,
    begin_at: beginAt,
    end_at: null,
    user: { id, login: `pooler-${id}` },
  })

  it('selects only the four-week cohort containing server time', () => {
    const rows = [
      cohortUser(1, '2025-01-06T08:30:00.000Z'),
      cohortUser(2, '2026-07-06T08:30:00.000Z'),
      cohortUser(3, '2026-07-06T09:00:00.000Z'),
    ]
    const selected = selectActiveCohort(rows, new Date('2026-07-15T12:00:00.000Z'))

    expect(selected?.key).toBe('2026-07-06')
    expect(selected?.users).toHaveLength(2)
  })

  it('does not silently revive an old cohort when no pool is active', () => {
    const rows = [cohortUser(1, '2025-01-06T08:30:00.000Z')]

    expect(selectActiveCohort(rows, new Date('2026-07-15T12:00:00.000Z'))).toBeUndefined()
  })
})

describe('42 pool discovery', () => {
  it('coalesces concurrent discovery requests into one 42 request graph', async () => {
    const beginAt = new Date().toISOString()
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname === '/oauth/token') {
        return Response.json({ access_token: 'app-token', expires_in: 7_200 })
      }
      if (url.pathname === '/v2/cursus/9/cursus_users') {
        return Response.json([
          {
            id: 1,
            begin_at: beginAt,
            end_at: null,
            user: { id: 42, login: 'pooler' },
          },
        ])
      }
      if (url.pathname === '/v2/cursus') {
        return Response.json([{ id: 9, slug: 'c-piscine', name: 'C Piscine', kind: 'piscine' }])
      }
      if (url.pathname === '/v2/users') {
        return Response.json([{ id: 42, login: 'pooler', kind: 'student' }])
      }
      if (url.pathname === '/v2/campus/55/cursus/9/exams') {
        return Response.json([])
      }
      if (url.pathname === '/v2/cursus/9/projects') {
        return Response.json([])
      }
      return new Response('Unexpected 42 request', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const env: Env = {
      nodeEnv: 'test',
      appOrigin: 'http://localhost:5173',
      apiPort: 3001,
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:5173/api/auth/42/callback',
      campusId: 55,
      allowedKinds: ['admin', 'student', 'external'],
      allowedCampusIds: [],
      allowPoolers: false,
      databaseUrl: 'postgres://unused',
      databaseRole: 'pool_predict_api',
      sessionSecret: 'test-session-secret-long-enough',
    }
    const client = new FortyTwoClient(env)

    const [first, second] = await Promise.all([
      client.getCurrentPool(),
      client.getCurrentPool(),
    ])

    expect(first).toBe(second)
    expect(first.poolers).toHaveLength(1)
    const rosterRequests = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/v2/cursus/9/cursus_users')
    )
    expect(rosterRequests).toHaveLength(1)
  })
})

describe('42 Piscine project results', () => {
  it('returns current-cohort non-exam project scores grouped by Piscine week', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname === '/oauth/token') {
        return Response.json({ access_token: 'app-token', expires_in: 7_200 })
      }
      if (url.pathname === '/v2/users/42/projects_users') {
        return Response.json([
          {
            id: 1,
            final_mark: 99,
            'validated?': true,
            created_at: '2025-01-07T10:00:00.000Z',
            marked_at: '2025-01-08T10:00:00.000Z',
            updated_at: '2025-01-08T10:00:00.000Z',
            project: { id: 100, name: 'C Piscine C 00' },
            user: { id: 42, login: 'pooler' },
          },
          {
            id: 2,
            final_mark: 80,
            'validated?': true,
            created_at: '2026-07-07T10:00:00.000Z',
            marked_at: '2026-07-09T10:00:00.000Z',
            updated_at: '2026-07-09T10:00:00.000Z',
            project: { id: 100, name: 'C Piscine C 00' },
            user: { id: 42, login: 'pooler' },
          },
          {
            id: 3,
            final_mark: 60,
            'validated?': true,
            created_at: '2026-07-14T10:00:00.000Z',
            marked_at: '2026-07-16T10:00:00.000Z',
            updated_at: '2026-07-16T10:00:00.000Z',
            project: { id: 101, name: 'C Piscine C 01' },
            user: { id: 42, login: 'pooler' },
          },
          {
            id: 4,
            final_mark: 100,
            'validated?': true,
            created_at: '2026-07-14T10:00:00.000Z',
            marked_at: '2026-07-16T10:00:00.000Z',
            updated_at: '2026-07-16T10:00:00.000Z',
            project: { id: 999, name: 'Exam 01' },
            user: { id: 42, login: 'pooler' },
          },
        ])
      }
      return new Response('Unexpected 42 request', { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const env: Env = {
      nodeEnv: 'test',
      appOrigin: 'http://localhost:5173',
      apiPort: 3001,
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:5173/api/auth/42/callback',
      campusId: 55,
      allowedKinds: ['admin', 'student', 'external'],
      allowedCampusIds: [],
      allowPoolers: false,
      databaseUrl: 'postgres://unused',
      databaseRole: 'pool_predict_api',
      sessionSecret: 'test-session-secret-long-enough',
    }
    const snapshot: LivePoolSnapshot = {
      externalRef: 'piscine-c:55:2026-07-06',
      campusId: 55,
      cursusId: 9,
      startsAt: new Date('2026-07-06T08:30:00.000Z'),
      endsAt: new Date('2026-08-03T08:30:00.000Z'),
      poolers: [{ intraUserId: 42, login: 'pooler', displayName: 'Pooler', avatarUrl: '' }],
      exams: [],
      projects: [
        { id: 100, name: 'C Piscine C 00', position: 1 },
        { id: 101, name: 'C Piscine C 01', position: 2 },
      ],
    }

    const results = await new FortyTwoClient(env).getPoolerProjectResults(snapshot, 42)

    expect(results).toEqual([
      { projectId: 100, name: 'C Piscine C 00', validated: true, score: 80, week: 0 },
      { projectId: 101, name: 'C Piscine C 01', validated: true, score: 60, week: 1 },
    ])
  })
})

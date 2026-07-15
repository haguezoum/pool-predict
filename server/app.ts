import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import { parseCookie, stringifySetCookie } from 'cookie'
import { z } from 'zod'
import type {
  BetInput,
  BetView,
  ExamView,
  LeaderboardEntry,
  PoolSummary,
  PoolView,
  Viewer,
} from '../shared/contracts.ts'
import { getDb } from './db/client.ts'
import { getEnv, type Env } from './env.ts'
import {
  FortyTwoClient,
  FortyTwoUnavailableError,
  isEligibleCoreStudent,
  toPublicUser,
} from './services/forty-two.ts'
import { Repository, type AppUserRow, type ExamRow } from './services/repository.ts'
import { getPoolStatus, settlePool, syncPool, type SyncedPool } from './services/sync.ts'

const SESSION_COOKIE = 'pool_predict_session'
const OAUTH_STATE_COOKIE = 'pool_predict_oauth_state'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

type AuthState = {
  user: AppUserRow
  tokenHash: string
}

class ApiError extends Error {
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

type Dependencies = {
  env: Env
  repository: Repository
  fortyTwo: FortyTwoClient
}

const betInputSchema = z
  .object({
    prediction: z.enum(['validate', 'not_validate']),
    predictedScore: z.number().int().min(0).max(100).nullable(),
  })
  .superRefine((value, context) => {
    if (value.prediction === 'validate' && value.predictedScore === null) {
      context.addIssue({
        code: 'custom',
        message: 'A validated prediction requires an exact score',
      })
    }
    if (value.prediction === 'not_validate' && value.predictedScore !== null) {
      context.addIssue({
        code: 'custom',
        message: 'A not-validated prediction cannot include a score',
      })
    }
  })

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next)
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function cookieOptions(env: Env, maxAge: number) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAge / 1_000),
  }
}

function setCookie(res: Response, name: string, value: string, env: Env, maxAge: number) {
  res.append(
    'set-cookie',
    stringifySetCookie({ name, value, ...cookieOptions(env, maxAge) })
  )
}

function clearCookie(res: Response, name: string, env: Env) {
  res.append(
    'set-cookie',
    stringifySetCookie({ name, value: '', ...cookieOptions(env, 0) })
  )
}

function routeParam(req: Request, name: string) {
  const value = req.params[name]
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_ROUTE', 'Invalid route parameter')
  return value
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function poolView(
  pool: SyncedPool['pool'],
  exams: ExamRow[],
  enrolledAt: Date | null,
  sourceAvailable: boolean
): PoolView {
  const now = new Date()
  return {
    id: pool.id,
    externalRef: pool.externalRef,
    startsAt: pool.startsAt.toISOString(),
    endsAt: pool.endsAt.toISOString(),
    status: getPoolStatus(pool.startsAt, pool.endsAt, exams),
    sourceAvailable,
    enrolledAt: enrolledAt?.toISOString() ?? null,
    exams: exams.map((exam): ExamView => {
      const locked = now >= exam.lockAt
      const status = !locked
        ? 'open'
        : exam.endsAt && now < exam.endsAt
          ? 'locked'
          : 'settling'
      return {
        id: exam.id,
        code: exam.code,
        lockAt: exam.lockAt.toISOString(),
        endsAt: exam.endsAt?.toISOString() ?? null,
        status,
        locked,
      }
    }),
  }
}

function betView(row: Awaited<ReturnType<Repository['listUserBets']>>[number]): BetView {
  return {
    id: row.id,
    examId: row.examId,
    poolerIntraId: row.poolerIntraId,
    prediction: row.prediction,
    predictedScore: row.predictedScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function accuracy(correct: number, wrong: number) {
  const settled = correct + wrong
  return settled === 0 ? 0 : Math.round((correct / settled) * 1_000) / 10
}

async function authenticate(
  req: Request,
  repository: Repository
): Promise<AuthState | null> {
  const token = parseCookie(req.headers.cookie ?? '')[SESSION_COOKIE]
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = await repository.getSession(tokenHash)
  return session ? { user: session.user, tokenHash } : null
}

export function createApp(overrides: Partial<Dependencies> = {}) {
  const env = overrides.env ?? getEnv()
  const repository = overrides.repository ?? new Repository(getDb())
  const fortyTwo = overrides.fortyTwo ?? new FortyTwoClient(env)
  const app = express()

  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))
  app.use((_req, res, next) => {
    res.set({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'cache-control': 'no-store',
    })
    next()
  })
  app.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (req.path.endsWith('/internal/sync')) return next()
    const origin = req.headers.origin
    if (origin && origin !== env.appOrigin) {
      return next(new ApiError(403, 'INVALID_ORIGIN', 'The request origin is not allowed'))
    }
    return next()
  })

  const requireAuth = asyncHandler(async (req, res) => {
    const auth = await authenticate(req, repository)
    if (!auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in with 42 to continue')
    res.locals.auth = auth
  })

  function authFrom(res: Response): AuthState {
    return res.locals.auth as AuthState
  }

  app.get('/api/auth/42', (_req, res) => {
    const state = randomBytes(24).toString('base64url')
    setCookie(res, OAUTH_STATE_COOKIE, state, env, 10 * 60 * 1_000)
    const authorize = new URL('https://api.intra.42.fr/oauth/authorize')
    authorize.searchParams.set('client_id', env.clientId)
    authorize.searchParams.set('redirect_uri', env.redirectUri)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('state', state)
    res.redirect(authorize.toString())
  })

  app.get(
    '/api/auth/42/callback',
    asyncHandler(async (req, res) => {
      const code = typeof req.query.code === 'string' ? req.query.code : null
      const state = typeof req.query.state === 'string' ? req.query.state : null
      const storedState = parseCookie(req.headers.cookie ?? '')[OAUTH_STATE_COOKIE]
      clearCookie(res, OAUTH_STATE_COOKIE, env)
      if (!code || !state || !storedState || !safeEqual(state, storedState)) {
        return res.redirect(`${env.appOrigin}/login?error=INVALID_OAUTH_STATE`)
      }

      try {
        const token = await fortyTwo.exchangeAuthorizationCode(code)
        const [me, synced] = await Promise.all([
          fortyTwo.getMe(token.access_token),
          syncPool(repository, fortyTwo),
        ])
        const poolerIds = new Set(synced.snapshot.poolers.map((pooler) => pooler.intraUserId))
        const eligibility = isEligibleCoreStudent(me, synced.snapshot.campusId, poolerIds)
        if (!eligibility.eligible) {
          return res.redirect(`${env.appOrigin}/login?error=${eligibility.reason}`)
        }

        const user = await repository.upsertUser(me.id)
        await repository.enroll(synced.pool.id, user.id, synced.exams)
        const rawSession = randomBytes(32).toString('base64url')
        await repository.createSession(
          hashToken(rawSession),
          user.id,
          new Date(Date.now() + SESSION_DURATION_MS)
        )
        setCookie(res, SESSION_COOKIE, rawSession, env, SESSION_DURATION_MS)
        return res.redirect(`${env.appOrigin}/`)
      } catch (error) {
        const reason =
          error instanceof FortyTwoUnavailableError ? 'SOURCE_UNAVAILABLE' : 'AUTH_FAILED'
        return res.redirect(`${env.appOrigin}/login?error=${reason}`)
      }
    })
  )

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req, res) => {
      const auth = await authenticate(req, repository)
      if (auth) await repository.revokeSession(auth.tokenHash)
      clearCookie(res, SESSION_COOKIE, env)
      res.status(204).end()
    })
  )

  app.get(
    '/api/me',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const auth = authFrom(res)
      const [profile, synced] = await Promise.all([
        fortyTwo.getUser(auth.user.intraUserId),
        syncPool(repository, fortyTwo),
      ])
      const membership =
        (await repository.getMembership(synced.pool.id, auth.user.id)) ??
        (await repository.enroll(synced.pool.id, auth.user.id, synced.exams))
      if (!membership) throw new ApiError(403, 'NOT_ENROLLED', 'Pool enrollment failed')
      await settlePool(repository, fortyTwo, synced)
      const stats = await repository.getUserStats(synced.pool.id, auth.user.id)
      const publicUser = toPublicUser(profile)
      const viewer: Viewer = {
        ...publicUser,
        totalScore: stats.total_score,
        rank: stats.rank,
        predictions: stats.predictions,
        correct: stats.correct,
        wrong: stats.wrong,
        exactHits: stats.exact_hits,
        missedExams: stats.missed_exams,
        accuracy: accuracy(stats.correct, stats.wrong),
      }
      res.json(viewer)
    })
  )

  app.get(
    '/api/pools/current',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const auth = authFrom(res)
      try {
        const synced = await syncPool(repository, fortyTwo)
        const membership =
          (await repository.getMembership(synced.pool.id, auth.user.id)) ??
          (await repository.enroll(synced.pool.id, auth.user.id, synced.exams))
        await settlePool(repository, fortyTwo, synced)
        res.json(poolView(synced.pool, synced.exams, membership?.enrolledAt ?? null, true))
      } catch (error) {
        if (!(error instanceof FortyTwoUnavailableError)) throw error
        const stored = await repository.getLatestPool()
        if (!stored) throw new ApiError(503, 'SOURCE_UNAVAILABLE', '42 data is temporarily unavailable')
        const membership = await repository.getMembership(stored.pool.id, auth.user.id)
        res.json(poolView(stored.pool, stored.exams, membership?.enrolledAt ?? null, false))
      }
    })
  )

  app.get(
    '/api/pools',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const rows = await repository.listUserPools(authFrom(res).user.id)
      const response: PoolSummary[] = await Promise.all(
        rows.map(async ({ pool }) => {
          const stored = await repository.getPool(pool.id)
          return {
            id: pool.id,
            externalRef: pool.externalRef,
            startsAt: pool.startsAt.toISOString(),
            endsAt: pool.endsAt.toISOString(),
            status: getPoolStatus(pool.startsAt, pool.endsAt, stored?.exams ?? []),
          }
        })
      )
      res.json(response)
    })
  )

  app.get(
    '/api/pools/:poolId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const auth = authFrom(res)
      const stored = await repository.getPool(routeParam(req, 'poolId'))
      if (!stored) throw new ApiError(404, 'POOL_NOT_FOUND', 'Pool not found')
      const membership = await repository.getMembership(stored.pool.id, auth.user.id)
      if (!membership) throw new ApiError(403, 'NOT_ENROLLED', 'You did not join this pool')
      res.json(poolView(stored.pool, stored.exams, membership.enrolledAt, true))
    })
  )

  app.get(
    '/api/pools/:poolId/poolers',
    requireAuth,
    asyncHandler(async (req, res) => {
      const synced = await syncPool(repository, fortyTwo)
      if (synced.pool.id !== routeParam(req, 'poolId')) {
        throw new ApiError(409, 'LIVE_DATA_CURRENT_POOL_ONLY', 'Live pooler data is available for the current pool')
      }
      const resultMaps = await Promise.all(
        synced.snapshot.exams.map((exam) => fortyTwo.getExamResults(synced.snapshot, exam))
      )
      res.json(
        synced.snapshot.poolers.map((pooler) => ({
          ...pooler,
          results: synced.snapshot.exams.map((exam, index) => {
            const result = resultMaps[index].get(pooler.intraUserId)
            return {
              code: exam.code,
              validated: result?.validated ?? null,
              score: result?.score ?? null,
            }
          }),
        }))
      )
    })
  )

  app.get(
    '/api/bets/mine',
    requireAuth,
    asyncHandler(async (req, res) => {
      const poolId = typeof req.query.poolId === 'string' ? req.query.poolId : undefined
      const rows = await repository.listUserBets(authFrom(res).user.id, poolId)
      res.json(rows.map(betView))
    })
  )

  app.put(
    '/api/bets/:examId/:pooler42Id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const auth = authFrom(res)
      const input = betInputSchema.parse(req.body) as BetInput
      const poolerIntraId = z.coerce.number().int().positive().parse(routeParam(req, 'pooler42Id'))
      const exam = await repository.getExam(routeParam(req, 'examId'))
      if (!exam) throw new ApiError(404, 'EXAM_NOT_FOUND', 'Exam not found')
      const synced = await syncPool(repository, fortyTwo)
      if (
        synced.pool.id !== exam.poolId ||
        !synced.snapshot.poolers.some((pooler) => pooler.intraUserId === poolerIntraId)
      ) {
        throw new ApiError(422, 'INVALID_POOLER', 'This user is not a pooler in the current pool')
      }
      const saved = await repository.upsertBet(
        auth.user.id,
        exam.id,
        poolerIntraId,
        input
      )
      if (!saved) throw new ApiError(409, 'BETTING_LOCKED', 'This exam is already locked')
      res.json(betView(saved))
    })
  )

  app.delete(
    '/api/bets/:examId/:pooler42Id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const poolerIntraId = z.coerce.number().int().positive().parse(routeParam(req, 'pooler42Id'))
      const deleted = await repository.deleteBet(
        authFrom(res).user.id,
        routeParam(req, 'examId'),
        poolerIntraId
      )
      if (!deleted) throw new ApiError(409, 'BETTING_LOCKED', 'The bet is missing or already locked')
      res.status(204).end()
    })
  )

  app.get(
    '/api/exams/:examId/revealed-bets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const exam = await repository.getExam(routeParam(req, 'examId'))
      if (!exam) throw new ApiError(404, 'EXAM_NOT_FOUND', 'Exam not found')
      if (new Date() < exam.lockAt) {
        throw new ApiError(403, 'BETS_PRIVATE', 'Predictions are private until the exam locks')
      }
      const rows = await repository.listExamBets(exam.id)
      const profiles = await fortyTwo.getUsers(rows.map((row) => row.poolerIntraId))
      const profileById = new Map(profiles.map((profile) => [profile.id, profile.login]))
      const appUserIds = [...new Set(rows.map((row) => row.userId))]
      const leaderboard = await repository.getLeaderboard(exam.poolId)
      const bettorIntraByAppId = new Map(leaderboard.map((row) => [row.user_id, row.intra_user_id]))
      const bettorProfiles = await fortyTwo.getUsers(
        appUserIds.map((id) => bettorIntraByAppId.get(id)).filter((id): id is number => Boolean(id))
      )
      const bettorLoginById = new Map(bettorProfiles.map((profile) => [profile.id, profile.login]))
      res.json(
        rows.map((row) => {
          const bettorIntraId = bettorIntraByAppId.get(row.userId) ?? 0
          return {
            ...betView(row),
            bettorIntraId,
            bettorLogin: bettorLoginById.get(bettorIntraId) ?? `user-${bettorIntraId}`,
            poolerLogin: profileById.get(row.poolerIntraId) ?? `user-${row.poolerIntraId}`,
          }
        })
      )
    })
  )

  app.get(
    '/api/leaderboard',
    requireAuth,
    asyncHandler(async (req, res) => {
      const requestedPoolId = typeof req.query.poolId === 'string' ? req.query.poolId : null
      let poolId = requestedPoolId
      try {
        const synced = await syncPool(repository, fortyTwo)
        if (!poolId || poolId === synced.pool.id) {
          poolId = synced.pool.id
          await settlePool(repository, fortyTwo, synced)
        }
      } catch (error) {
        if (!(error instanceof FortyTwoUnavailableError)) throw error
      }
      if (!poolId) {
        const stored = await repository.getLatestPool()
        poolId = stored?.pool.id ?? null
      }
      if (!poolId) throw new ApiError(404, 'POOL_NOT_FOUND', 'No pool is available')
      await repository.rebuildLeaderboard(poolId)
      const rows = await repository.getLeaderboard(poolId)
      const profiles = await fortyTwo.getUsers(rows.map((row) => row.intra_user_id))
      const profileById = new Map(profiles.map((profile) => [profile.id, toPublicUser(profile)]))
      const response: LeaderboardEntry[] = rows.map((row) => {
        const profile = profileById.get(row.intra_user_id)
        return {
          rank: row.rank,
          intraUserId: row.intra_user_id,
          login: profile?.login ?? `user-${row.intra_user_id}`,
          displayName: profile?.displayName ?? `42 user ${row.intra_user_id}`,
          avatarUrl: profile?.avatarUrl ?? '',
          totalScore: row.total_score,
          predictions: row.predictions,
          correct: row.correct,
          wrong: row.wrong,
          exactHits: row.exact_hits,
          missedExams: row.missed_exams,
          accuracy: accuracy(row.correct, row.wrong),
        }
      })
      res.json(response)
    })
  )

  app.get(
    '/api/internal/sync',
    asyncHandler(async (req, res) => {
      if (!env.cronSecret) throw new ApiError(503, 'CRON_NOT_CONFIGURED', 'CRON_SECRET is missing')
      const authorization = req.headers.authorization ?? ''
      if (!safeEqual(authorization, `Bearer ${env.cronSecret}`)) {
        throw new ApiError(401, 'INVALID_CRON_SECRET', 'Invalid cron secret')
      }
      const synced = await syncPool(repository, fortyTwo)
      await settlePool(repository, fortyTwo, synced)
      await repository.pruneExpiredSessions()
      res.json({ ok: true, poolId: synced.pool.id, syncedAt: new Date().toISOString() })
    })
  )

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await repository.checkConnection()
      res.json({ ok: true, database: 'connected', service: 'pool-predict-api' })
    })
  )

  app.use((_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'API route not found'))
  })

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Invalid request',
      })
    }
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: error.code, message: error.message })
    }
    if (error instanceof FortyTwoUnavailableError) {
      return res.status(503).json({
        error: 'SOURCE_UNAVAILABLE',
        message: '42 data is temporarily unavailable. Betting is paused.',
      })
    }
    console.error(error)
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred',
    })
  })

  return app
}

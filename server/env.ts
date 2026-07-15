import { z } from 'zod'

const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:5173'

export function resolveRedirectUri(value: string | undefined, origin = appOrigin) {
  const localCallback = new URL('/api/auth/42/callback', origin).toString()
  if (!value) return localCallback

  const configured = new URL(value)
  const isAuthorizeUrl =
    configured.origin === 'https://api.intra.42.fr' &&
    configured.pathname === '/oauth/authorize'

  return isAuthorizeUrl ? localCallback : configured.toString()
}

const raw = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appOrigin,
  apiPort: process.env.API_PORT ?? '3001',
  clientId: process.env.FORTY_TWO_CLIENT_ID ?? process.env.UID,
  clientSecret: process.env.FORTY_TWO_CLIENT_SECRET ?? process.env.Secret,
  redirectUri: resolveRedirectUri(
    process.env.FORTY_TWO_REDIRECT_URI ?? process.env.REDIRECT_URI
  ),
  campusId: process.env.FORTY_TWO_TETOUAN_CAMPUS_ID,
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL,
  databaseRole: process.env.DATABASE_ROLE ?? 'pool_predict_api',
  sessionSecret: process.env.SESSION_SECRET ?? process.env.Next_secre,
  cronSecret: process.env.CRON_SECRET,
}

const schema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  appOrigin: z.string().url(),
  apiPort: z.coerce.number().int().positive(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  campusId: z.coerce.number().int().positive().optional(),
  databaseUrl: z.string().min(1),
  databaseRole: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  sessionSecret: z.string().min(16),
  cronSecret: z.string().min(16).optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= schema.parse(raw)
  return cached
}

export function resetEnvForTests() {
  cached = undefined
}

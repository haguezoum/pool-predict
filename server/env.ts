import { z } from 'zod'

export const USER_KINDS = ['admin', 'student', 'external'] as const
export type UserKind = (typeof USER_KINDS)[number]
const DEFAULT_ALLOWED_KINDS = USER_KINDS.join(',')

const csvValues = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
)

const campusIdValue = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive())

const accessPolicySchema = z.object({
  allowedKinds: csvValues
    .pipe(z.array(z.enum(USER_KINDS)).min(1))
    .transform((values) => [...new Set(values)]),
  allowedCampusIds: csvValues
    .pipe(z.array(campusIdValue))
    .transform((values) => [...new Set(values)]),
  allowPoolers: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.enum(['true', 'false', 'yes', 'no', '1', '0']))
    .transform((value) => ['true', 'yes', '1'].includes(value)),
})

export function parseAccessPolicy(input: z.input<typeof accessPolicySchema>) {
  return accessPolicySchema.parse(input)
}

export function resolveAppOrigin(
  explicitOrigin: string | undefined,
  productionHost: string | undefined,
  deploymentHost: string | undefined
) {
  if (explicitOrigin) {
    try {
      return new URL(explicitOrigin).origin
    } catch {
      return explicitOrigin
    }
  }
  const vercelHost = productionHost ?? deploymentHost
  return vercelHost ? `https://${vercelHost}` : 'http://localhost:5173'
}

const appOrigin = resolveAppOrigin(
  process.env.APP_ORIGIN,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL
)

export function resolveRedirectUri(value: string | undefined, origin = appOrigin) {
  const localCallback = new URL('/api/auth/42/callback', origin).toString()
  if (!value) return localCallback

  let configured: URL
  try {
    configured = new URL(value)
  } catch {
    return value
  }
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
  allowedKinds: process.env.FORTY_TWO_ALLOWED_KINDS ?? DEFAULT_ALLOWED_KINDS,
  allowedCampusIds: process.env.FORTY_TWO_ALLOWED_CAMPUS_IDS ?? '',
  allowPoolers: process.env.FORTY_TWO_ALLOW_POOLERS ?? 'no',
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
}).extend(accessPolicySchema.shape)

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= schema.parse(raw)
  return cached
}

export function resetEnvForTests() {
  cached = undefined
}

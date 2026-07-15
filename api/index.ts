import type { IncomingMessage, ServerResponse } from 'node:http'

const environmentVariableByField: Record<string, string> = {
  clientId: 'FORTY_TWO_CLIENT_ID',
  clientSecret: 'FORTY_TWO_CLIENT_SECRET',
  redirectUri: 'FORTY_TWO_REDIRECT_URI',
  databaseUrl: 'DATABASE_URL',
  databaseRole: 'DATABASE_ROLE',
  sessionSecret: 'SESSION_SECRET',
  cronSecret: 'CRON_SECRET',
  appOrigin: 'APP_ORIGIN',
}

type ValidationIssue = {
  path?: unknown
  message?: unknown
}

type StartupFailure = {
  status: number
  body: {
    error: string
    message: string
    variables?: string[]
    diagnostic?: {
      name: string
      code?: string
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validationIssues(error: unknown): ValidationIssue[] | null {
  if (!isRecord(error) || error.name !== 'ZodError' || !Array.isArray(error.issues)) {
    return null
  }
  return error.issues.filter(isRecord)
}

export function toStartupFailure(error: unknown): StartupFailure {
  const issues = validationIssues(error)
  if (issues) {
    const variables = [
      ...new Set(
        issues
          .map((issue) => {
            const path = Array.isArray(issue.path) ? issue.path : []
            return environmentVariableByField[String(path[0])]
          })
          .filter((value): value is string => Boolean(value))
      ),
    ]
    return {
      status: 503,
      body: {
        error: 'SERVER_NOT_CONFIGURED',
        message: 'Required Vercel environment variables are missing or invalid.',
        variables,
      },
    }
  }

  const name = error instanceof Error ? error.name : 'UnknownError'
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined
  return {
    status: 503,
    body: {
      error: 'API_STARTUP_FAILED',
      message: 'The API failed to start. Check the Vercel Function logs.',
      diagnostic: { name, ...(code ? { code } : {}) },
    },
  }
}

function createAppPromise() {
  return import('../server/app.ts').then(({ createApp }) => createApp())
}

let appPromise: ReturnType<typeof createAppPromise> | undefined

function getApp() {
  appPromise ??= createAppPromise()
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp()
    return app(req, res)
  } catch (error) {
    const failure = toStartupFailure(error)
    console.error('Pool Predict API startup failed', error)
    res.statusCode = failure.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    return res.end(JSON.stringify(failure.body))
  }
}

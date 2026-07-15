import express from 'express'
import { ZodError } from 'zod'
import { createApp } from '../server/app.ts'

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

function createConfigurationErrorApp(error: ZodError) {
  const app = express()
  const variables = [
    ...new Set(
      error.issues
        .map((issue) => environmentVariableByField[String(issue.path[0])])
        .filter((value): value is string => Boolean(value))
    ),
  ]
  console.error('Pool Predict environment configuration failed', {
    variables,
    issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
  })
  app.use((_req, res) => {
    res.status(503).json({
      error: 'SERVER_NOT_CONFIGURED',
      message: 'Required Vercel environment variables are missing or invalid.',
      variables,
    })
  })
  return app
}

let app
try {
  app = createApp()
} catch (error) {
  if (!(error instanceof ZodError)) throw error
  app = createConfigurationErrorApp(error)
}

export default app

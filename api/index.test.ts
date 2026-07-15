import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { toStartupFailure } from './index.ts'

describe('Vercel API startup failures', () => {
  it('reports the environment variables represented by validation issues', () => {
    const schema = z.object({
      clientId: z.string(),
      databaseUrl: z.string(),
    })
    const result = schema.safeParse({})

    expect(result.success).toBe(false)
    if (result.success) return

    expect(toStartupFailure(result.error)).toEqual({
      status: 503,
      body: {
        error: 'SERVER_NOT_CONFIGURED',
        message: 'Required Vercel environment variables are missing or invalid.',
        variables: ['FORTY_TWO_CLIENT_ID', 'DATABASE_URL'],
      },
    })
  })

  it('returns a safe diagnostic for non-configuration startup errors', () => {
    const error = Object.assign(new Error('Do not expose this message'), {
      code: 'ERR_MODULE_NOT_FOUND',
    })

    expect(toStartupFailure(error)).toEqual({
      status: 503,
      body: {
        error: 'API_STARTUP_FAILED',
        message: 'The API failed to start. Check the Vercel Function logs.',
        diagnostic: {
          name: 'Error',
          code: 'ERR_MODULE_NOT_FOUND',
        },
      },
    })
  })
})

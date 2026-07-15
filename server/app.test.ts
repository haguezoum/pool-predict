import type { Server } from 'node:http'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import type { Env } from './env.js'
import type { FortyTwoClient } from './services/forty-two.js'
import type { Repository } from './services/repository.js'

const env: Env = {
  nodeEnv: 'test',
  appOrigin: 'http://localhost:5173',
  apiPort: 3001,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:5173/api/auth/42/callback',
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

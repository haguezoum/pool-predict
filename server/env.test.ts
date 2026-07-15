import { describe, expect, it } from 'vitest'
import { resolveRedirectUri } from './env.ts'

describe('42 redirect URI configuration', () => {
  it('uses the app callback when no URI is configured', () => {
    expect(resolveRedirectUri(undefined, 'http://localhost:5173')).toBe(
      'http://localhost:5173/api/auth/42/callback'
    )
  })

  it('does not accept the 42 authorize endpoint as a callback', () => {
    expect(
      resolveRedirectUri(
        'https://api.intra.42.fr/oauth/authorize?client_id=client&redirect_uri=https%3A%2F%2Fexample.test',
        'http://localhost:5173'
      )
    ).toBe('http://localhost:5173/api/auth/42/callback')
  })

  it('preserves an explicit callback URL', () => {
    expect(
      resolveRedirectUri(
        'https://pool-predict.vercel.app/api/auth/42/callback',
        'https://pool-predict.vercel.app'
      )
    ).toBe('https://pool-predict.vercel.app/api/auth/42/callback')
  })
})

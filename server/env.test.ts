import { describe, expect, it } from 'vitest'
import { parseAccessPolicy, resolveAppOrigin, resolveRedirectUri } from './env.js'

describe('42 access policy configuration', () => {
  it('parses allowed kinds, campus IDs, and yes/no pooler access', () => {
    expect(
      parseAccessPolicy({
        allowedKinds: 'admin, student, external',
        allowedCampusIds: '993, 444, 993',
        allowPoolers: 'yes',
      })
    ).toEqual({
      allowedKinds: ['admin', 'student', 'external'],
      allowedCampusIds: [993, 444],
      allowPoolers: true,
    })
  })

  it('accepts an empty additional campus list and no pooler access', () => {
    expect(
      parseAccessPolicy({
        allowedKinds: 'student',
        allowedCampusIds: '',
        allowPoolers: 'no',
      })
    ).toEqual({
      allowedKinds: ['student'],
      allowedCampusIds: [],
      allowPoolers: false,
    })
  })

  it('rejects unknown kinds and malformed campus IDs', () => {
    expect(() =>
      parseAccessPolicy({
        allowedKinds: 'alumni',
        allowedCampusIds: 'not-an-id',
        allowPoolers: 'sometimes',
      })
    ).toThrow()
  })
})

describe('application origin configuration', () => {
  it('uses the Vercel production host when APP_ORIGIN is absent', () => {
    expect(
      resolveAppOrigin(undefined, 'pool-predict.vercel.app', 'preview.vercel.app')
    ).toBe('https://pool-predict.vercel.app')
  })

  it('keeps an explicit origin as the highest priority', () => {
    expect(
      resolveAppOrigin(
        'https://predictions.example.com/path',
        'pool-predict.vercel.app',
        undefined
      )
    ).toBe('https://predictions.example.com')
  })

  it('defers malformed origins to schema validation without crashing imports', () => {
    expect(resolveAppOrigin('not a URL', undefined, undefined)).toBe('not a URL')
  })
})

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

  it('defers malformed callbacks to schema validation without crashing imports', () => {
    expect(resolveRedirectUri('not a URL', 'https://pool-predict.vercel.app')).toBe(
      'not a URL'
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  isEligibleCoreStudent,
  selectActiveCohort,
  type FortyTwoUser,
} from './forty-two.ts'

function user(overrides: Partial<FortyTwoUser> = {}): FortyTwoUser {
  return {
    id: 42,
    login: 'student',
    'active?': true,
    'alumni?': false,
    'staff?': false,
    campus_users: [{ campus_id: 77, is_primary: true }],
    cursus_users: [{ end_at: null, cursus: { id: 2, slug: '42' } }],
    ...overrides,
  }
}

describe('42 eligibility', () => {
  it('allows an active Tetouan core student', () => {
    expect(isEligibleCoreStudent(user(), 77, new Set()).eligible).toBe(true)
  })

  it('rejects another primary campus', () => {
    expect(isEligibleCoreStudent(user(), 12, new Set()).reason).toBe('INELIGIBLE_CAMPUS')
  })

  it('rejects current poolers', () => {
    expect(isEligibleCoreStudent(user(), 77, new Set([42])).reason).toBe(
      'POOLER_ACCESS_DENIED'
    )
  })

  it.each([
    { 'staff?': true },
    { 'alumni?': true },
    { 'active?': false },
    { cursus_users: [] },
  ] as Partial<FortyTwoUser>[])('rejects non-core student eligibility', (override) => {
    expect(isEligibleCoreStudent(user(override), 77, new Set()).eligible).toBe(false)
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

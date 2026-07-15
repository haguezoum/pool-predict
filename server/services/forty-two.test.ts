import { describe, expect, it } from 'vitest'
import {
  isEligibleUser,
  selectActiveCohort,
  type FortyTwoUser,
} from './forty-two.js'
import type { UserKind } from '../env.js'

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

function policy(overrides: {
  allowedCampusIds?: number[]
  allowedKinds?: UserKind[]
  allowPoolers?: boolean
} = {}) {
  return {
    allowedCampusIds: new Set<number>(overrides.allowedCampusIds ?? [77]),
    allowedKinds: new Set<UserKind>(overrides.allowedKinds ?? ['student']),
    allowPoolers: overrides.allowPoolers ?? false,
  }
}

describe('42 eligibility', () => {
  it('allows an active Tetouan core student', () => {
    expect(isEligibleUser(user(), policy(), new Set()).eligible).toBe(true)
  })

  it('rejects another primary campus', () => {
    expect(
      isEligibleUser(user(), policy({ allowedCampusIds: [12] }), new Set()).reason
    ).toBe('INELIGIBLE_CAMPUS')
  })

  it('allows an explicitly configured additional campus', () => {
    expect(
      isEligibleUser(user(), policy({ allowedCampusIds: [77, 993, 444] }), new Set())
        .eligible
    ).toBe(true)
  })

  it('rejects current poolers', () => {
    expect(isEligibleUser(user(), policy(), new Set([42])).reason).toBe(
      'POOLER_ACCESS_DENIED'
    )
  })

  it('allows current poolers when configured', () => {
    expect(
      isEligibleUser(user(), policy({ allowPoolers: true }), new Set([42])).eligible
    ).toBe(true)
  })

  it('allows staff only when staff is configured', () => {
    const staff = user({ 'staff?': true, kind: 'staff' })
    expect(isEligibleUser(staff, policy(), new Set()).reason).toBe('STAFF_ACCESS_DENIED')
    expect(
      isEligibleUser(staff, policy({ allowedKinds: ['staff'] }), new Set()).eligible
    ).toBe(true)
  })

  it('allows alumni only when alumni is configured', () => {
    const alumni = user({ 'alumni?': true, 'active?': false, cursus_users: [] })
    expect(isEligibleUser(alumni, policy(), new Set()).eligible).toBe(false)
    expect(
      isEligibleUser(alumni, policy({ allowedKinds: ['alumni'] }), new Set()).eligible
    ).toBe(true)
  })

  it.each([
    { 'active?': false },
    { cursus_users: [] },
  ] as Partial<FortyTwoUser>[])('rejects inactive core student eligibility', (override) => {
    expect(isEligibleUser(user(override), policy(), new Set()).eligible).toBe(false)
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

import { describe, expect, it } from 'vitest'
import { noBetPenalty, scoreBet } from './scoring.js'

describe('scoreBet', () => {
  it('awards +3 total for an exact validated score', () => {
    expect(scoreBet('validate', 85, { validated: true, score: 85 })).toEqual({
      type: 'exact',
      points: 3,
    })
  })

  it('awards +1 for a correct validation with a different score', () => {
    expect(scoreBet('validate', 80, { validated: true, score: 85 }).points).toBe(1)
  })

  it('awards +1 for correctly predicting not validated', () => {
    expect(scoreBet('not_validate', null, { validated: false, score: 35 }).points).toBe(1)
  })

  it.each([
    ['validate', 40, false, 0],
    ['not_validate', null, true, 60],
  ] as const)('awards -1 for the opposite outcome', (prediction, guess, validated, score) => {
    expect(scoreBet(prediction, guess, { validated, score }).points).toBe(-1)
  })
})

describe('noBetPenalty', () => {
  it('applies one -2 penalty when the exam has zero predictions', () => {
    expect(noBetPenalty(0)).toBe(-2)
  })

  it('does not penalize partial participation', () => {
    expect(noBetPenalty(1)).toBe(0)
    expect(noBetPenalty(42)).toBe(0)
  })
})

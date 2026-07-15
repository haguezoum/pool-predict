import type { Prediction } from '../../shared/contracts.ts'

export type SettledResult = {
  validated: boolean
  score: number | null
}

export type ScoreOutcome = {
  type: 'exact' | 'correct' | 'wrong'
  points: 3 | 1 | -1
}

export function scoreBet(
  prediction: Prediction,
  predictedScore: number | null,
  result: SettledResult
): ScoreOutcome {
  const predictedValidation = prediction === 'validate'

  if (predictedValidation !== result.validated) {
    return { type: 'wrong', points: -1 }
  }

  if (
    result.validated &&
    predictedScore !== null &&
    result.score !== null &&
    predictedScore === result.score
  ) {
    return { type: 'exact', points: 3 }
  }

  return { type: 'correct', points: 1 }
}

export function noBetPenalty(betCount: number): -2 | 0 {
  return betCount === 0 ? -2 : 0
}

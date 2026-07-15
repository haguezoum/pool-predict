import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../db/client.js'
import { Repository } from './repository.js'

describe('Repository', () => {
  it('maps raw SQL bet columns before returning a saved bet', async () => {
    const createdAt = new Date('2026-07-15T22:00:00.000Z')
    const updatedAt = new Date('2026-07-15T22:01:00.000Z')
    const execute = vi.fn().mockResolvedValue([
      {
        id: 'bet-id',
        pool_id: 'pool-id',
        exam_id: 'exam-id',
        user_id: 'user-id',
        pooler_intra_id: '269734',
        prediction: 'validate',
        predicted_score: 20,
        created_at: createdAt,
        updated_at: updatedAt,
      },
    ])
    const repository = new Repository({ execute } as unknown as Database)

    const saved = await repository.upsertBet('user-id', 'exam-id', 269734, {
      prediction: 'validate',
      predictedScore: 20,
    })

    expect(saved).toEqual({
      id: 'bet-id',
      poolId: 'pool-id',
      examId: 'exam-id',
      userId: 'user-id',
      poolerIntraId: 269734,
      prediction: 'validate',
      predictedScore: 20,
      createdAt,
      updatedAt,
    })
  })
})

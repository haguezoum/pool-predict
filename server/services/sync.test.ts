import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FortyTwoClient } from './forty-two.js'
import type { Repository } from './repository.js'
import { settlePool, type SyncedPool } from './sync.js'

function settlementFixture(endsAt: Date) {
  const now = new Date('2026-07-18T10:00:00.000Z')
  const exam = {
    id: 'exam-id',
    poolId: 'pool-id',
    campusId: 55,
    code: '00' as const,
    externalExamId: 100,
    externalProjectId: 200,
    lockAt: new Date('2026-07-18T08:00:00.000Z'),
    endsAt,
    createdAt: now,
    updatedAt: now,
  }
  const baseBet = {
    poolId: 'pool-id',
    examId: exam.id,
    userId: 'user-id',
    campusId: 55,
    poolerIntraId: 42,
    predictedScore: null,
    createdAt: now,
    updatedAt: now,
  }
  const bets = [
    {
      ...baseBet,
      id: 'not-validate-bet',
      prediction: 'not_validate' as const,
    },
    {
      ...baseBet,
      id: 'validate-bet',
      prediction: 'validate' as const,
    },
  ]
  const repository = {
    tryAcquireSyncLease: vi.fn().mockResolvedValue(new Date('2026-07-18T10:01:00.000Z')),
    applyNoBetPenalties: vi.fn().mockResolvedValue(undefined),
    listPoolBets: vi.fn().mockResolvedValue(bets),
    upsertBetScore: vi.fn().mockResolvedValue(undefined),
    rebuildLeaderboard: vi.fn().mockResolvedValue(undefined),
    finishSyncLease: vi.fn().mockResolvedValue(undefined),
  } as unknown as Repository
  const fortyTwo = {
    getExamResults: vi.fn().mockResolvedValue(new Map()),
  } as unknown as FortyTwoClient
  const synced = {
    pool: { id: 'pool-id' },
    exams: [exam],
    snapshot: {
      campusId: 55,
      exams: [{
        code: '00',
        externalProjectId: 200,
      }],
    },
  } as unknown as SyncedPool

  return { bets, fortyTwo, repository, synced }
}

describe('settlePool', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats a missing result as not validated after the exam has ended', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T10:00:00.000Z'))
    const { bets, fortyTwo, repository, synced } = settlementFixture(
      new Date('2026-07-18T09:00:00.000Z')
    )

    await settlePool(repository, fortyTwo, synced)

    expect(repository.upsertBetScore).toHaveBeenNthCalledWith(1, bets[0], {
      type: 'correct',
      points: 2,
    })
    expect(repository.upsertBetScore).toHaveBeenNthCalledWith(2, bets[1], {
      type: 'wrong',
      points: -1,
    })
  })

  it('keeps a missing result pending while the exam can still finish', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T10:00:00.000Z'))
    const { bets, fortyTwo, repository, synced } = settlementFixture(
      new Date('2026-07-18T11:00:00.000Z')
    )

    await settlePool(repository, fortyTwo, synced)

    expect(repository.upsertBetScore).toHaveBeenNthCalledWith(1, bets[0], null)
    expect(repository.upsertBetScore).toHaveBeenNthCalledWith(2, bets[1], null)
  })
})

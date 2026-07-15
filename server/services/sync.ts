import type { ExamCode } from '../../shared/contracts.ts'
import { scoreBet } from '../domain/scoring.ts'
import type { ExamRow, Repository } from './repository.ts'
import type { FortyTwoClient, LivePoolSnapshot } from './forty-two.ts'

export type SyncedPool = Awaited<ReturnType<Repository['upsertPool']>> & {
  snapshot: LivePoolSnapshot
}

export async function syncPool(repository: Repository, fortyTwo: FortyTwoClient): Promise<SyncedPool> {
  const snapshot = await fortyTwo.getCurrentPool()
  const stored = await repository.upsertPool(snapshot)
  return { ...stored, snapshot }
}

export async function settlePool(
  repository: Repository,
  fortyTwo: FortyTwoClient,
  synced: SyncedPool
) {
  const leaseKey = `settle:${synced.pool.id}`
  const leaseUntil = await repository.tryAcquireSyncLease(leaseKey)
  if (!leaseUntil) return

  try {
    await repository.applyNoBetPenalties(synced.pool.id)
    const bets = await repository.listPoolBets(synced.pool.id)
    const examById = new Map(synced.exams.map((exam) => [exam.id, exam]))
    const liveExamByCode = new Map(synced.snapshot.exams.map((exam) => [exam.code, exam]))
    const resultsByExam = new Map<ExamCode, Awaited<ReturnType<FortyTwoClient['getExamResults']>>>()

    const lockedExams = synced.exams.filter((exam) => exam.lockAt <= new Date())
    await Promise.all(
      lockedExams.map(async (exam) => {
        const liveExam = liveExamByCode.get(exam.code)
        if (!liveExam) return
        resultsByExam.set(
          exam.code,
          await fortyTwo.getExamResults(synced.snapshot, liveExam)
        )
      })
    )

    for (const bet of bets) {
      const exam = examById.get(bet.examId)
      if (!exam || exam.lockAt > new Date()) continue
      const result = resultsByExam.get(exam.code)?.get(bet.poolerIntraId) ?? null
      const outcome = result
        ? scoreBet(bet.prediction, bet.predictedScore, result)
        : null
      await repository.upsertBetScore(bet, outcome)
    }

    await repository.rebuildLeaderboard(synced.pool.id)
    await repository.finishSyncLease(leaseKey, leaseUntil)
  } catch (error) {
    await repository.finishSyncLease(leaseKey, leaseUntil, error)
    throw error
  }
}

export function getPoolStatus(startsAt: Date, endsAt: Date, exams: ExamRow[]) {
  const now = new Date()
  if (now < startsAt) return 'upcoming' as const
  if (now <= endsAt) return 'open' as const
  const lastExam = exams.at(-1)
  if (lastExam && now <= (lastExam.endsAt ?? lastExam.lockAt)) return 'settling' as const
  return 'closed' as const
}

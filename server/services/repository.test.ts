import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { Database } from '../db/client.js'
import { Repository } from './repository.js'

describe('Repository', () => {
  function compiledSql(value: unknown) {
    return new PgDialect()
      .sqlToQuery(value as Parameters<PgDialect['sqlToQuery']>[0])
      .sql.replaceAll(/\s+/g, ' ')
      .trim()
  }

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

  it('orders leaderboard users by score then first sign-in', async () => {
    const execute = vi.fn().mockResolvedValue([])
    const repository = new Repository({ execute } as unknown as Database)

    await repository.getLeaderboard('00000000-0000-0000-0000-000000000001')

    const query = execute.mock.calls[0]?.[0]
    const compiled = compiledSql(query)
    expect(compiled).toContain(
      'order by lt.total_score desc, u.created_at asc, u.intra_user_id asc'
    )
  })

  it('calculates shared leaderboard ranks from total score only', async () => {
    const execute = vi.fn().mockResolvedValue([])
    const repository = new Repository({ execute } as unknown as Database)

    await repository.rebuildLeaderboard('00000000-0000-0000-0000-000000000001')

    const query = execute.mock.calls[0]?.[0]
    const compiled = compiledSql(query)
    expect(compiled).toContain('rank() over (order by total_score desc)::integer as rank')
  })

  it('waits until an exam ends before applying no-bet penalties', async () => {
    const execute = vi.fn().mockResolvedValue([])
    const repository = new Repository({ execute } as unknown as Database)

    await repository.applyNoBetPenalties('00000000-0000-0000-0000-000000000001')

    expect(execute).toHaveBeenCalledTimes(2)
    const cleanup = compiledSql(execute.mock.calls[0]?.[0])
    const insert = compiledSql(execute.mock.calls[1]?.[0])
    expect(cleanup).toContain("delete from pool_predict.score_events")
    expect(cleanup).toContain("coalesce(e.ends_at, e.lock_at) > now()")
    expect(cleanup).toContain("exists ( select 1 from pool_predict.bets")
    expect(insert).toContain("coalesce(e.ends_at, e.lock_at) <= now()")
    expect(insert).toContain("m.enrolled_at < e.lock_at")
    expect(insert).toContain("on conflict (source_key) do nothing")
  })

  it('throttles successful settlement leases with the persisted cursor', async () => {
    const execute = vi.fn().mockResolvedValue([])
    const repository = new Repository({ execute } as unknown as Database)

    await repository.tryAcquireSyncLease('settle:pool-id')

    const compiled = compiledSql(execute.mock.calls[0]?.[0])
    expect(compiled).toContain('sync_state.cursor::timestamptz')
    expect(compiled).toContain('make_interval(secs => $3)')
  })
})

import { and, asc, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { BetInput } from '../../shared/contracts.js'
import type { Database } from '../db/client.js'
import {
  appUsers,
  bets,
  examRefs,
  poolMemberships,
  poolRefs,
  scoreEvents,
  sessions,
} from '../db/schema.js'
import type { LivePoolSnapshot } from './forty-two.js'

export type AppUserRow = typeof appUsers.$inferSelect
export type PoolRow = typeof poolRefs.$inferSelect
export type ExamRow = typeof examRefs.$inferSelect
export type BetRow = typeof bets.$inferSelect

type RawBetRow = {
  id: string
  campus_id: number
  pool_id: string
  exam_id: string
  user_id: string
  pooler_intra_id: number | string
  prediction: BetRow['prediction']
  predicted_score: number | null
  created_at: Date | string
  updated_at: Date | string
}

function betRowFromSql(row: RawBetRow): BetRow {
  return {
    id: row.id,
    campusId: row.campus_id,
    poolId: row.pool_id,
    examId: row.exam_id,
    userId: row.user_id,
    poolerIntraId: Number(row.pooler_intra_id),
    prediction: row.prediction,
    predictedScore: row.predicted_score,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  }
}

export class Repository {
  readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async checkConnection() {
    await this.db.execute(sql`select 1 from pool_predict.app_users limit 1`)
  }

  async tryAcquireSyncLease(key: string, leaseSeconds = 90, minIntervalSeconds = 60) {
    const rows = await this.db.execute<{ leased_until: Date }>(sql`
      insert into pool_predict.sync_state (key, leased_until, last_error, updated_at)
      values (
        ${key},
        now() + make_interval(secs => ${leaseSeconds}),
        null,
        now()
      )
      on conflict (key) do update set
        leased_until = excluded.leased_until,
        last_error = null,
        updated_at = now()
      where (
        pool_predict.sync_state.leased_until is null
        or pool_predict.sync_state.leased_until < now()
      )
        and (
          pool_predict.sync_state.cursor is null
          or pool_predict.sync_state.cursor::timestamptz
            < now() - make_interval(secs => ${minIntervalSeconds})
        )
      returning leased_until
    `)
    return rows[0]?.leased_until ?? null
  }

  async finishSyncLease(key: string, leaseUntil: Date, error?: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : null
    await this.db.execute(sql`
      update pool_predict.sync_state
      set
        leased_until = null,
        cursor = case when ${message}::text is null then now()::text else cursor end,
        last_error = ${message},
        updated_at = now()
      where key = ${key}
        and leased_until = ${leaseUntil}
    `)
  }

  async upsertUser(intraUserId: number, campusId: number) {
    const [user] = await this.db
      .insert(appUsers)
      .values({ intraUserId, campusId })
      .onConflictDoUpdate({
        target: [appUsers.intraUserId, appUsers.campusId],
        set: { intraUserId, campusId },
      })
      .returning()
    return user
  }

  async createSession(tokenHash: string, userId: string, campusId: number, expiresAt: Date) {
    await this.db.insert(sessions).values({ tokenHash, userId, campusId, expiresAt })
  }

  async getSession(tokenHash: string) {
    const [row] = await this.db
      .select({ session: sessions, user: appUsers })
      .from(sessions)
      .innerJoin(appUsers, eq(appUsers.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1)
    if (row) {
      await this.db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.tokenHash, tokenHash))
    }
    return row ?? null
  }

  async revokeSession(tokenHash: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash))
  }

  async upsertPool(snapshot: LivePoolSnapshot) {
    const [pool] = await this.db
      .insert(poolRefs)
      .values({
        externalRef: snapshot.externalRef,
        campusId: snapshot.campusId,
        startsAt: snapshot.startsAt,
        endsAt: snapshot.endsAt,
      })
      .onConflictDoUpdate({
        target: [poolRefs.externalRef, poolRefs.campusId],
        set: {
          startsAt: snapshot.startsAt,
          endsAt: snapshot.endsAt,
          updatedAt: new Date(),
        },
      })
      .returning()

    const syncedExams: ExamRow[] = []
    for (const exam of snapshot.exams) {
      const [row] = await this.db
        .insert(examRefs)
        .values({
          poolId: pool.id,
          campusId: snapshot.campusId,
          code: exam.code,
          externalExamId: exam.externalExamId,
          externalProjectId: exam.externalProjectId,
          lockAt: exam.lockAt,
          endsAt: exam.endsAt,
        })
        .onConflictDoUpdate({
          target: [examRefs.poolId, examRefs.code],
          set: {
            externalExamId: exam.externalExamId,
            externalProjectId: exam.externalProjectId,
            lockAt: exam.lockAt,
            endsAt: exam.endsAt,
            updatedAt: new Date(),
          },
        })
        .returning()
      syncedExams.push(row)
    }
    return { pool, exams: syncedExams.sort((a, b) => a.code.localeCompare(b.code)) }
  }

  async getLatestPool(campusId: number) {
    const [pool] = await this.db
      .select()
      .from(poolRefs)
      .where(eq(poolRefs.campusId, campusId))
      .orderBy(desc(poolRefs.startsAt))
      .limit(1)
    if (!pool) return null
    const exams = await this.db
      .select()
      .from(examRefs)
      .where(and(eq(examRefs.poolId, pool.id), eq(examRefs.campusId, campusId)))
      .orderBy(asc(examRefs.code))
    return { pool, exams }
  }

  async getPool(poolId: string, campusId: number) {
    const [pool] = await this.db
      .select()
      .from(poolRefs)
      .where(and(eq(poolRefs.id, poolId), eq(poolRefs.campusId, campusId)))
      .limit(1)
    if (!pool) return null
    const exams = await this.db
      .select()
      .from(examRefs)
      .where(and(eq(examRefs.poolId, pool.id), eq(examRefs.campusId, campusId)))
      .orderBy(asc(examRefs.code))
    return { pool, exams }
  }

  async listUserPools(userId: string, campusId: number) {
    return this.db
      .select({ pool: poolRefs, membership: poolMemberships })
      .from(poolMemberships)
      .innerJoin(
        poolRefs,
        and(
          eq(poolRefs.id, poolMemberships.poolId),
          eq(poolRefs.campusId, poolMemberships.campusId)
        )
      )
      .where(
        and(eq(poolMemberships.userId, userId), eq(poolMemberships.campusId, campusId))
      )
      .orderBy(desc(poolRefs.startsAt))
  }

  async enroll(
    poolId: string,
    userId: string,
    campusId: number,
    exams: ExamRow[],
    now = new Date()
  ) {
    const firstEligible = exams.find((exam) => exam.lockAt > now)?.code ?? null
    await this.db
      .insert(poolMemberships)
      .values({ poolId, userId, campusId, enrolledAt: now, firstEligibleExamCode: firstEligible })
      .onConflictDoNothing()
    return this.getMembership(poolId, userId, campusId)
  }

  async getMembership(poolId: string, userId: string, campusId: number) {
    const [membership] = await this.db
      .select()
      .from(poolMemberships)
      .where(
        and(
          eq(poolMemberships.poolId, poolId),
          eq(poolMemberships.userId, userId),
          eq(poolMemberships.campusId, campusId)
        )
      )
      .limit(1)
    return membership ?? null
  }

  async getPoolMemberByIntraId(poolId: string, intraUserId: number, campusId: number) {
    const [row] = await this.db
      .select({ user: appUsers })
      .from(poolMemberships)
      .innerJoin(
        appUsers,
        and(
          eq(appUsers.id, poolMemberships.userId),
          eq(appUsers.campusId, poolMemberships.campusId)
        )
      )
      .where(
        and(
          eq(poolMemberships.poolId, poolId),
          eq(poolMemberships.campusId, campusId),
          eq(appUsers.intraUserId, intraUserId)
        )
      )
      .limit(1)
    return row?.user ?? null
  }

  async getExam(examId: string, campusId: number) {
    const [exam] = await this.db
      .select()
      .from(examRefs)
      .where(and(eq(examRefs.id, examId), eq(examRefs.campusId, campusId)))
      .limit(1)
    return exam ?? null
  }

  async upsertBet(
    userId: string,
    campusId: number,
    examId: string,
    poolerIntraId: number,
    input: BetInput
  ) {
    const rows = await this.db.execute<RawBetRow>(sql`
      insert into pool_predict.bets (
        pool_id, exam_id, user_id, campus_id, pooler_intra_id, prediction, predicted_score
      )
      select e.pool_id, e.id, ${userId}::uuid, ${campusId}::integer, ${poolerIntraId}::bigint,
             ${input.prediction}::pool_predict.prediction, ${input.predictedScore}::smallint
      from pool_predict.exam_refs e
      join pool_predict.pool_memberships m
        on m.pool_id = e.pool_id
       and m.user_id = ${userId}::uuid
       and m.campus_id = e.campus_id
      where e.id = ${examId}::uuid
        and e.campus_id = ${campusId}::integer
        and now() < e.lock_at
      on conflict (exam_id, user_id, pooler_intra_id)
      do update set
        prediction = excluded.prediction,
        predicted_score = excluded.predicted_score,
        updated_at = now()
      returning *
    `)
    return rows[0] ? betRowFromSql(rows[0]) : null
  }

  async deleteBet(userId: string, campusId: number, examId: string, poolerIntraId: number) {
    const rows = await this.db.execute<{ id: string }>(sql`
      delete from pool_predict.bets b
      using pool_predict.exam_refs e
      where b.exam_id = e.id
        and b.user_id = ${userId}::uuid
        and b.campus_id = ${campusId}::integer
        and e.campus_id = b.campus_id
        and b.exam_id = ${examId}::uuid
        and b.pooler_intra_id = ${poolerIntraId}::bigint
        and now() < e.lock_at
      returning b.id
    `)
    return rows.length > 0
  }

  async listUserBets(userId: string, campusId: number, poolId?: string) {
    return this.db
      .select()
      .from(bets)
      .where(
        poolId
          ? and(
              eq(bets.userId, userId),
              eq(bets.campusId, campusId),
              eq(bets.poolId, poolId)
            )
          : and(eq(bets.userId, userId), eq(bets.campusId, campusId))
      )
      .orderBy(asc(bets.createdAt))
  }

  async listExamBets(examId: string, campusId: number) {
    return this.db
      .select()
      .from(bets)
      .where(and(eq(bets.examId, examId), eq(bets.campusId, campusId)))
      .orderBy(asc(bets.createdAt))
  }

  async listPoolBets(poolId: string, campusId: number) {
    return this.db
      .select()
      .from(bets)
      .where(and(eq(bets.poolId, poolId), eq(bets.campusId, campusId)))
  }

  async applyNoBetPenalties(poolId: string, campusId: number) {
    await this.db.execute(sql`
      delete from pool_predict.score_events se
      using pool_predict.exam_refs e, pool_predict.pool_memberships m, pool_predict.pool_refs p
      where se.pool_id = ${poolId}::uuid
        and se.campus_id = ${campusId}::integer
        and se.type = 'no_bet'::pool_predict.score_event_type
        and se.exam_id = e.id
        and p.id = e.pool_id
        and p.campus_id = se.campus_id
        and e.campus_id = se.campus_id
        and m.pool_id = e.pool_id
        and m.campus_id = se.campus_id
        and m.user_id = se.user_id
        and (
          p.ends_at > now()
          or m.enrolled_at >= e.lock_at
          or exists (
            select 1 from pool_predict.bets b
            where b.exam_id = e.id and b.user_id = m.user_id
          )
        )
    `)
    await this.db.execute(sql`
      insert into pool_predict.score_events (
        pool_id, user_id, exam_id, campus_id, type, points, source_key
      )
      select
        e.pool_id,
        m.user_id,
        e.id,
        e.campus_id,
        'no_bet'::pool_predict.score_event_type,
        -2,
        'no-bet:' || e.id::text || ':' || m.user_id::text
      from pool_predict.exam_refs e
      join pool_predict.pool_memberships m on m.pool_id = e.pool_id
      join pool_predict.pool_refs p on p.id = e.pool_id
      where e.pool_id = ${poolId}::uuid
        and e.campus_id = ${campusId}::integer
        and m.campus_id = e.campus_id
        and p.campus_id = e.campus_id
        and p.ends_at <= now()
        and m.enrolled_at < e.lock_at
        and not exists (
          select 1 from pool_predict.bets b
          where b.exam_id = e.id and b.user_id = m.user_id
        )
      on conflict (source_key) do nothing
    `)
  }

  async upsertBetScore(
    bet: BetRow,
    outcome: { type: 'exact' | 'correct' | 'wrong'; points: 3 | 1 | -1 } | null
  ) {
    const sourceKey = `bet:${bet.id}`
    if (!outcome) {
      await this.db.delete(scoreEvents).where(eq(scoreEvents.sourceKey, sourceKey))
      return
    }
    await this.db
      .insert(scoreEvents)
      .values({
        poolId: bet.poolId,
        campusId: bet.campusId,
        userId: bet.userId,
        examId: bet.examId,
        betId: bet.id,
        type: outcome.type,
        points: outcome.points,
        sourceKey,
      })
      .onConflictDoUpdate({
        target: scoreEvents.sourceKey,
        set: {
          type: outcome.type,
          points: outcome.points,
          updatedAt: new Date(),
        },
      })
  }

  async rebuildLeaderboard(poolId: string, campusId: number) {
    await this.db.execute(sql`
      with pruned as (
        delete from pool_predict.leaderboard_totals lt
        where lt.pool_id = ${poolId}::uuid
          and lt.campus_id = ${campusId}::integer
          and not exists (
            select 1 from pool_predict.score_events se
            where se.pool_id = lt.pool_id
              and se.user_id = lt.user_id
              and se.campus_id = lt.campus_id
          )
      ), totals as (
        select
          m.pool_id,
          m.user_id,
          m.campus_id,
          sum(se.points)::integer as total_score
        from pool_predict.pool_memberships m
        join pool_predict.score_events se
          on se.pool_id = m.pool_id
         and se.user_id = m.user_id
         and se.campus_id = m.campus_id
        where m.pool_id = ${poolId}::uuid
          and m.campus_id = ${campusId}::integer
        group by m.pool_id, m.user_id, m.campus_id
      ), ranked as (
        select
          pool_id,
          user_id,
          campus_id,
          total_score,
          rank() over (order by total_score desc)::integer as rank
        from totals
      )
      insert into pool_predict.leaderboard_totals (
        pool_id, user_id, campus_id, total_score, rank, updated_at
      )
      select pool_id, user_id, campus_id, total_score, rank, now() from ranked
      on conflict (pool_id, user_id)
      do update set
        total_score = excluded.total_score,
        rank = excluded.rank,
        updated_at = now()
    `)
  }

  async getUserStats(poolId: string, userId: string, campusId: number) {
    const rows = await this.db.execute<{
      total_score: number
      rank: number
      predictions: number
      correct: number
      wrong: number
      exact_hits: number
      missed_exams: number
    }>(sql`
      select
        coalesce(lt.total_score, 0)::integer as total_score,
        coalesce(lt.rank, 1)::integer as rank,
        count(se.bet_id)::integer as predictions,
        count(*) filter (where se.type in ('exact', 'correct'))::integer as correct,
        count(*) filter (where se.type = 'wrong')::integer as wrong,
        count(*) filter (where se.type = 'exact')::integer as exact_hits,
        count(*) filter (where se.type = 'no_bet')::integer as missed_exams
      from pool_predict.leaderboard_totals lt
      left join pool_predict.score_events se
        on se.pool_id = lt.pool_id
       and se.user_id = lt.user_id
       and se.campus_id = lt.campus_id
      where lt.pool_id = ${poolId}::uuid
        and lt.user_id = ${userId}::uuid
        and lt.campus_id = ${campusId}::integer
      group by lt.total_score, lt.rank
    `)
    return (
      rows[0] ?? {
        total_score: 0,
        rank: 0,
        predictions: 0,
        correct: 0,
        wrong: 0,
        exact_hits: 0,
        missed_exams: 0,
      }
    )
  }

  async getLeaderboard(poolId: string, campusId: number) {
    return this.db.execute<{
      user_id: string
      intra_user_id: number
      created_at: Date | string
      total_score: number
      rank: number
      predictions: number
      correct: number
      wrong: number
      exact_hits: number
      missed_exams: number
    }>(sql`
      select
        m.user_id,
        u.intra_user_id::integer as intra_user_id,
        u.created_at,
        coalesce(lt.total_score, 0)::integer as total_score,
        coalesce(lt.rank, 0)::integer as rank,
        count(se.bet_id)::integer as predictions,
        count(*) filter (where se.type in ('exact', 'correct'))::integer as correct,
        count(*) filter (where se.type = 'wrong')::integer as wrong,
        count(*) filter (where se.type = 'exact')::integer as exact_hits,
        count(*) filter (where se.type = 'no_bet')::integer as missed_exams
      from pool_predict.pool_memberships m
      join pool_predict.app_users u
        on u.id = m.user_id and u.campus_id = m.campus_id
      left join pool_predict.leaderboard_totals lt
        on lt.pool_id = m.pool_id
       and lt.user_id = m.user_id
       and lt.campus_id = m.campus_id
      left join pool_predict.score_events se
        on se.pool_id = m.pool_id
       and se.user_id = m.user_id
       and se.campus_id = m.campus_id
      where m.pool_id = ${poolId}::uuid
        and m.campus_id = ${campusId}::integer
      group by m.user_id, u.intra_user_id, u.created_at, lt.total_score, lt.rank
      order by (lt.rank is null) asc, lt.rank asc nulls last, u.created_at asc, u.intra_user_id asc
    `)
  }

  async pruneExpiredSessions() {
    await this.db
      .delete(sessions)
      .where(or(lt(sessions.expiresAt, new Date()), lt(sessions.revokedAt, new Date())))
  }
}

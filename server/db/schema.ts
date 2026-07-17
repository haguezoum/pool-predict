import {
  bigint,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const poolPredict = pgSchema('pool_predict')

export const examCodeEnum = poolPredict.enum('exam_code', ['00', '01', '02', '03'])
export const predictionEnum = poolPredict.enum('prediction', [
  'validate',
  'not_validate',
])
export const scoreEventTypeEnum = poolPredict.enum('score_event_type', [
  'exact',
  'correct',
  'wrong',
  'no_bet',
])

export const appUsers = poolPredict.table(
  'app_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intraUserId: bigint('intra_user_id', { mode: 'number' }).notNull(),
    campusId: integer('campus_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('app_users_intra_user_campus_key').on(table.intraUserId, table.campusId),
    uniqueIndex('app_users_id_campus_key').on(table.id, table.campusId),
  ]
)

export const sessions = poolPredict.table(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_user_campus_idx').on(table.userId, table.campusId),
    foreignKey({
      name: 'sessions_user_campus_fkey',
      columns: [table.userId, table.campusId],
      foreignColumns: [appUsers.id, appUsers.campusId],
    }).onDelete('cascade'),
  ]
)

export const poolRefs = poolPredict.table(
  'pool_refs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalRef: text('external_ref').notNull(),
    campusId: integer('campus_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pool_refs_external_ref_campus_key').on(table.externalRef, table.campusId),
    uniqueIndex('pool_refs_id_campus_key').on(table.id, table.campusId),
    index('pool_refs_campus_starts_idx').on(table.campusId, table.startsAt),
  ]
)

export const examRefs = poolPredict.table(
  'exam_refs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => poolRefs.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    code: examCodeEnum('code').notNull(),
    externalExamId: bigint('external_exam_id', { mode: 'number' }),
    externalProjectId: bigint('external_project_id', { mode: 'number' }),
    lockAt: timestamp('lock_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('exam_refs_pool_code_key').on(table.poolId, table.code),
    uniqueIndex('exam_refs_id_pool_campus_key').on(table.id, table.poolId, table.campusId),
    index('exam_refs_pool_campus_idx').on(table.poolId, table.campusId),
    foreignKey({
      name: 'exam_refs_pool_campus_fkey',
      columns: [table.poolId, table.campusId],
      foreignColumns: [poolRefs.id, poolRefs.campusId],
    }).onDelete('cascade'),
  ]
)

export const poolMemberships = poolPredict.table(
  'pool_memberships',
  {
    poolId: uuid('pool_id')
      .notNull()
      .references(() => poolRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    firstEligibleExamCode: examCodeEnum('first_eligible_exam_code'),
  },
  (table) => [
    primaryKey({ columns: [table.poolId, table.userId] }),
    uniqueIndex('pool_memberships_pool_user_campus_key').on(
      table.poolId,
      table.userId,
      table.campusId
    ),
    index('pool_memberships_pool_campus_idx').on(table.poolId, table.campusId),
    index('pool_memberships_user_campus_idx').on(table.userId, table.campusId),
    foreignKey({
      name: 'pool_memberships_pool_campus_fkey',
      columns: [table.poolId, table.campusId],
      foreignColumns: [poolRefs.id, poolRefs.campusId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'pool_memberships_user_campus_fkey',
      columns: [table.userId, table.campusId],
      foreignColumns: [appUsers.id, appUsers.campusId],
    }).onDelete('cascade'),
  ]
)

export const bets = poolPredict.table(
  'bets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => poolRefs.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => examRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    poolerIntraId: bigint('pooler_intra_id', { mode: 'number' }).notNull(),
    prediction: predictionEnum('prediction').notNull(),
    predictedScore: smallint('predicted_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bets_exam_user_pooler_key').on(
      table.examId,
      table.userId,
      table.poolerIntraId
    ),
    index('bets_pool_user_idx').on(table.poolId, table.userId),
    uniqueIndex('bets_id_campus_key').on(table.id, table.campusId),
    index('bets_campus_pool_user_idx').on(table.campusId, table.poolId, table.userId),
    index('bets_pool_user_campus_idx').on(table.poolId, table.userId, table.campusId),
    index('bets_exam_pool_campus_idx').on(table.examId, table.poolId, table.campusId),
    index('bets_user_campus_idx').on(table.userId, table.campusId),
    foreignKey({
      name: 'bets_membership_campus_fkey',
      columns: [table.poolId, table.userId, table.campusId],
      foreignColumns: [poolMemberships.poolId, poolMemberships.userId, poolMemberships.campusId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'bets_exam_pool_campus_fkey',
      columns: [table.examId, table.poolId, table.campusId],
      foreignColumns: [examRefs.id, examRefs.poolId, examRefs.campusId],
    }).onDelete('cascade'),
  ]
)

export const scoreEvents = poolPredict.table(
  'score_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => poolRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    examId: uuid('exam_id').references(() => examRefs.id, { onDelete: 'cascade' }),
    betId: uuid('bet_id').references(() => bets.id, { onDelete: 'cascade' }),
    type: scoreEventTypeEnum('type').notNull(),
    points: smallint('points').notNull(),
    sourceKey: text('source_key').notNull(),
    ruleVersion: smallint('rule_version').notNull().default(2),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('score_events_source_key_key').on(table.sourceKey),
    index('score_events_pool_user_idx').on(table.poolId, table.userId),
    index('score_events_campus_pool_user_idx').on(table.campusId, table.poolId, table.userId),
    index('score_events_pool_user_campus_idx').on(table.poolId, table.userId, table.campusId),
    index('score_events_exam_pool_campus_idx').on(table.examId, table.poolId, table.campusId),
    index('score_events_bet_campus_idx').on(table.betId, table.campusId),
    index('score_events_user_campus_idx').on(table.userId, table.campusId),
    foreignKey({
      name: 'score_events_membership_campus_fkey',
      columns: [table.poolId, table.userId, table.campusId],
      foreignColumns: [poolMemberships.poolId, poolMemberships.userId, poolMemberships.campusId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'score_events_exam_pool_campus_fkey',
      columns: [table.examId, table.poolId, table.campusId],
      foreignColumns: [examRefs.id, examRefs.poolId, examRefs.campusId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'score_events_bet_campus_fkey',
      columns: [table.betId, table.campusId],
      foreignColumns: [bets.id, bets.campusId],
    }).onDelete('cascade'),
  ]
)

export const leaderboardTotals = poolPredict.table(
  'leaderboard_totals',
  {
    poolId: uuid('pool_id')
      .notNull()
      .references(() => poolRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').notNull(),
    totalScore: integer('total_score').notNull().default(0),
    rank: integer('rank').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.poolId, table.userId] }),
    index('leaderboard_totals_pool_user_campus_idx').on(
      table.poolId,
      table.userId,
      table.campusId
    ),
    index('leaderboard_totals_user_campus_idx').on(table.userId, table.campusId),
    foreignKey({
      name: 'leaderboard_totals_membership_campus_fkey',
      columns: [table.poolId, table.userId, table.campusId],
      foreignColumns: [poolMemberships.poolId, poolMemberships.userId, poolMemberships.campusId],
    }).onDelete('cascade'),
  ]
)

export const syncState = poolPredict.table('sync_state', {
  key: text('key').primaryKey(),
  leasedUntil: timestamp('leased_until', { withTimezone: true }),
  cursor: text('cursor'),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

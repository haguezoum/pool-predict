import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getEnv } from '../env.ts'
import * as schema from './schema.ts'

let sqlClient: ReturnType<typeof postgres> | undefined
let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getSql() {
  const env = getEnv()
  sqlClient ??= postgres(env.databaseUrl, {
    max: env.nodeEnv === 'production' ? 3 : 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    connection: {
      application_name: 'pool-predict-api',
      options: `-c role=${env.databaseRole}`,
    },
  })
  return sqlClient
}

export function getDb() {
  database ??= drizzle(getSql(), { schema })
  return database
}

export type Database = ReturnType<typeof getDb>

export async function closeDatabase() {
  await sqlClient?.end({ timeout: 5 })
  sqlClient = undefined
  database = undefined
}

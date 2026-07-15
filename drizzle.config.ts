import { defineConfig } from 'drizzle-kit'

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL

if (!databaseUrl) {
  throw new Error('DIRECT_DATABASE_URL or DATABASE_URL is required')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
})

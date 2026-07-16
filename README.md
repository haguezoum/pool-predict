# 1337 Tetouan Pool Predict

Private Exam 00–03 prediction platform for the 1337 MED Tetouan Piscine. The 42 API user kinds `admin`, `student`, and `external` may sign in by default, while current poolers remain rejected unless explicitly enabled; these access categories can be configured through server-only environment variables. The React application and the Express API deploy together on Vercel; Supabase is PostgreSQL storage only.

## Rules

- Validated with the exact score: **+3 total**
- Correct validation outcome with another score: **+1**
- Correct not-validated prediction: **+1**
- Wrong validation outcome: **-1**
- No predictions at all before an eligible exam locks: one **-2**, settled after the pool closes
- Unpredicted individual poolers: **0**
- Equal totals receive the same SQL `rank()`

The first successful login enrolls a student in the current pool. Every enrolled student appears on that pool's leaderboard. Ranked players come first, rank ties are sorted by 42 login, and unranked players follow in account-creation order. Missed-exam penalties apply only after the pool closes and only to exams that lock after enrollment, never retroactively. Players without a settled score remain unranked. Predictions remain private until the exam lock.

## Architecture

- `src/`: React 19, Vite, TanStack Query, React Router, and the existing Tailwind/shadcn UI
- `server/`: TypeScript Express API, 42 OAuth/live data client, settlement service, and Drizzle repository
- `api/index.ts`: the single Vercel Function entry
- `shared/`: browser/server API contracts
- `supabase/migrations/`: private `pool_predict` PostgreSQL schema and restricted API role

The browser only calls `/api`. It never receives a database credential, 42 client secret, user OAuth access token, or Supabase secret. The API exchanges the 42 authorization code, verifies `/v2/me`, creates a hashed local session, and discards the OAuth token.

Only internal IDs, campus IDs, 42 numeric references, pool/exam timestamps, bets, score events, totals/ranks, and sync metadata are stored. Names, logins, avatars, campus/cursus objects, pooler profiles, 42 payloads, and final marks stay live in 42 and are not copied to Supabase.

## Local setup

1. Copy `.env.example` to `.env` and configure the listed values.
2. Use a Supavisor transaction-mode URL on port 6543 for `DATABASE_URL`.
3. Use the direct/session URL only for `DIRECT_DATABASE_URL` and migrations.
4. In the 42 application settings, register the exact `FORTY_TWO_REDIRECT_URI`. This must be the callback (for example `http://localhost:5173/api/auth/42/callback`), not 42's `/oauth/authorize` URL.
5. Apply migrations with `npm run db:migrate` or the Supabase CLI.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5173` and proxies `/api` to Express at `http://127.0.0.1:3001`. Use the `localhost` browser URL so the OAuth state cookie and callback stay on the same host.

## Environment

Required on Vercel:

```text
APP_ORIGIN
FORTY_TWO_CLIENT_ID
FORTY_TWO_CLIENT_SECRET
FORTY_TWO_REDIRECT_URI
FORTY_TWO_ALLOWED_KINDS=admin,student,external
FORTY_TWO_ALLOWED_CAMPUS_IDS=
FORTY_TWO_ALLOW_POOLERS=no
DATABASE_URL
DIRECT_DATABASE_URL
DATABASE_ROLE=pool_predict_api
SESSION_SECRET
CRON_SECRET
```

`FORTY_TWO_TETOUAN_CAMPUS_ID` defaults to the verified 1337 MED/Tetouan campus ID `55`. It can be overridden if 42 changes that reference.

Access policy values are server-only and comma-separated where applicable:

- `FORTY_TWO_ALLOWED_KINDS` accepts the 42 API `kind` values `admin`, `student`, and `external`. All three are enabled by default. Alumni and staff flags do not redefine the API kind.
- `FORTY_TWO_ALLOW_POOLERS` accepts `yes`/`no`, `true`/`false`, or `1`/`0`. The default is `no`.
- `FORTY_TWO_ALLOWED_CAMPUS_IDS` accepts additional numeric primary-campus IDs. Known 1337 campuses include Khouribga `16`, Benguerir `21`, Tetouan/MED `55`, and Rabat `75`. The default campus configured by `FORTY_TWO_TETOUAN_CAMPUS_ID` is always included.

Each authenticated student is bound to their primary 42 campus. Pool discovery, the five-minute 42 cache, poolers, bets, prediction history, score events, and leaderboard queries are partitioned by that `campus_id`. A student can only bet on poolers returned by the same-campus Piscine roster. Composite PostgreSQL foreign keys enforce the same boundary for stored writes, so adding an allowed campus cannot mix it into another campus leaderboard.

`APP_ORIGIN` is optional on Vercel because the API derives it from `VERCEL_PROJECT_PRODUCTION_URL`. All secrets must still be configured in the Vercel project; local `.env` files are never uploaded by Git deployments.

The PostgreSQL client disables prepared statements and makes every runtime connection assume the restricted `pool_predict_api` role. `DIRECT_DATABASE_URL` is read by migration tooling only.

## Commands

```bash
npm run dev       # Vite + Express
npm test          # scoring, eligibility, and API boundary tests
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```

## Deployment

`vercel.json` builds the Vite application, routes `/api/*` to the one Express function, preserves SPA deep links, and invokes `/api/internal/sync` daily. Vercel sends `Authorization: Bearer $CRON_SECRET` to the cron route.

Cron is only a safety refresh. Bet locking and zero-bet eligibility use PostgreSQL `now()` and stored exam lock timestamps, so correctness does not depend on cron timing. When 42 is unavailable, reads fall back only where safe and all new bets are blocked.

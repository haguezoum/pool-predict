create schema if not exists pool_predict;

revoke all on schema pool_predict from public, anon, authenticated;

do $$ begin
  create type pool_predict.exam_code as enum ('00', '01', '02', '03');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type pool_predict.prediction as enum ('validate', 'not_validate');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type pool_predict.score_event_type as enum ('exact', 'correct', 'wrong', 'no_bet');
exception when duplicate_object then null;
end $$;

create table if not exists pool_predict.app_users (
  id uuid primary key default gen_random_uuid(),
  intra_user_id bigint not null unique,
  created_at timestamptz not null default now()
);

create table if not exists pool_predict.sessions (
  token_hash text primary key,
  user_id uuid not null references pool_predict.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on pool_predict.sessions(user_id);

create table if not exists pool_predict.pool_refs (
  id uuid primary key default gen_random_uuid(),
  external_ref text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pool_refs_valid_range check (ends_at > starts_at)
);

create table if not exists pool_predict.exam_refs (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pool_predict.pool_refs(id) on delete cascade,
  code pool_predict.exam_code not null,
  external_exam_id bigint,
  external_project_id bigint,
  lock_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, code),
  constraint exam_refs_valid_range check (ends_at is null or ends_at > lock_at)
);

create table if not exists pool_predict.pool_memberships (
  pool_id uuid not null references pool_predict.pool_refs(id) on delete cascade,
  user_id uuid not null references pool_predict.app_users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  first_eligible_exam_code pool_predict.exam_code,
  primary key (pool_id, user_id)
);

create table if not exists pool_predict.bets (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pool_predict.pool_refs(id) on delete cascade,
  exam_id uuid not null references pool_predict.exam_refs(id) on delete cascade,
  user_id uuid not null references pool_predict.app_users(id) on delete cascade,
  pooler_intra_id bigint not null,
  prediction pool_predict.prediction not null,
  predicted_score smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, user_id, pooler_intra_id),
  constraint bets_score_range check (predicted_score between 0 and 100 or predicted_score is null),
  constraint bets_prediction_score check (
    (prediction = 'validate' and predicted_score is not null) or
    (prediction = 'not_validate' and predicted_score is null)
  )
);
create index if not exists bets_pool_user_idx on pool_predict.bets(pool_id, user_id);

create table if not exists pool_predict.score_events (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pool_predict.pool_refs(id) on delete cascade,
  user_id uuid not null references pool_predict.app_users(id) on delete cascade,
  exam_id uuid references pool_predict.exam_refs(id) on delete cascade,
  bet_id uuid references pool_predict.bets(id) on delete cascade,
  type pool_predict.score_event_type not null,
  points smallint not null,
  source_key text not null unique,
  rule_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint score_events_points check (
    (type = 'exact' and points = 3) or
    (type = 'correct' and points = 1) or
    (type = 'wrong' and points = -1) or
    (type = 'no_bet' and points = -2)
  )
);
create index if not exists score_events_pool_user_idx on pool_predict.score_events(pool_id, user_id);

create table if not exists pool_predict.leaderboard_totals (
  pool_id uuid not null references pool_predict.pool_refs(id) on delete cascade,
  user_id uuid not null references pool_predict.app_users(id) on delete cascade,
  total_score integer not null default 0,
  rank integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create table if not exists pool_predict.sync_state (
  key text primary key,
  leased_until timestamptz,
  cursor text,
  last_error text,
  updated_at timestamptz not null default now()
);

revoke all on all tables in schema pool_predict from public, anon, authenticated;
revoke all on all sequences in schema pool_predict from public, anon, authenticated;

alter default privileges in schema pool_predict
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema pool_predict
  revoke all on sequences from public, anon, authenticated;

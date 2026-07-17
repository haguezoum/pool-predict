update pool_predict.score_events
set
  points = case
    when type = 'correct' then 2
    else points
  end,
  rule_version = 2,
  updated_at = now()
where rule_version <> 2
   or (type = 'correct' and points <> 2);

alter table pool_predict.score_events
  alter column rule_version set default 2;

alter table pool_predict.score_events
  drop constraint score_events_points;

alter table pool_predict.score_events
  add constraint score_events_points check (
    (type = 'exact' and points = 3)
    or (type = 'correct' and points = 2)
    or (type = 'wrong' and points = -1)
    or (type = 'no_bet' and points = -2)
  );

delete from pool_predict.leaderboard_totals;

with totals as (
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
  group by m.pool_id, m.user_id, m.campus_id
), ranked as (
  select
    pool_id,
    user_id,
    campus_id,
    total_score,
    rank() over (
      partition by pool_id, campus_id
      order by total_score desc
    )::integer as rank
  from totals
)
insert into pool_predict.leaderboard_totals (
  pool_id,
  user_id,
  campus_id,
  total_score,
  rank,
  updated_at
)
select
  pool_id,
  user_id,
  campus_id,
  total_score,
  rank,
  now()
from ranked;

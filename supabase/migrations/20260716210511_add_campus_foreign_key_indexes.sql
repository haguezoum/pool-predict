create index sessions_user_campus_idx
  on pool_predict.sessions (user_id, campus_id);
create index exam_refs_pool_campus_idx
  on pool_predict.exam_refs (pool_id, campus_id);
create index pool_memberships_pool_campus_idx
  on pool_predict.pool_memberships (pool_id, campus_id);
create index pool_memberships_user_campus_idx
  on pool_predict.pool_memberships (user_id, campus_id);
create index bets_pool_user_campus_idx
  on pool_predict.bets (pool_id, user_id, campus_id);
create index bets_exam_pool_campus_idx
  on pool_predict.bets (exam_id, pool_id, campus_id);
create index bets_user_campus_idx
  on pool_predict.bets (user_id, campus_id);
create index score_events_pool_user_campus_idx
  on pool_predict.score_events (pool_id, user_id, campus_id);
create index score_events_exam_pool_campus_idx
  on pool_predict.score_events (exam_id, pool_id, campus_id);
create index score_events_bet_campus_idx
  on pool_predict.score_events (bet_id, campus_id);
create index score_events_user_campus_idx
  on pool_predict.score_events (user_id, campus_id);
create index leaderboard_totals_pool_user_campus_idx
  on pool_predict.leaderboard_totals (pool_id, user_id, campus_id);
create index leaderboard_totals_user_campus_idx
  on pool_predict.leaderboard_totals (user_id, campus_id);

alter table pool_predict.app_users add column campus_id integer;
alter table pool_predict.sessions add column campus_id integer;
alter table pool_predict.pool_refs add column campus_id integer;
alter table pool_predict.exam_refs add column campus_id integer;
alter table pool_predict.pool_memberships add column campus_id integer;
alter table pool_predict.bets add column campus_id integer;
alter table pool_predict.score_events add column campus_id integer;
alter table pool_predict.leaderboard_totals add column campus_id integer;

-- All data created before multi-campus support belongs to  MED (campus 55).
update pool_predict.app_users set campus_id = 55 where campus_id is null;
update pool_predict.sessions set campus_id = 55 where campus_id is null;
update pool_predict.pool_refs set campus_id = 55 where campus_id is null;
update pool_predict.exam_refs set campus_id = 55 where campus_id is null;
update pool_predict.pool_memberships set campus_id = 55 where campus_id is null;
update pool_predict.bets set campus_id = 55 where campus_id is null;
update pool_predict.score_events set campus_id = 55 where campus_id is null;
update pool_predict.leaderboard_totals set campus_id = 55 where campus_id is null;

alter table pool_predict.app_users alter column campus_id set not null;
alter table pool_predict.sessions alter column campus_id set not null;
alter table pool_predict.pool_refs alter column campus_id set not null;
alter table pool_predict.exam_refs alter column campus_id set not null;
alter table pool_predict.pool_memberships alter column campus_id set not null;
alter table pool_predict.bets alter column campus_id set not null;
alter table pool_predict.score_events alter column campus_id set not null;
alter table pool_predict.leaderboard_totals alter column campus_id set not null;

alter table pool_predict.app_users drop constraint app_users_intra_user_id_key;
alter table pool_predict.pool_refs drop constraint pool_refs_external_ref_key;

alter table pool_predict.app_users
  add constraint app_users_intra_user_campus_key unique (intra_user_id, campus_id),
  add constraint app_users_id_campus_key unique (id, campus_id);

alter table pool_predict.pool_refs
  add constraint pool_refs_external_ref_campus_key unique (external_ref, campus_id),
  add constraint pool_refs_id_campus_key unique (id, campus_id);

alter table pool_predict.exam_refs
  add constraint exam_refs_id_pool_campus_key unique (id, pool_id, campus_id),
  add constraint exam_refs_pool_campus_fkey
    foreign key (pool_id, campus_id)
    references pool_predict.pool_refs (id, campus_id)
    on delete cascade;

alter table pool_predict.pool_memberships
  add constraint pool_memberships_pool_user_campus_key unique (pool_id, user_id, campus_id),
  add constraint pool_memberships_pool_campus_fkey
    foreign key (pool_id, campus_id)
    references pool_predict.pool_refs (id, campus_id)
    on delete cascade,
  add constraint pool_memberships_user_campus_fkey
    foreign key (user_id, campus_id)
    references pool_predict.app_users (id, campus_id)
    on delete cascade;

alter table pool_predict.sessions
  add constraint sessions_user_campus_fkey
    foreign key (user_id, campus_id)
    references pool_predict.app_users (id, campus_id)
    on delete cascade;

alter table pool_predict.bets
  add constraint bets_id_campus_key unique (id, campus_id),
  add constraint bets_membership_campus_fkey
    foreign key (pool_id, user_id, campus_id)
    references pool_predict.pool_memberships (pool_id, user_id, campus_id)
    on delete cascade,
  add constraint bets_exam_pool_campus_fkey
    foreign key (exam_id, pool_id, campus_id)
    references pool_predict.exam_refs (id, pool_id, campus_id)
    on delete cascade;

alter table pool_predict.score_events
  add constraint score_events_membership_campus_fkey
    foreign key (pool_id, user_id, campus_id)
    references pool_predict.pool_memberships (pool_id, user_id, campus_id)
    on delete cascade,
  add constraint score_events_exam_pool_campus_fkey
    foreign key (exam_id, pool_id, campus_id)
    references pool_predict.exam_refs (id, pool_id, campus_id)
    on delete cascade,
  add constraint score_events_bet_campus_fkey
    foreign key (bet_id, campus_id)
    references pool_predict.bets (id, campus_id)
    on delete cascade;

alter table pool_predict.leaderboard_totals
  add constraint leaderboard_totals_membership_campus_fkey
    foreign key (pool_id, user_id, campus_id)
    references pool_predict.pool_memberships (pool_id, user_id, campus_id)
    on delete cascade;

create index pool_refs_campus_starts_idx
  on pool_predict.pool_refs (campus_id, starts_at desc);
create index bets_campus_pool_user_idx
  on pool_predict.bets (campus_id, pool_id, user_id);
create index score_events_campus_pool_user_idx
  on pool_predict.score_events (campus_id, pool_id, user_id);

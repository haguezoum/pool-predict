do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pool_predict_api') then
    create role pool_predict_api nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

grant usage on schema pool_predict to pool_predict_api;
grant select, insert, update, delete on all tables in schema pool_predict to pool_predict_api;
grant usage, select on all sequences in schema pool_predict to pool_predict_api;

alter default privileges in schema pool_predict
  grant select, insert, update, delete on tables to pool_predict_api;
alter default privileges in schema pool_predict
  grant usage, select on sequences to pool_predict_api;

grant pool_predict_api to postgres;

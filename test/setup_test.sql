-- run after setup.sql on a fresh DB: first sign-in → admin, board creation, isolation
\set ON_ERROR_STOP 1
begin;
create function pg_temp.as_user(e text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('email', e, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', msg; end if; end $$;

-- first sign-in owns the install
select pg_temp.as_user('first@gmail.com');
select pg_temp.expect(is_fresh(), 'fresh install not fresh');
select pg_temp.expect(bootstrap(), 'first user not bootstrapped');
select pg_temp.expect(not is_fresh(), 'still fresh after bootstrap');
select pg_temp.expect((select is_admin from members where email = 'first@gmail.com'), 'first user not admin');
select pg_temp.expect((select count(*) from teams) = 1, 'no starter board');
select pg_temp.expect((select count(*) from columns) = 3, 'starter board columns');
select pg_temp.expect(not bootstrap(), 'bootstrap ran twice');

-- a stranger can't take over
select pg_temp.as_user('stranger@gmail.com');
select pg_temp.expect(not bootstrap(), 'stranger bootstrapped');
select pg_temp.expect((select count(*) from teams) = 0, 'stranger sees boards');
do $$ begin perform create_team('x', '#000000'); raise exception 'FAIL: stranger created a board';
exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end $$;

-- admin makes a second board and invites someone to it only
select pg_temp.as_user('first@gmail.com');
select pg_temp.expect(create_team('بورد دوم', '#2F80ED') > 0, 'create_team');
insert into members (email) values ('b@gmail.com');
insert into team_members select id, 'b@gmail.com' from teams where name = 'بورد دوم';
select pg_temp.as_user('b@gmail.com');
select pg_temp.expect((select count(*) from teams) = 1 and (select name from teams) = 'بورد دوم', 'invitee sees wrong boards');
insert into cards (team_id, column_id, title) select team_id, id, 'hello' from columns order by position limit 1;
select pg_temp.expect((select count(*) from cards) = 1, 'invitee cannot add a card');

-- reminders tick quietly without Telegram configured
reset role;
select private.remind_tick();
rollback;
\echo setup_test: all passed

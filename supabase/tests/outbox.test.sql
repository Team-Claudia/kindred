-- Task 3.3: outbox-worker claims due push jobs safely, retries with backoff,
-- and is called by a trigger on insert and by pg_cron.
begin;
select plan(26);

-- How many pg_net requests were queued before this test.
create temp table queued_before as select count(*) as n from net.http_request_queue;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select has_function('public', 'claim_outbox_jobs', array['integer']);
select ok(has_function_privilege('service_role', 'public.claim_outbox_jobs(integer)', 'execute'),
  'the service role can claim jobs');
select ok(not has_function_privilege('authenticated', 'public.claim_outbox_jobs(integer)', 'execute'),
  'signed-in users cannot claim jobs');
select ok(not has_function_privilege('anon', 'public.claim_outbox_jobs(integer)', 'execute'),
  'signed-out visitors cannot claim jobs');
select ok(has_function_privilege('service_role', 'public.finish_outbox_job(bigint, integer, text)', 'execute'),
  'the service role can finish jobs');
select ok(not has_function_privilege('authenticated', 'public.finish_outbox_job(bigint, integer, text)', 'execute'),
  'signed-in users cannot finish jobs');
select ok(not has_function_privilege('authenticated', 'public.invoke_outbox_worker()', 'execute'),
  'signed-in users cannot call the worker');

-- Concurrent claims skip each other's rows rather than waiting or sharing them.
select ok(
  pg_get_functiondef('public.claim_outbox_jobs(integer)'::regprocedure) ~* 'for update skip locked',
  'claim_outbox_jobs locks rows with for update skip locked'
);

-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------

insert into public.outbox (id, kind, status, run_at, attempts) overriding system value values
  (9001, 'push', 'pending', now() - interval '2 minutes', 0),   -- due
  (9002, 'push', 'sending', now() - interval '1 minute', 2),    -- lease ran out: due again
  (9003, 'push', 'pending', now() + interval '1 hour', 0),      -- not due yet
  (9004, 'weekly_summary', 'pending', now() - interval '1 hour', 0), -- not sent by this worker
  (9005, 'push', 'done', now() - interval '1 hour', 1),
  (9006, 'push', 'failed', now() - interval '1 hour', 5),
  (9007, 'push', 'sending', now() + interval '1 minute', 1),    -- claimed by another call
  (9008, 'push', 'sending', now() - interval '1 minute', 5);    -- lease ran out on the last try

select results_eq(
  $$ select id from public.claim_outbox_jobs(1) $$,
  $$ values (9001::bigint) $$,
  'claims at most max_jobs, oldest first'
);

select results_eq(
  $$ select status, attempts, run_at from public.outbox where id = 9001 $$,
  $$ values ('sending'::text, 1, now() + interval '2 minutes') $$,
  'a claimed job is sending, counts the attempt and is leased for 2 minutes'
);

select results_eq(
  $$ select id from public.claim_outbox_jobs(10) $$,
  $$ values (9002::bigint) $$,
  'only due jobs are claimed, including ones whose lease ran out'
);

select results_eq(
  $$ select status, last_error from public.outbox where id = 9008 $$,
  $$ values ('failed'::text, 'worker_did_not_finish'::text) $$,
  'a job whose lease ran out on its 5th attempt is failed'
);

select is_empty(
  $$ select id from public.claim_outbox_jobs(10) $$,
  'a claimed job is not claimed again while its lease lasts'
);

select results_eq(
  $$ select status, attempts from public.outbox where id = 9004 $$,
  $$ values ('pending'::text, 0) $$,
  'job kinds the worker does not send are left pending'
);

-- ---------------------------------------------------------------------------
-- Finishing and retries
-- ---------------------------------------------------------------------------

select public.finish_outbox_job(9001, 1);
select results_eq(
  $$ select status, last_error from public.outbox where id = 9001 $$,
  $$ values ('done'::text, null::text) $$,
  'success marks the job done'
);

select public.finish_outbox_job(9002, 3, 'boom');
select results_eq(
  $$ select status, attempts, last_error, run_at from public.outbox where id = 9002 $$,
  $$ values ('pending'::text, 3, 'boom'::text, now() + interval '15 minutes') $$,
  'a failed 3rd attempt is retried in 15 minutes'
);

select public.finish_outbox_job(9002, 3);
select results_eq(
  $$ select status from public.outbox where id = 9002 $$,
  $$ values ('pending'::text) $$,
  'finishing a job that is not sending does nothing'
);

insert into public.outbox (id, kind, status, run_at, attempts) overriding system value values
  (9010, 'push', 'sending', now() + interval '2 minutes', 1),
  (9011, 'push', 'sending', now() + interval '2 minutes', 5),
  (9012, 'push', 'sending', now() + interval '2 minutes', 3);

select public.finish_outbox_job(9012, 2, 'late');
select results_eq(
  $$ select status, last_error from public.outbox where id = 9012 $$,
  $$ values ('sending'::text, null::text) $$,
  'a worker whose lease ran out cannot finish the job claimed again since'
);

select public.finish_outbox_job(9010, 1, 'push failed');
select results_eq(
  $$ select status, run_at from public.outbox where id = 9010 $$,
  $$ values ('pending'::text, now() + interval '1 minute') $$,
  'a failed 1st attempt is retried in 1 minute'
);

select public.finish_outbox_job(9011, 5, 'push failed');
select results_eq(
  $$ select status, last_error from public.outbox where id = 9011 $$,
  $$ values ('failed'::text, 'push failed'::text) $$,
  'a failed 5th attempt is failed for good'
);

-- ---------------------------------------------------------------------------
-- Trigger on insert and pg_cron
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from net.http_request_queue),
  (select n from queued_before),
  'without the Vault values, inserting push jobs calls nothing'
);

select vault.create_secret('https://project.example.test/functions/v1/outbox-worker', 'outbox_worker_url');
select vault.create_secret('test-secret', 'outbox_worker_secret');

insert into public.outbox (kind, payload) values ('reminder', '{}');
select is(
  (select count(*) from net.http_request_queue),
  (select n from queued_before),
  'inserting a job of another kind calls nothing'
);

insert into public.outbox (kind, payload) values
  ('push', '{"event": "item_changed"}'),
  ('push', '{"event": "item_changed"}');
select is(
  (select count(*) from net.http_request_queue),
  (select n + 1 from queued_before),
  'inserting push jobs calls the worker once per statement'
);

select results_eq(
  $$ select url::text, method::text, headers ->> 'x-outbox-secret' from net.http_request_queue order by id desc limit 1 $$,
  $$ values ('https://project.example.test/functions/v1/outbox-worker'::text, 'POST'::text, 'test-secret'::text) $$,
  'the call goes to the URL from Vault with the shared secret'
);

select ok(
  exists (select 1 from cron.job where jobname = 'outbox-worker' and schedule = '* * * * *'
          and command = 'select public.outbox_catch_up()'),
  'pg_cron runs the catch-up every minute'
);

select has_column('public', 'notifications', 'outbox_id',
  'notifications remember their job, so a retry writes no second row');

select * from finish();
rollback;

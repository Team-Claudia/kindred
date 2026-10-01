-- Checks that pgTAP runs against the local database. Replace once real tests exist.
begin;
select plan(1);
select ok(true, 'pgTAP runs');
select * from finish();
rollback;

-- Precious Draft - make undo reach the other screens
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- 008 published `picks`, and new picks now reach every screen. Undo does
-- not. When a row is deleted, Postgres puts only the primary key into the
-- change it broadcasts, so a subscription filtered on `phase_id=eq...`
-- has nothing to match on and the delete is dropped before it leaves the
-- server. The commissioner would undo a pick on the television and twelve
-- phones would go on showing that player as taken.
--
-- REPLICA IDENTITY FULL makes a delete carry the whole row it removed, so
-- the filter matches. The cost is a little more write-ahead log per
-- delete, which for a table that sees at most three hundred inserts and
-- the occasional undo is nothing.

begin;

alter table picks replica identity full;

commit;

-- Confirms it took. 'f' is full; 'd' is the default that drops everything
-- but the key. "Success. No rows returned." would look the same either
-- way, so print the state instead.
select
  relname as table_name,
  case relreplident
    when 'f' then 'full - deletes carry the whole row'
    when 'd' then 'default - deletes carry only the key'
    when 'i' then 'index'
    when 'n' then 'nothing'
  end as replica_identity
from pg_class
where relname = 'picks';

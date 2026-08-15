-- Precious Draft - Clams AI, the sealed grade
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- The trick only works if the generated grade exists BEFORE the
-- commissioner announces his own, and is only shown afterwards. Grading
-- after he speaks looks like the machine paraphrasing him; grading
-- visibly first turns him into someone reacting to a robot. So the grade
-- is sealed: written early, hidden, timestamped, revealed on a button.

begin;

-- When Clams AI wrote this grade. The timestamp is the evidence - it
-- predates the commissioner's own row, which is what makes "it never saw
-- my answer" a checkable claim rather than a promise.
alter table team_grades
  add column if not exists sealed_at timestamptz;

-- When the commissioner flipped it face up. Null means still sealed.
alter table team_grades
  add column if not exists revealed_at timestamptz;

-- Which model wrote it, so a grade from this year is still interpretable
-- in a few years when the model behind it is long replaced.
alter table team_grades
  add column if not exists model text;

-- Sealing has to be real ------------------------------------------------
--
-- The previous policy was `using (true)`, which means the anon key shipped
-- to every browser could read the AI grade while it was still supposed to
-- be hidden. A sealed envelope anyone in the league can hold up to the
-- light is not sealed. This narrows reads the same way phase_teams gates
-- undrawn draft order: commissioner grades stay public, AI grades appear
-- only once revealed.
--
-- Server actions use the service-role key, which bypasses RLS, so the
-- commissioner's own page still sees sealed grades to reveal them.
drop policy if exists "public read" on team_grades;

create policy "public read" on team_grades for select
  using (source = 'commissioner' or revealed_at is not null);

commit;

-- Confirms the migration actually did something. "Success. No rows
-- returned." looks identical whether this ran for the first time or did
-- nothing at all, so print the state instead of trusting the message.
select
  count(*) filter (where column_name = 'sealed_at')   as has_sealed_at,
  count(*) filter (where column_name = 'revealed_at') as has_revealed_at,
  count(*) filter (where column_name = 'model')       as has_model
from information_schema.columns
where table_name = 'team_grades';

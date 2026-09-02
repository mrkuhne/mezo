-- mezo-1jm8 — actual workout timing. Two clocks, deliberately separate (spec: Strava
-- pattern): the RAW pair started_at/finished_at is the immutable wall clock, and
-- active_seconds is the DERIVED work time with dead air trimmed. Neither overwrites
-- the other; elapsed is always derivable as finished_at - started_at and is not stored.
--
-- finished_at doubles as the "this session was really closed by the user" discriminator:
-- WorkoutAutoCloseService flips an abandoned session to 'completed' the next calendar day
-- but never stamps finished_at, so `status='completed' AND finished_at IS NULL` identifies
-- an abandoned session without a second column.
alter table workout_session add column started_at   TIMESTAMPTZ;
alter table workout_session add column finished_at  TIMESTAMPTZ;
alter table workout_session add column active_seconds INTEGER;

-- Backfill from history. exercise_set.done_at has always been written, so every past
-- session already carries its interval stream. Each inter-set gap is clipped at 300s
-- (mezo.train.timing.gap-cap-seconds) so a phone call or a queue at the machine cannot
-- inflate the number. No lead-in term: started_at does not exist for historical rows.
-- Idempotent — only fills rows where active_seconds IS NULL.
--
-- The NULL delta on each session's first ordered set (lag() has nothing to look back to) is
-- filtered out in raw_deltas, before it ever reaches least() below: Postgres's least()/greatest()
-- ignore NULL arguments instead of propagating them (unlike a plain comparison), so
-- least(NULL, 300) evaluates to 300, not NULL — filtering first avoids crediting every session
-- with a bogus 300s lead-in gap.
with raw_deltas as (
    select workout_session_id as sid,
           done_at - lag(done_at)
               over (partition by workout_session_id order by done_at) as delta
    from exercise_set
    where workout_session_id is not null
      and done_at is not null
      and is_deleted = false
      and skipped = false
),
gaps as (
    select sid, least(extract(epoch from delta)::int, 300) as gap
    from raw_deltas
    where delta is not null
)
update workout_session s
set active_seconds = t.total
from (select sid, sum(gap)::int as total from gaps group by sid) t
where s.id = t.sid
  and s.active_seconds is null
  and s.status = 'completed';

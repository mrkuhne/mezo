-- Habit engine (bd mezo-d1jb): make the level_up_event idempotency uniqueness soft-delete aware.
-- The habit un-check (revertHabit) is the first source to soft-delete a level_up_event and then
-- re-award (re-check) with the same (created_by, source_type, source_ref_id). The original plain
-- table constraint spans soft-deleted rows, so the re-insert would collide. Convert it to the
-- house-standard PARTIAL UNIQUE index (the daily_quest / briefing / habit_day precedent): one LIVE
-- award per source ref, while soft-deleted rows are ignored. GYM/RUN/SPORT/QUEST/ACTIVITY keep
-- identical live-row idempotency (all their rows are is_deleted = false).

alter table level_up_event drop constraint uq_level_up_event_created_by_source;
create unique index uq_level_up_event_created_by_source
    on level_up_event (created_by, source_type, source_ref_id)
    where is_deleted = false;

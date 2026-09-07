-- The konzílium's structured exchange (bd mezo-xlvr, spec 2026-09-06 §5): the rounds already
-- hold the shape (proposal index, KEEP/KILL, ELFOGADVA/ELUTASÍTVA) in memory and flatten it into
-- prose before saving, so the transcript can only be read speaker-by-speaker. This column keeps
-- the shape. Nullable on purpose: rows written before this change have no deliberation, and the
-- read path derives one from their prose transcript instead of back-filling here.

alter table character_conference add column deliberation jsonb;

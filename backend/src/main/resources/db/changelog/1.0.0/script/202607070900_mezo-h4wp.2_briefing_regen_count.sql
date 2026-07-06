-- Proactive B1.2 (bd mezo-h4wp.2, roadmap §B1.2): staleness-regeneration counter.
-- A regenerated briefing row (soft-delete + insert) carries prior regen_count + 1;
-- the GET path stops regenerating at mezo.proactive.briefing.regen-cap-per-day.

alter table briefing
    add column regen_count int not null default 0;

-- Quantised sleep-stage sequence from the tracker screenshot (mezo-fk9a).
-- Display-only provenance: never queried on its own, never aggregated in SQL, always
-- read with its parent row — which is why this is a jsonb column and not a child table.
alter table sleep_log add column hypnogram jsonb;

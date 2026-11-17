-- Volume engine v2 (mezo-r36n9.65): muscle_group_volume_log is DERIVED from the plan
-- (the sum of the run's own sets per muscle group). The tier band of each group is stored
-- next to the landmarks so every reader sees the same target range.
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder).

alter table muscle_group_volume_log add column band_low integer;
alter table muscle_group_volume_log add column band_high integer;

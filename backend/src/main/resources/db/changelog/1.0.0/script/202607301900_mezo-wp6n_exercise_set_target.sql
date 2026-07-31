-- Medal collection (bd mezo-wp6n): snapshot the Progresszió-prescribed target onto the logged
-- set. Without it TARGET_HIT is underivable — ProgressionSignal is recomputed from the LATEST
-- history on every read, so a past set's prescription cannot be reconstructed. Both nullable:
-- null = no prescription was in force (first session, switch off, or a pre-mezo-wp6n row).
alter table exercise_set add column target_weight_kg numeric(6, 2);
alter table exercise_set add column target_reps integer;

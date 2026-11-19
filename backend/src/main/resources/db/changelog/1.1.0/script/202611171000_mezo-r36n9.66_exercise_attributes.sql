-- Selection attributes of the exercise catalogue (mezo-r36n9.66, spec 2026-11-17-boop-gyakorlatvalasztas-design §6.1).
-- Master rows get them from content/exercise-catalog.json (loader-owned, overwritten on every start); user-authored
-- rows keep them NULL, which the swap treats as "never filtered by attributes". `gear` is the finer multi-valued kit
-- list; the single-valued `equipment` of mezo-r36n9.79 is unchanged. `lengthened` (loaded at a stretch) is a different
-- notion from `lengthened_friendly`.
alter table exercise_catalog add column gear varchar(16)[];
alter table exercise_catalog add column pattern varchar(24);
alter table exercise_catalog add column secondary_muscles varchar(24)[];
alter table exercise_catalog add column joints varchar(16)[];
alter table exercise_catalog add column lengthened boolean;
alter table exercise_catalog add column demand varchar(8);

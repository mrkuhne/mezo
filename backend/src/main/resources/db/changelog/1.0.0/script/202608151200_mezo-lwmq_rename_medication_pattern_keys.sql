-- mezo-lwmq: a retatrutid-kivezetés részeként a két gyógyszer-mintapár kulcsa generikusra vált.
-- A pattern egyediség-indexe (created_by, kind, pair_key) WHERE is_deleted = false — a kulcs
-- átnevezése adatmigráció NÉLKÜL elárvítaná a meglévő minta-sorokat, és a nightly Pearson-job
-- nulla előzménnyel indítaná újra a korrelációkat.
-- A pattern_event csak pattern_id FK-t hordoz, így az események együtt mozognak.
--
-- A pattern.title egy denormalizált pillanatkép, amit kizárólag a nightly upsert ír
-- (PatternDetectionService.upsert(...), pattern.setTitle(pair.title())) — de az upsert csak
-- LIVE gate-verdiktnél fut le. A gyógyszer végleges hiánya miatt a medicationDose()/
-- medicationCycleDay() metrikasorok örökre üresek maradnak, tehát a gate-verdikt örökre
-- no_data lesz, és az upsert erre a két párra SOHA többé nem fog lefutni. Enélkül a title
-- örökre a régi drogos szöveget mutatná — a pair_key-csere önmagában NEM elég, a title-t
-- külön, explicit UPDATE-tel kell frissíteni, mert nincs olyan jövőbeli job-futás, ami
-- felülírná.

UPDATE pattern SET pair_key = 'medication-cycle-day~daily-kcal'
 WHERE pair_key = 'reta-cycle-day~daily-kcal';

UPDATE pattern SET pair_key = 'medication-dose~daily-kcal'
 WHERE pair_key = 'reta-dose~daily-kcal';

UPDATE pattern SET title = 'Gyógyszer-ciklusnap ↔ napi kalória'
 WHERE pair_key = 'medication-cycle-day~daily-kcal';

UPDATE pattern SET title = 'Gyógyszer-dózis ↔ napi kalória'
 WHERE pair_key = 'medication-dose~daily-kcal';

-- A promóciós útvonal (PatternService.java:86, fact.setFactText(pattern.getTitle())) már
-- átmásolhatta a régi, drogos title-t egy knowledge_fact sorba a pair_key-csere előtt — azt a
-- másolatot a pattern.title frissítése nem éri el. Szűk, pontos egyezés a két régi title-re
-- (nem LIKE '%Reta%'), hogy ne érintsen véletlenül más, felhasználó által írt tényeket.
UPDATE knowledge_fact SET fact_text = 'Gyógyszer-ciklusnap ↔ napi kalória'
 WHERE fact_text = 'Reta-ciklusnap ↔ napi kalória';

UPDATE knowledge_fact SET fact_text = 'Gyógyszer-dózis ↔ napi kalória'
 WHERE fact_text = 'Reta-dózis ↔ napi kalória';

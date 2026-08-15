-- mezo-lwmq: a retatrutid-kivezetés részeként a két gyógyszer-mintapár kulcsa generikusra vált.
-- A pattern egyediség-indexe (created_by, kind, pair_key) WHERE is_deleted = false — a kulcs
-- átnevezése adatmigráció NÉLKÜL elárvítaná a meglévő minta-sorokat, és a nightly Pearson-job
-- nulla előzménnyel indítaná újra a korrelációkat.
-- A pattern_event csak pattern_id FK-t hordoz, így az események együtt mozognak.

UPDATE pattern SET pair_key = 'medication-cycle-day~daily-kcal'
 WHERE pair_key = 'reta-cycle-day~daily-kcal';

UPDATE pattern SET pair_key = 'medication-dose~daily-kcal'
 WHERE pair_key = 'reta-dose~daily-kcal';

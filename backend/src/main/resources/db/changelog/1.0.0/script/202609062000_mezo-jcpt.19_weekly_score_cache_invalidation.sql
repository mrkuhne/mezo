-- mezo-jcpt.19 — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score a hét logjai feletti determinisztikus számítás write-through CACHE-e (lásd
-- WeeklyScoreService): semmi nincs itt, ami ne lenne újraszármaztatható, egy sor törlése egyetlen
-- újraszámolásba kerül a hét következő olvasásakor.
--
-- Miért most: a FORMULA_VERSION 2 -> 3 (nap-tudatos context dimenzió) miatt a MealRescoreRunner
-- újrapontozza a történelmi meal-envelope-okat, ami a napok pontszámát és így a heti átlagokat is
-- elmozdítja. A frissesség-próba viszont created_at-et olvas
-- (WeeklyScoreRepository.latestScoreInputWrittenAt: "an EDIT of an existing row ... is not
-- detected"), a re-score pedig UPDATE — e nélkül a törlés nélkül minden cache-elt hét
-- határozatlan ideig a backfill ELŐTTI számokat szolgálná ki. Ugyanaz, amit a mezo-jcpt.2 és a
-- mezo-jcpt.4 changesetje kezelt.
--
-- day_review NEM szerepel itt: annak kulcsa az inputsHash, ami tartalmazza a dimenzió-score-okat,
-- tehát magától cache-misst okoz. Kitörölni csak fölösleges LLM-hívásokba kerülne.

delete from weekly_score;

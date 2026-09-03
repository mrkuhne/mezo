-- mezo-jcpt.2 — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score a hét logjai feletti determinisztikus számítás write-through CACHE-e (lásd
-- WeeklyScoreService): semmi nincs itt, ami ne lenne újraszármaztatható, egy sor törlése egyetlen
-- újraszámolásba kerül a hét következő olvasásakor.
--
-- Miért most: a MealRescoreRunner (mezo-jcpt.2) újrapontozza a pre-jcpt.1 meal-envelope-okat, ami
-- a történelmi napok tápanyag-dimenzióját és így a heti átlagokat is elmozdítja. A frissesség-
-- próba viszont created_at-et olvas (WeeklyScoreRepository.latestScoreInputWrittenAt, a javadoc
-- explicit is kimondja: "an EDIT of an existing row ... is not detected"), a re-score pedig UPDATE
-- — e nélkül a törlés nélkül minden cache-elt hét határozatlan ideig a backfill ELŐTTI számokat
-- szolgálná ki. Ugyanaz a helyzet, amit a mezo-jcpt.4 changesetje kezelt.
--
-- day_review NEM szerepel itt: annak kulcsa az inputsHash, ami tartalmazza a dimenzió-score-okat
-- és a tényeket (DayReviewService.inputsHash), tehát magától cache-misst okoz. Kitörölni csak
-- fölösleges LLM-hívásokba kerülne.

delete from weekly_score;

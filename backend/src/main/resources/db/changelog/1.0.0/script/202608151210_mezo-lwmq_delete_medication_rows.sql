-- mezo-lwmq: a retatrutid kivezetése. TUDATOS FIZIKAI TÖRLÉS, szemben a repo is_deleted
-- soft-delete konvenciójával: a kivezetés célja épp az, hogy ne maradjon nyom — egy
-- soft-deleted sor a szer nevét a DB-ben hagyná. A normál törlési utak változatlanul
-- soft-delete-elnek; ez egyszeri, kivezetési migráció.
-- Sorrend: előbb a dózis-napló (FK a medication-re), utána a katalógus-sor.

DELETE FROM medication_dose;
DELETE FROM medication;

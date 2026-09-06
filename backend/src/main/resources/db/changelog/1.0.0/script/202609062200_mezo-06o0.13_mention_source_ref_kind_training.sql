-- Emberek (mezo-06o0.13): az edzés-jegyzet is szabadszöveges felhasználói input, amibe embert
-- lehet írni ("Marcival toltam a mellet", "Nórival röpiztünk"). Eddig se a determinisztikus
-- név-match, se a jelölt-felismerés nem látta — a mention.source_ref_kind CHECK pedig nem
-- ismerte a fajtáit, tehát a sweep írása a DB-n bukott volna el.
--
-- Két új fajta, nem egy: a workout_session és a sport_session KÜLÖN tábla, és a
-- (created_by, person_id, source_ref_kind, source_ref_id) dedup-kulcs csak akkor helyes, ha a
-- két id-tér nem keveredik — két külön táblából származó UUID egyenlősége amúgy sem várható,
-- de a feed forrás-címkéje is ezen a fajtán áll, és a felhasználónak az "edzés" és a "sport"
-- két különböző dolog.
--
-- A Liquibase changesetek megváltoztathatatlanok: ez LECSERÉLI a
-- 202608311300_mezo-jyfy_person_mention_enrichment.sql által létrehozott constraintet,
-- nem szerkeszti.
alter table mention
    drop constraint ck_mention_source_ref_kind;

alter table mention
    add constraint ck_mention_source_ref_kind check (source_ref_kind in
        ('journal_entry', 'reflection', 'gratitude', 'decision', 'activity_note', 'checkin_note',
         'chat_turn', 'workout_note', 'sport_note'));

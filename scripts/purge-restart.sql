-- =============================================================================
-- purge-restart.sql — brand-new-user purge (bd mezo-rcsy)
-- Spec: docs/superpowers/specs/2026-08-23-database-purge-restart-design.md
-- Runbook: docs/infrastructure/purge-restart-runbook.md
--
-- DELIBERATE PHYSICAL DELETE (the mezo-lwmq precedent), overriding the repo's
-- is_deleted soft-delete convention: the point of the restart is that no trace
-- remains. Normal app deletion paths are unchanged.
--
-- Mechanics: everything in schema `public` EXCEPT the whitelist below is
-- TRUNCATE ... CASCADE'd. The delete side is never enumerated, so tables added
-- after this script was written are purged too. Safe by default: unless the
-- session GUC purge.dry_run is exactly 'off', the script only REPORTS what it
-- would do. The whole script is one DO block => one implicit transaction; any
-- RAISE EXCEPTION aborts it completely.
--
--   dry run : psql -v ON_ERROR_STOP=1 -f scripts/purge-restart.sql
--   live    : see the runbook (sets purge.dry_run=off via PGOPTIONS)
-- =============================================================================
SET client_min_messages = notice;
DO $$
DECLARE
    whitelist constant text[] := ARRAY[
        'app_user',                                      -- identity
        -- A kamra ketté van választva (mezo-qw37.4): a definíció (pantry_catalog) a
        -- gyakorlattár párja — közös törzsadat + felhasználói definíciók —, a készlet
        -- (pantry_item) pedig csak rá mutatva értelmes. A pantry_item.catalog_id FK miatt
        -- a pantry_catalog kihagyása a TRUNCATE ... CASCADE-en át a kamrát is kiürítené.
        'pantry_catalog', 'pantry_item',                -- kamra (definíció + készlet)
        'recipe', 'recipe_ingredient',                  -- receptek
        'exercise_catalog',                             -- gyakorlattar
        'habit_chain', 'habit_def',                     -- routine definitions (not habit_day!)
        'stored_image',                                 -- képek: KEPT-then-TRIMMED, lásd lent (trimmed)
        'databasechangelog', 'databasechangeloglock'];  -- Liquibase bookkeeping
    -- stored_image (Boop B4): a recipe.image_id FK a kept `recipe` táblát a képtáblához köti, és a
    -- TRUNCATE ... CASCADE az ON DELETE SET NULL-t NEM veszi figyelembe — ha a stored_image a purge
    -- oldalon lenne, a CASCADE kiürítené a recepteket. Ezért a kept oldalon van, de a purge után
    -- MEGNYESSÜK: minden kép törlődik, amire a megmaradó receptek nem hivatkoznak (a törölt
    -- étkezések fotói, a felhasználók saját képei), így a személyes fotók nem maradnak árván.
    -- A sorszám-ellenőrzés ezt az egy táblát kihagyja (szándékosan változik).
    trimmed constant text[] := ARRAY['stored_image'];
    dry_run  constant boolean := coalesce(current_setting('purge.dry_run', true), 'on') <> 'off';
    kept_counts jsonb := '{}'::jsonb;
    kept_images bigint;
    kept_recipe_images bigint;
    t           record;
    n           bigint;
    purge_list  text;
    missing     text[];
BEGIN
    -- Schema-drift guard: every whitelist table must exist under exactly this name.
    SELECT array_agg(w) INTO missing
      FROM unnest(whitelist) AS w
     WHERE NOT EXISTS (SELECT 1 FROM pg_tables p
                        WHERE p.schemaname = 'public' AND p.tablename = w);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'whitelist table(s) missing from schema: % — script is stale, do not run', missing;
    END IF;

    RAISE NOTICE 'purge-restart mode: %', CASE WHEN dry_run THEN 'DRY RUN (reporting only)' ELSE 'LIVE' END;

    FOR t IN SELECT tablename FROM pg_tables
              WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I', 'public', t.tablename) INTO n;
        IF t.tablename = ANY (trimmed) THEN
            SELECT count(*) INTO kept_images FROM public.stored_image
             WHERE id IN (SELECT image_id FROM public.recipe WHERE image_id IS NOT NULL);
            RAISE NOTICE 'TRIM   % (% rows, % referenced by kept recipes — the other % are DELETED on a live run)',
                rpad(t.tablename, 40), n, kept_images, n - kept_images;
        ELSIF t.tablename = ANY (whitelist) THEN
            kept_counts := kept_counts || jsonb_build_object(t.tablename, n);
            RAISE NOTICE 'KEEP   % (% rows)', rpad(t.tablename, 40), n;
        ELSE
            purge_list := concat_ws(', ', purge_list, format('%I.%I', 'public', t.tablename));
            RAISE NOTICE 'PURGE  % (% rows)', rpad(t.tablename, 40), n;
        END IF;
    END LOOP;

    IF purge_list IS NULL THEN
        RAISE NOTICE 'nothing to purge';
        RETURN;
    END IF;

    IF dry_run THEN
        RAISE NOTICE 'dry run — nothing deleted. Live run: set purge.dry_run=off (see runbook).';
        RETURN;
    END IF;

    SELECT count(*) INTO kept_recipe_images FROM public.recipe WHERE image_id IS NOT NULL;

    EXECUTE 'TRUNCATE TABLE ' || purge_list || ' CASCADE';

    -- Trim: drop every image no kept recipe points at (meal photos, orphans); recipe images stay.
    DELETE FROM public.stored_image
     WHERE id NOT IN (SELECT image_id FROM public.recipe WHERE image_id IS NOT NULL);

    -- The trimmed table is guarded separately: only referenced images remain, and no recipe lost its image.
    SELECT count(*) INTO n FROM public.stored_image;
    IF n IS DISTINCT FROM (SELECT count(DISTINCT image_id) FROM public.recipe WHERE image_id IS NOT NULL)
       OR kept_recipe_images IS DISTINCT FROM (SELECT count(*) FROM public.recipe WHERE image_id IS NOT NULL) THEN
        RAISE EXCEPTION 'stored_image trim went wrong (% images left, recipes with an image % -> %) — aborting, transaction rolls back',
            n, kept_recipe_images, (SELECT count(*) FROM public.recipe WHERE image_id IS NOT NULL);
    END IF;

    -- Assert the CASCADE never reached a kept table: identical row counts or abort.
    FOR t IN SELECT unnest(whitelist) AS tablename LOOP
        CONTINUE WHEN t.tablename = ANY (trimmed);
        EXECUTE format('SELECT count(*) FROM %I.%I', 'public', t.tablename) INTO n;
        IF n IS DISTINCT FROM (kept_counts ->> t.tablename)::bigint THEN
            RAISE EXCEPTION 'kept table % changed (% -> % rows) — aborting, transaction rolls back',
                t.tablename, kept_counts ->> t.tablename, n;
        END IF;
    END LOOP;

    RAISE NOTICE 'purge complete — whitelist tables verified unchanged';
END $$;

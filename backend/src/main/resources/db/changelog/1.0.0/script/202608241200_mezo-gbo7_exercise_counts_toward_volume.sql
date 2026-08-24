-- mezo-gbo7: per-exercise hypertrophy-volume exemption.
alter table exercise
    add column counts_toward_volume boolean not null default true;

-- Backfill 1/2 — live exercise rows. Plyometrics and the fix-zárás closing block
-- (mezo.closing-block slugs at the time of writing) are posture/power work, not volume.
update exercise
   set counts_toward_volume = false
 where type = 'plyo'
    or catalog_id in (select id from exercise_catalog
                       where slug in ('dead-hang', 'back-extension-45'));

-- Backfill 2/2 — stored plan documents. Without this a new run stamped from an existing
-- template would recreate counting closing/plyo rows and the defect would silently return.
update meso_template t
   set days = (
         select jsonb_agg(
                  case
                    when jsonb_typeof(d -> 'exercises') <> 'array' then d
                    else jsonb_set(d, '{exercises}', (
                           select coalesce(jsonb_agg(
                                    e || jsonb_build_object('countsTowardVolume',
                                          not coalesce(
                                                e ->> 'type' = 'plyo'
                                             or (e ->> 'catalogId') in (
                                                    select id::text from exercise_catalog
                                                     where slug in ('dead-hang', 'back-extension-45')),
                                                false))
                                    order by eord), '[]'::jsonb)
                             from jsonb_array_elements(d -> 'exercises') with ordinality as ex(e, eord)))
                  end
                order by dord)
           from jsonb_array_elements(t.days) with ordinality as dy(d, dord))
 where jsonb_typeof(t.days) = 'array';

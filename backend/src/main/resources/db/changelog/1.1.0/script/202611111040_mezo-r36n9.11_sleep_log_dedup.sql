-- Boop B1 (mezo-r36n9.11): one live night per (owner, date). Generic dedup before the unique index:
-- winner = apple_health > screenshot > manual, newest created_at breaks a tie. The subjective fields
-- (quality, source_quality_pct, awakenings) a loser carries are copied into the winner where the
-- winner has none (best-ranked loser first); the losers are then soft-deleted.
with ranked as (
    select id, created_by, date, quality, source_quality_pct, awakenings,
           row_number() over (partition by created_by, date
                              order by case source when 'apple_health' then 1 when 'screenshot' then 2 else 3 end,
                                       created_at desc, id) as rn
    from sleep_log
    where is_deleted = false
),
fill as (
    select created_by, date,
           (array_agg(quality order by rn) filter (where quality is not null and rn > 1))[1] as q,
           (array_agg(source_quality_pct order by rn) filter (where source_quality_pct is not null and rn > 1))[1] as sq,
           (array_agg(awakenings order by rn) filter (where awakenings is not null and rn > 1))[1] as aw
    from ranked
    group by created_by, date
    having count(*) > 1
)
update sleep_log w
set quality = coalesce(w.quality, f.q),
    source_quality_pct = coalesce(w.source_quality_pct, f.sq),
    awakenings = coalesce(w.awakenings, f.aw)
from ranked r
join fill f on f.created_by = r.created_by and f.date = r.date
where r.rn = 1 and w.id = r.id;

update sleep_log l
set is_deleted = true
from (
    select id,
           row_number() over (partition by created_by, date
                              order by case source when 'apple_health' then 1 when 'screenshot' then 2 else 3 end,
                                       created_at desc, id) as rn
    from sleep_log
    where is_deleted = false
) r
where l.id = r.id and r.rn > 1;

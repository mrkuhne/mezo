-- mezo-dq60: machine-readable goal preset (the wizard's choice; goal stays the human prose).
alter table mesocycle    add column goal_preset text;
alter table meso_template add column goal_preset text;

-- Backfill from the exact GOAL_PRESETS[].description strings the wizard has been writing
-- into `goal` (point-in-time snapshot, same convention as the mezo-gbo7 slug backfill).
-- An edited/unknown goal stays NULL — the FE falls back to hypertrophy at the point of use.
update mesocycle set goal_preset = case goal
    when 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' then 'hypertrophy'
    when 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' then 'strength'
    when 'Volumen-tartás · izom-megőrzés · deficit nélkül' then 'cut-prep'
    when 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' then 'recovery'
    when 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' then 'sport'
    when 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' then 'erohipertrofia'
    end
where goal_preset is null;

update meso_template set goal_preset = case goal
    when 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' then 'hypertrophy'
    when 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' then 'strength'
    when 'Volumen-tartás · izom-megőrzés · deficit nélkül' then 'cut-prep'
    when 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' then 'recovery'
    when 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' then 'sport'
    when 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' then 'erohipertrofia'
    end
where goal_preset is null;

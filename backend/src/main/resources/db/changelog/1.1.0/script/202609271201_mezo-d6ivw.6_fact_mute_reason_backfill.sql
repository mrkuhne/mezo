-- S6 (mezo-d6ivw.6): facts muted before the reason existed. A fact whose promoting pattern was
-- refuted was muted BY the refute (S2); every other muted fact was the user's own toggle.
-- muted_at stays null: the old toggle was never timestamped, and a made-up date would lie.
update knowledge_fact kf set muted_reason = 'refuted'
 where kf.include_in_prompt = false and kf.muted_reason is null and kf.is_deleted = false
   and exists (select 1 from pattern p
                where p.promoted_fact_id = kf.id and p.status = 'refuted' and p.is_deleted = false);
update knowledge_fact set muted_reason = 'user'
 where include_in_prompt = false and muted_reason is null and is_deleted = false;

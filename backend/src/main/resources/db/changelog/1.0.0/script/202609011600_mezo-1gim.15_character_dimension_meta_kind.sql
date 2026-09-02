-- mezo-1gim.15 (round 4): a third dimension kind. META = the companion's own self-audit
-- dimension ("A társ önvizsgálata"), seeded like CORE, owned by the Szkeptikus, never retired.
alter table character_dimension drop constraint ck_character_dimension_kind;
alter table character_dimension
    add constraint ck_character_dimension_kind check (kind in ('CORE', 'CHAPTER', 'META'));

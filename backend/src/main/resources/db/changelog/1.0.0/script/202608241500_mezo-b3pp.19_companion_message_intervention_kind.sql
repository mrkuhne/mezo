-- W5.2 (bd mezo-b3pp.19, spec §9.2): the intervention feed card is a sixth companion_message
-- kind. CK swap only — table shape, partial unique index (one LIVE row per user+day+kind) and
-- write path are unchanged; the one-per-day consequence for interventions is deliberate
-- (anti-nagging: the first raise of the day wins).

alter table companion_message drop constraint ck_companion_message_kind;
alter table companion_message add constraint ck_companion_message_kind
    check (kind in ('morning','sleep','weight','midday','evening','intervention'));

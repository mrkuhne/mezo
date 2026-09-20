-- Weight diagnosis (bd mezo-85x5r): the third phenomenon is WEEK-ANCHORED. ck widens by
-- drop + re-add (the 202608311500_mezo-po3y precedent); anchor_start is the ISO Monday,
-- null for the rolling phenomena.
alter table diagnosis add column anchor_start date;
alter table diagnosis drop constraint ck_diagnosis_phenomenon;
alter table diagnosis add constraint ck_diagnosis_phenomenon
    check (phenomenon in ('fatigue', 'sleep', 'weight'));

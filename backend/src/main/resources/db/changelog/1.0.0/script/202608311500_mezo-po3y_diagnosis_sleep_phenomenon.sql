-- Second diagnosis phenomenon (bd mezo-po3y): sleep. The ck widens by drop + re-add — the
-- 202608271500_mezo-p2tr_feedback_weekly_review_kind.sql precedent; changesets are immutable.
alter table diagnosis drop constraint ck_diagnosis_phenomenon;
alter table diagnosis add constraint ck_diagnosis_phenomenon check (phenomenon in ('fatigue', 'sleep'));

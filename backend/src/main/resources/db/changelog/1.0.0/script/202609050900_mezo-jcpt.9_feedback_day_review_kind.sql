-- Day review (mezo-jcpt.9): the day-evaluation page's LLM prose (day_review, DayReviewEntity's
-- own row id) becomes the seventh W4.1 feedback artifactId — register the seventh kind (the
-- 202608271500_mezo-p2tr_feedback_weekly_review_kind.sql idiom). No data migration: an enlarged
-- CHECK never touches the existing rows, it only widens what a future insert may claim.
alter table message_feedback drop constraint ck_message_feedback_artifact_kind;
alter table message_feedback add constraint ck_message_feedback_artifact_kind check (artifact_kind in
    ('chat_message', 'feed_message', 'weekly_suggestion', 'weekly_review', 'memoir', 'prediction', 'day_review'));

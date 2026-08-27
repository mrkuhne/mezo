-- Weekly review (mezo-p2tr, spec 2026-08-27 §5): the review itself is the W4.1 feedback
-- artifactId (weekly_review) — register the sixth kind (the mezo-b3pp.1 memory_embedding-kind
-- expansion idiom).
alter table message_feedback drop constraint ck_message_feedback_artifact_kind;
alter table message_feedback add constraint ck_message_feedback_artifact_kind check (artifact_kind in
    ('chat_message', 'feed_message', 'weekly_suggestion', 'weekly_review', 'memoir', 'prediction'));

-- Slice 8 Task 2 (mezo-76f6): meal-coach prose (kind meal_coach, artifact id = meal id) and the
-- recipe-breakdown result (kind recipe_breakdown, artifact id = recipe id) become the eighth and
-- ninth W4.1 feedback artifact kinds — same CHECK-swap idiom as
-- 202609050900_mezo-jcpt.9_feedback_day_review_kind.sql. No data migration: an enlarged CHECK
-- never touches the existing rows, it only widens what a future insert may claim.
alter table message_feedback drop constraint ck_message_feedback_artifact_kind;
alter table message_feedback add constraint ck_message_feedback_artifact_kind check (artifact_kind in
    ('chat_message', 'feed_message', 'weekly_suggestion', 'weekly_review', 'memoir', 'prediction', 'day_review',
     'meal_coach', 'recipe_breakdown'));

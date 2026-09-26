-- Csapatfal Act III (mezo-a9bo7.21): a team chat line becomes the tenth W4.1 feedback artifact
-- kind — same CHECK-swap idiom as 202609091500_mezo-76f6_feedback_meal_coach_recipe_breakdown_kind.sql.
-- No data migration: an enlarged CHECK never touches the existing rows, it only widens what a
-- future insert may claim.
alter table message_feedback drop constraint ck_message_feedback_artifact_kind;
alter table message_feedback add constraint ck_message_feedback_artifact_kind check (artifact_kind in
    ('chat_message', 'feed_message', 'weekly_suggestion', 'weekly_review', 'memoir', 'prediction', 'day_review',
     'meal_coach', 'recipe_breakdown', 'team_chat_line'));

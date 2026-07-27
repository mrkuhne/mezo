-- Template meal role on a recipe (mezo-uavr): selects the scoring rubric overlay on the template
-- surface. Existing rows default to STANDARD = the identity overlay, so every current fit number is
-- unchanged. Values mirror the MealRole enum (@Enumerated(STRING)).
ALTER TABLE recipe
    ADD COLUMN role varchar(16) NOT NULL DEFAULT 'STANDARD';

ALTER TABLE recipe
    ADD CONSTRAINT ck_recipe_role
        CHECK (role IN ('STANDARD','PRE_WORKOUT','POST_WORKOUT'));

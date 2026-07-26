-- Reframe activity_level from the 5-band PAL scale to the 3-band NEAT lifestyle model
-- (DESK|MIXED|PHYSICAL), matching the reframed contract enum + GoalEngineProperties.Neat mapping.
-- The old constraint (ck_biometric_profile_activity_level, changeset mezo-g1u) is released and
-- immutable, so this replaces it via a new changeset. Existing rows are remapped in place:
--   SEDENTARY|LIGHT -> DESK,  MODERATE -> MIXED,  VERY|EXTRA -> PHYSICAL.
ALTER TABLE biometric_profile DROP CONSTRAINT ck_biometric_profile_activity_level;

UPDATE biometric_profile
   SET activity_level = CASE activity_level
       WHEN 'SEDENTARY' THEN 'DESK'
       WHEN 'LIGHT'     THEN 'DESK'
       WHEN 'MODERATE'  THEN 'MIXED'
       WHEN 'VERY'      THEN 'PHYSICAL'
       WHEN 'EXTRA'     THEN 'PHYSICAL'
       ELSE activity_level
   END
 WHERE activity_level IN ('SEDENTARY','LIGHT','MODERATE','VERY','EXTRA');

ALTER TABLE biometric_profile
    ADD CONSTRAINT ck_biometric_profile_activity_level
        CHECK (activity_level IN ('DESK','MIXED','PHYSICAL'));

-- G5 engine fields: TDEE/recept artifacts on goal + PAL activity-level on biometric_profile.
-- Additive only (existing rows carry none until first evaluate). Never modify a released changeset.
ALTER TABLE goal ADD COLUMN tdee_bootstrap JSONB;
ALTER TABLE goal ADD COLUMN prescription    JSONB;

ALTER TABLE biometric_profile ADD COLUMN activity_level TEXT;
ALTER TABLE biometric_profile
    ADD CONSTRAINT ck_biometric_profile_activity_level
        CHECK (activity_level IN ('SEDENTARY','LIGHT','MODERATE','VERY','EXTRA'));

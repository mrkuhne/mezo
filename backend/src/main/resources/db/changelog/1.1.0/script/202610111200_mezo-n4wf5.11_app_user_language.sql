ALTER TABLE app_user ADD COLUMN language varchar(2) NOT NULL DEFAULT 'hu';
ALTER TABLE app_user ADD CONSTRAINT ck_app_user_language CHECK (language IN ('hu', 'en'));

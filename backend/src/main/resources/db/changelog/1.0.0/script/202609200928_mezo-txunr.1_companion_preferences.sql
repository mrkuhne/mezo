CREATE TABLE companion_preferences (
    id uuid DEFAULT gen_random_uuid(),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    about_me varchar(4000) NOT NULL DEFAULT '',
    custom_instructions varchar(4000) NOT NULL DEFAULT '',
    use_learned_profile boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_companion_preferences_id PRIMARY KEY (id),
    CONSTRAINT fk_companion_preferences_created_by_app_user_id FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_companion_preferences_created_by ON companion_preferences(created_by) WHERE is_deleted = false;

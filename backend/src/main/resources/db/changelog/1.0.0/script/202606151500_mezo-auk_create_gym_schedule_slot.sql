-- DDL: gym schedule — recurring weekly gym time slots (when the user trains, per weekday).
-- Lean weekday->time aggregate, standalone (persists across mesocycles); the active meso
-- supplies the "what" (gym days) and these slots supply the "when".
-- day_of_week: 0=Hét .. 6=Vas (matches the FE DAY_ORDER index).
CREATE TABLE gym_schedule_slot (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    day_of_week SMALLINT NOT NULL,
    time        VARCHAR(5) NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_gym_schedule_slot_id PRIMARY KEY (id),
    CONSTRAINT fk_gym_schedule_slot_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_gym_schedule_slot_day_of_week CHECK (day_of_week BETWEEN 0 AND 6)
);
CREATE INDEX idx_gym_schedule_slot_created_by_day_of_week
    ON gym_schedule_slot (created_by, day_of_week);

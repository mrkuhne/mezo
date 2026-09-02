-- mezo-dzbm — per-user learned timing components. ROW per component rather than a wide
-- table: adding a component later is a new row, not a migration, and each row carries its own
-- sample count so the outlier gate can open independently per component.
--
-- value_num/deviation_num are the RFC 6298 pair (smoothed estimate + smoothed deviation).
-- Seeds live in config (mezo.train.timing.seed-*), not here: a user with no row yet gets the
-- static frontend constants, so the estimate is correct from the first day.
create table workout_timing_profile (
    id             UUID        NOT NULL,
    created_by     UUID        NOT NULL,
    component      TEXT        NOT NULL,
    value_num      DOUBLE PRECISION NOT NULL,
    deviation_num  DOUBLE PRECISION NOT NULL,
    samples        INTEGER     NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted     BOOLEAN     NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_workout_timing_profile PRIMARY KEY (id),
    CONSTRAINT ck_workout_timing_profile_component CHECK (
        component IN ('set_cycle_compound', 'set_cycle_isolation', 'transition', 'lead_in')),
    CONSTRAINT ck_workout_timing_profile_samples CHECK (samples >= 0)
);

CREATE UNIQUE INDEX uq_workout_timing_profile_owner_component
    ON workout_timing_profile (created_by, component);

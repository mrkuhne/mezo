-- DDL: T2 (workout execution) — instance self-FK, set->instance FK, voice_note->note rename,
-- exercise_feedback (RP debrief: pump 1-4, joint_pain 1-3, workload 1-3)
ALTER TABLE workout_session ADD COLUMN template_session_id UUID;
ALTER TABLE workout_session ADD CONSTRAINT fk_workout_session_template_session_id_workout_session_id
    FOREIGN KEY (template_session_id) REFERENCES workout_session(id) ON DELETE SET NULL;
CREATE INDEX idx_workout_session_template_session_id ON workout_session (template_session_id);

ALTER TABLE exercise_set ADD COLUMN workout_session_id UUID;
ALTER TABLE exercise_set ADD CONSTRAINT fk_exercise_set_workout_session_id_workout_session_id
    FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE;
CREATE INDEX idx_exercise_set_workout_session_id ON exercise_set (workout_session_id);

ALTER TABLE exercise_set RENAME COLUMN voice_note TO note;

CREATE TABLE exercise_feedback (
    id                 UUID DEFAULT gen_random_uuid(),
    created_by         UUID NOT NULL,
    workout_session_id UUID NOT NULL,
    exercise_id        UUID NOT NULL,
    pump               SMALLINT NOT NULL,
    joint_pain         SMALLINT NOT NULL,
    workload           SMALLINT NOT NULL,
    is_deleted         BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_exercise_feedback_id PRIMARY KEY (id),
    CONSTRAINT fk_exercise_feedback_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_feedback_workout_session_id_workout_session_id
        FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_feedback_exercise_id_exercise_id
        FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE,
    CONSTRAINT ck_exercise_feedback_pump CHECK (pump BETWEEN 1 AND 4),
    CONSTRAINT ck_exercise_feedback_joint_pain CHECK (joint_pain BETWEEN 1 AND 3),
    CONSTRAINT ck_exercise_feedback_workload CHECK (workload BETWEEN 1 AND 3),
    CONSTRAINT uq_exercise_feedback_workout_session_id_exercise_id UNIQUE (workout_session_id, exercise_id)
);
CREATE INDEX idx_exercise_feedback_workout_session_id ON exercise_feedback (workout_session_id);

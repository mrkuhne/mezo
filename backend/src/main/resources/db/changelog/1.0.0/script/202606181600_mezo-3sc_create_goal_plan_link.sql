CREATE TABLE goal_plan_link (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    goal_id     UUID NOT NULL,
    plan_type   TEXT NOT NULL,
    plan_id     UUID NOT NULL,
    start_week  INT NOT NULL,
    end_week    INT NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_goal_plan_link_id PRIMARY KEY (id),
    CONSTRAINT fk_goal_plan_link_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_goal_plan_link_goal_id_goal_id
        FOREIGN KEY (goal_id) REFERENCES goal(id) ON DELETE CASCADE,
    CONSTRAINT ck_goal_plan_link_plan_type CHECK (plan_type IN ('mesocycle','running_block')),
    CONSTRAINT ck_goal_plan_link_weeks CHECK (start_week >= 1 AND end_week >= start_week)
);
CREATE INDEX idx_goal_plan_link_goal_id ON goal_plan_link (goal_id);
CREATE INDEX idx_goal_plan_link_created_by ON goal_plan_link (created_by);

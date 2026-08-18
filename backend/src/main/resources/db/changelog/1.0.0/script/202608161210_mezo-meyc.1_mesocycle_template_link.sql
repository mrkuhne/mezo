-- DDL: link a running mesocycle back to the template it was started from (mezo-meyc.1),
-- plus closed_at so a finished/archived meso records when it actually closed.
ALTER TABLE mesocycle ADD COLUMN template_id UUID;
ALTER TABLE mesocycle ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE mesocycle ADD CONSTRAINT fk_mesocycle_template_id_meso_template_id
    FOREIGN KEY (template_id) REFERENCES meso_template (id);
CREATE INDEX idx_mesocycle_template_id ON mesocycle (template_id);

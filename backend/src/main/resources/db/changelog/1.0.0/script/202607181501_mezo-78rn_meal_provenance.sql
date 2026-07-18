-- mezo-78rn: AI-log provenance envelope (origin manual|ai-text|ai-photo); NULL for manual/legacy rows
alter table meal add column provenance jsonb;

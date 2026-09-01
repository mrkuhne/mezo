-- Emberek S5 (mezo-06o0.4): a gráf-tükör hetedik node-fajtája. Az aktív személy PERSON
-- node-ként jelenik meg a tudásgráfban, hogy a [Összefüggések] blokk és a Tudásgráf
-- felület az embereket is lássa. A kind oszlop varchar(12) — a 'PERSON' (6) elfér.
ALTER TABLE knowledge_node DROP CONSTRAINT ck_knowledge_node_kind;
ALTER TABLE knowledge_node
    ADD CONSTRAINT ck_knowledge_node_kind
        CHECK (kind IN ('PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT', 'PERSON'));

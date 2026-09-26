-- mezo-a80d0: statistical (pair-catalog) rows never had their evidence_hits/evidence_misses
-- tallied — PatternDetectionService now counts one per LIVE night. Backfill the undecided rows
-- from their own snapshot history (a snapshot is written only on a LIVE night), using the same
-- hit rule: |r| >= 0.3 AND p <= 0.15 (mezo.companion.feed.inbox-*) in the plan's expected
-- direction. Confirmed/rejected rows stay frozen at their judged state.
UPDATE pattern pt
SET evidence_hits   = t.hits,
    evidence_misses = t.misses
FROM (
    SELECT e.pattern_id,
           count(*) FILTER (WHERE abs((e.payload ->> 'r')::numeric) >= 0.3
                              AND (e.payload ->> 'p')::numeric <= 0.15
                              AND CASE WHEN p.test_plan ->> 'expectedDirection' = 'negative'
                                       THEN (e.payload ->> 'r')::numeric < 0
                                       ELSE (e.payload ->> 'r')::numeric > 0 END) AS hits,
           count(*) FILTER (WHERE NOT (abs((e.payload ->> 'r')::numeric) >= 0.3
                              AND (e.payload ->> 'p')::numeric <= 0.15
                              AND CASE WHEN p.test_plan ->> 'expectedDirection' = 'negative'
                                       THEN (e.payload ->> 'r')::numeric < 0
                                       ELSE (e.payload ->> 'r')::numeric > 0 END)) AS misses
    FROM pattern_event e
    JOIN pattern p ON p.id = e.pattern_id
    WHERE e.kind = 'snapshot'
      AND e.is_deleted = false
      AND e.payload ->> 'r' IS NOT NULL
      AND e.payload ->> 'p' IS NOT NULL
      AND p.kind = 'statistical'
      AND p.status IN ('proposed', 'monitoring')
      AND p.test_plan IS NOT NULL
      AND p.is_deleted = false
    GROUP BY e.pattern_id
) t
WHERE pt.id = t.pattern_id;

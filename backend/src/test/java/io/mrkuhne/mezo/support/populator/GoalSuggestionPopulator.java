package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the GoalSuggestion aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class GoalSuggestionPopulator {

    private final GoalSuggestionRepository suggestionRepository;

    /** Full-control factory: persists an open (proposed) suggestion and flushes so DB CHECKs fire. */
    public GoalSuggestionEntity createOpen(
        UUID owner, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload) {
        GoalSuggestionEntity e = new GoalSuggestionEntity();
        e.setCreatedBy(owner);
        e.setGoalId(goalId);
        e.setKind(kind);
        e.setStatus("proposed");
        e.setDedupKey(dedupKey);
        e.setPayload(payload);
        return suggestionRepository.saveAndFlush(e);
    }
}

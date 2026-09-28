package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.service.MatchedPerson;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

/** S8: a matcher failure never costs the user the turn — no block, no disclosure. */
class PeopleRecallTest {

    @Test
    void testRecall_shouldFailOpen_whenTheMatcherThrows() {
        MentionDetectionService broken = new MentionDetectionService(null, null) {
            @Override
            public List<MatchedPerson> matchActivePersons(UUID userId, String text, int max) {
                throw new IllegalStateException("boom");
            }
        };
        PeopleRecall recall = new PeopleRecall(broken, null,
                new StaticListableBeanFactory().getBeanProvider(io.mrkuhne.mezo.feature.people.service.PersonFactService.class));

        assertThat(recall.recall(UUID.randomUUID(), "Dórival", LocalDate.of(2026, 9, 27)))
                .isEqualTo(PeopleRecall.Result.EMPTY);
    }
}

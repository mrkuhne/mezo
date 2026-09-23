package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class ContextualFeedEvaluationIT extends AbstractIntegrationTest {
    record Case(String id, String kind, String date, String context, String prior, List<String> weights, String expectation) { }
    @Autowired private ObjectMapper json;
    @Autowired private UserPopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private WeightLogPopulator weights;
    @Autowired private CompanionMessageRepository repository;
    @Autowired private FeedGenerationService generator;

    @Test
    void testCorpus_shouldExerciseAllCasesWithoutSavingMessages_whenReplayed() throws Exception {
        var input = getClass().getResourceAsStream("/eval/contextual-feed/cases.json");
        assertThat(input).isNotNull();
        var cases = List.of(json.readValue(input, Case[].class));
        assertThat(cases).hasSize(12);
        assertThat(cases).extracting(Case::id).doesNotHaveDuplicates();
        for (var c : cases) {
            var user = users.createUser().getId();
            var date = LocalDate.parse(c.date());
            if (!c.prior().isBlank()) messages.createMessage(user, date.minusDays(1), c.kind(), "Tegnap",
                    List.of(c.prior()), Instant.parse(c.date() + "T00:00:00Z").minusSeconds(86400));
            for (int i = 0; i < c.weights().size(); i++) weights.createWeightLog(user,
                    date.minusDays(c.weights().size() - i - 1), new BigDecimal(c.weights().get(i)));
            long before = repository.count();
            var result = generator.generate(user, date, c.kind(), c.context());
            assertThat(result).as(c.id()).isNotNull();
            assertThat(result.trace()).isNotNull();
            assertThat(repository.count()).isEqualTo(before);
            assertThat(c.expectation()).isNotBlank();
        }
    }
}

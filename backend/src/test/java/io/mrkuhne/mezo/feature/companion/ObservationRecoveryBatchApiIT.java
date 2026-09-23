package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.observation-inbox.recovery-max-candidates=3")
class ObservationRecoveryBatchApiIT extends ApiIntegrationTest {
    private static final String URL = "/api/companion/observation/recovery";
    @Autowired private AppUserRepository users;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private JournalPopulator journals;
    @Autowired private DailySummaryPopulator summaries;
    @Autowired private LlmLogPopulator logs;
    @Autowired private LlmLogRepository logRepository;
    @Autowired private PatternRepository patterns;
    @Autowired private ObjectMapper json;
    @Autowired private FakeCompanionLlm fake;

    @Test
    void testPreview_shouldAccumulateThreeCandidates_whenTwoSmallBatchesAreNeeded() {
        seed(List.of(List.of("work-energy", "sleep"), List.of("stress", "extra")), false);
        int promptStart = fake.recoveryProposalPrompts().size();
        int contextStart = fake.userMessages().size();
        JsonNode result = request();
        assertThat(result.path("candidates").size()).isEqualTo(3);
        assertThat(fake.recoveryProposalPrompts().subList(promptStart, fake.recoveryProposalPrompts().size()))
                .hasSize(2).satisfies(prompts -> {
                    assertThat(prompts.getFirst()).contains("legfeljebb 2");
                    assertThat(prompts.getLast()).contains("legfeljebb 1");
                });
        assertThat(fake.userMessages().subList(contextStart, fake.userMessages().size()))
                .anySatisfy(context -> assertThat(context).contains("Visszaállítási kör: 2.", "energy-work", "sleep"));
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
    }

    @Test
    void testPreview_shouldStopWithoutDuplicateCandidates_whenNextBatchRepeatsNormalizedTopics() {
        seed(List.of(List.of("work-energy", "sleep"), List.of("energy_work", "sleep"), List.of("stress")), false);
        int before = fake.recoveryProposalPrompts().size();
        JsonNode result = request();
        assertThat(result.path("candidates").size()).isEqualTo(2);
        assertThat(fake.recoveryProposalPrompts().size() - before).isEqualTo(2);
    }

    @Test
    void testPreview_shouldFailWithoutPartialPlan_whenLaterBatchTransportFails() {
        seed(List.of(List.of("work-energy", "sleep"), List.of("stress")), true);
        String response = postForBody(URL, Map.of("mode", "preview"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(response, "OBSERVATION_RECOVERY_LLM_FAILED");
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
    }

    private UUID owner() { return users.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId(); }

    private JsonNode request() {
        return json.readTree(postForBody(URL, Map.of("mode", "preview"), ownerAuthHeaders(), HttpStatus.OK, String.class));
    }

    private void seed(List<List<String>> topics, boolean failSecond) {
        var journal = journals.createEntry(owner(), LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String critique = json.writeValueAsString(Map.of("statistical", .1, "confounders", .2, "l3align", .4,
                "actionability", .8, "grounded", true, "contradicted", false, "actionable", true, "reasoning", "Eredeti napló."));
        StringBuilder script = new StringBuilder();
        for (int i = 0; i < topics.size(); i++) {
            String response = failSecond && i == 1 ? FakeCompanionLlm.FAIL_COMPLETE
                    : json.writeValueAsString(topics.get(i).stream().map(topic -> Map.of(
                        "title", topic + " [fake-critique:" + critique + "]", "mechanism", "Lehetséges kapcsolat",
                        "category", "trigger", "observation", "Munka után elfáradtál.", "question", "Jellemző?",
                        "evidenceRefs", List.of("journal_entry:" + journal.getId()), "topicKey", topic)).toList());
            script.append("[fake-recovery-batch:").append(i + 1).append(':')
                    .append(Base64.getEncoder().encodeToString(response.getBytes(StandardCharsets.UTF_8))).append("]\n");
        }
        summaries.summary(owner(), LocalDate.now().minusDays(1), script.toString());
        var log = logs.log(owner(), CallKind.SMART, "companion_hypothesis", "fake", 10, 10);
        log.setOperation("propose");
        log.setResponseText("[{\"title\":\"Korábbi sejtés\"}]");
        logRepository.saveAndFlush(log);
    }
}

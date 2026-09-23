package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.proactive.service.FeedGenerationService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class FeedGenerationServiceIT extends AbstractIntegrationTest {
    @Autowired private tools.jackson.databind.ObjectMapper mapper;
    @Autowired private io.mrkuhne.mezo.support.populator.WeightLogPopulator weights;
    @Autowired private FeedGenerationService generator;
    @Autowired private io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm fake;
    @Autowired private DatabasePopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private CompanionMessageRepository repository;

    @Test
    void testGenerate_shouldRecordExecutedToolsAndRoundTripTrace_whenReplyIsValid() {
        var user = users.populateUser("feed-generate@test.local");
        var date = LocalDate.now();
        var generated = generator.generate(user, date, "weight", "[fake-tool:get_weight_log {\"days\":7}]");
        assertThat(generated).isNotNull();
        assertThat(generated.trace().toolCalls().calls()).extracting(c -> c.name()).contains("get_weight_log");
        var row = messages.createMessage(user, date, "weight", generated.eyebrow(), generated.body());
        row.setContent(new CompanionMessageEnvelope(generated.eyebrow(), generated.body(), generated.refs())
                .withTrace(generated.trace()));
        repository.saveAndFlush(row);
        assertThat(repository.findById(row.getId()).orElseThrow().getContent().trace()).isEqualTo(generated.trace());
    }

    @Test
    void testGenerate_shouldReturnNoMessage_whenModelReturnsMalformedJson() {
        var user = users.populateUser("feed-bad-json@test.local");
        assertThat(generator.generate(user, LocalDate.now(), "sleep", "[fake-contextual-malformed]")).isNull();
    }

    @Test
    void testLegacyEnvelope_shouldKeepNullTrace_whenExistingConstructorUsed() {
        assertThat(new CompanionMessageEnvelope("Korábbi", List.of("Régi üzenet"), List.of()).trace()).isNull();
    }
    @Test
    void testGenerate_shouldKeepPartialMessageAndFailureTrace_whenReadFails() {
        var user = users.populateUser("feed-partial@test.local");
        var result = generator.generate(user, LocalDate.now(), "weight",
                "[fake-tool:get_weight_log {\"days\":\"invalid\"}]");
        assertThat(result).isNotNull();
        assertThat(result.trace().degradedReason()).isEqualTo("tool_failed");
        assertThat(result.refs()).isEmpty();
    }

    @Test
    void testEnvelope_shouldDeserializeLegacyJson_whenTraceAbsent() {
        var legacy = mapper.readValue("{\"eyebrow\":\"Régi\",\"body\":[\"Szöveg\"],\"refs\":[]}",
                CompanionMessageEnvelope.class);
        assertThat(legacy.trace()).isNull();
        assertThat(legacy.body()).containsExactly("Szöveg");
    }

    @Test
    void testGenerate_shouldResolveOnlyCollectedSources_whenModelSelectsForeignAndInventedIds() {
        var user = users.populateUser("feed-citations@test.local");
        var other = users.populateUser("feed-citations-other@test.local");
        var date = LocalDate.now();
        var own = weights.createWeightLog(user, date, new java.math.BigDecimal("81.2"));
        var foreign = weights.createWeightLog(other, date, new java.math.BigDecimal("91.2"));
        var prior = messages.createMessage(user, date.minusDays(1), "weight", "Korábban", List.of("Előzmény"));
        String answer = mapper.writeValueAsString(java.util.Map.of("eyebrow", "Mérés", "body", List.of("Mai mérés"),
                "sourceRefs", List.of(java.util.Map.of("kind", "weight_log", "id", own.getId().toString()),
                        java.util.Map.of("kind", "companion_message", "id", prior.getId().toString()),
                        java.util.Map.of("kind", "weight_log", "id", foreign.getId().toString()),
                        java.util.Map.of("kind", "weight_log", "id", "invented"))));
        String script = java.util.Base64.getEncoder().encodeToString(answer.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var result = generator.generate(user, date, "weight", "[fake-contextual-json:" + script + "]");
        assertThat(result).isNotNull();
        assertThat(result.refs()).extracting(r -> r.kind()).containsExactly("Weight", "Memory");
        assertThat(result.refs().getFirst().label()).contains("Súlymérés");
        assertThat(result.refs().getLast().label()).contains("Korábbi Mezo");
        assertThat(result.trace().sourceRefs()).extracting(r -> r.id()).contains(own.getId().toString())
                .doesNotContain(foreign.getId().toString(), "invented");
    }

    @Test
    void testGenerate_shouldUseOneReasonedCall_whenEvidenceAlreadySuffices() {
        var user = users.populateUser("feed-reasoned@test.local");
        int before = fake.feedSmartCallCount();
        assertThat(generator.generate(user, LocalDate.now(), "morning", "Mai feljegyzés")).isNotNull();
        assertThat(fake.feedSmartCallCount() - before).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldStopRepeatedReads_whenModelRequestsSameToolAgain() {
        var user = users.populateUser("feed-repeat@test.local");
        var result = generator.generate(user, LocalDate.now(), "weight",
                "[fake-tool:get_weight_log {\"days\":7}] [fake-feed-repeat-read]");
        assertThat(result).isNotNull();
        assertThat(result.trace().toolCalls().calls()).hasSize(1);
        assertThat(result.trace().degradedReason()).isEqualTo("read_loop_stopped");
    }

}

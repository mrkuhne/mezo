package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Proves the typed jsonb envelopes on ai_message survive a real DB round-trip (ADR 0006 pattern). */
@Transactional
class AiMessageJsonbRoundTripIT extends AbstractIntegrationTest {

    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testPersist_shouldRoundTripTypedEnvelopes_whenToolCallsAndRefsSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz");
        message.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=2"))));
        message.setRefs(new RefsEnvelope(List.of(
                new RefsEnvelope.Ref("weight", "2026-07-01"))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls().calls()).hasSize(1);
        assertThat(reloaded.getToolCalls().calls().getFirst().name()).isEqualTo("get_weight_trend");
        assertThat(reloaded.getToolCalls().calls().getFirst().args()).isEqualTo("weeks=2");
        assertThat(reloaded.getRefs().refs().getFirst().kind()).isEqualTo("weight");
        assertThat(jdbcTemplate.queryForObject(
                "select jsonb_typeof(tool_calls) from ai_message where id = ?", String.class, id))
                .isEqualTo("object");
    }

    @Test
    void testPersist_shouldKeepEnvelopesNull_whenNotSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-null@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_USER);
        message.setContent("kérdés");
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls()).isNull();
        assertThat(reloaded.getRefs()).isNull();
        assertThat(reloaded.getRecalledMemories()).isNull();
    }

    /**
     * W3.1b (mezo-b3pp.28): the recall disclosure envelope. Worth its own case because it carries
     * the FIRST temporal in an ai_message envelope — a {@code LocalDate} has no native jsonb type,
     * so it travels as an ISO string and a serializer misconfiguration would surface here (as an
     * epoch-day array or an off-by-one date) rather than silently in the UI.
     */
    @Test
    void testPersist_shouldRoundTripRecalledMemories_whenAmbientRecallDisclosed() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-recalled@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        UUID refId = UUID.randomUUID();

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz emlékekkel");
        message.setRecalledMemories(new RecalledMemoriesEnvelope(List.of(
                new RecalledMemoriesEnvelope.Item("journal_entry", refId, LocalDate.of(2026, 8, 10),
                        "napló", "futás után jobban aludtam", 0.92))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getRecalledMemories().items()).singleElement().satisfies(item -> {
            assertThat(item.kind()).isEqualTo("journal_entry");
            assertThat(item.refId()).isEqualTo(refId);
            assertThat(item.occurredOn()).isEqualTo(LocalDate.of(2026, 8, 10));
            assertThat(item.label()).isEqualTo("napló");
            assertThat(item.gist()).isEqualTo("futás után jobban aludtam");
            assertThat(item.similarity()).isEqualTo(0.92);
        });
        assertThat(jdbcTemplate.queryForObject(
                "select jsonb_typeof(recalled_memories) from ai_message where id = ?", String.class, id))
                .isEqualTo("object");
    }

    /**
     * mezo-b3pp.33 review finding: {@link RefsEnvelope.Ref}'s 2-arg constructor proves nothing
     * about a genuinely pre-migration row, because Jackson still serialises it with an explicit
     * {@code "label":null} key present. A pre-{@code mezo-b3pp.33} row has no {@code label} key
     * at all. This writes that raw shape directly and confirms Jackson defaults the missing
     * record component to null rather than failing deserialisation.
     */
    @Test
    void testRefs_shouldDeserialiseWithNullLabel_whenTheJsonbPredatesTheLabelField() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-legacy-ref@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz régi hivatkozással");
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        jdbcTemplate.update(
                "update ai_message set refs = ?::jsonb where id = ?",
                "{\"refs\":[{\"kind\":\"Workout\",\"id\":\"w-1\"}]}", id);
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getRefs().refs()).singleElement().satisfies(ref -> {
            assertThat(ref.kind()).isEqualTo("Workout");
            assertThat(ref.id()).isEqualTo("w-1");
            assertThat(ref.label()).isNull();
        });
    }

    @Test
    void testRecalled_shouldDeserialiseWithNullAuditIds_whenJsonbPredatesSharedRetrieval() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-legacy-recalled@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        UUID refId = UUID.randomUUID();

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz régi emlékkel");
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        jdbcTemplate.update(
                "update ai_message set recalled_memories = ?::jsonb where id = ?",
                """
                {"items":[{"kind":"journal_entry","refId":"%s","occurredOn":"2026-08-10",
                "label":"napló","gist":"régi emlék","similarity":0.8}]}
                """.formatted(refId), id);
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getRecalledMemories().items()).singleElement().satisfies(item -> {
            assertThat(item.refId()).isEqualTo(refId);
            assertThat(item.retrievalRunId()).isNull();
            assertThat(item.retrievalResultId()).isNull();
            assertThat(item.memoryItemId()).isNull();
            assertThat(item.indicator()).isNull();
        });
    }

    /**
     * S9.7 (mezo-rj214.7): tool_outcomes is the RESULT half of a turn's provenance, positionally
     * parallel to tool_calls (the ask). It must round-trip independently of tool_calls because the
     * 90-day retention scrub NULLs only this column.
     */
    @Test
    void testPersist_shouldRoundTripToolOutcomes_whenReadsReturned() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-outcomes@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz kimenetekkel");
        message.setToolOutcomes(ToolOutcomesEnvelope.ofOrNull(List.of(
                new ToolOutcomesEnvelope.Outcome("get_recovery", "Kedd óta 7,2 óra átlag.", false),
                new ToolOutcomesEnvelope.Outcome("get_meals", "A lekérés nem sikerült.", true))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolOutcomes().outcomes()).hasSize(2);
        assertThat(reloaded.getToolOutcomes().outcomes().get(0).name()).isEqualTo("get_recovery");
        assertThat(reloaded.getToolOutcomes().outcomes().get(0).text()).isEqualTo("Kedd óta 7,2 óra átlag.");
        assertThat(reloaded.getToolOutcomes().outcomes().get(0).failed()).isFalse();
        assertThat(reloaded.getToolOutcomes().outcomes().get(1).name()).isEqualTo("get_meals");
        assertThat(reloaded.getToolOutcomes().outcomes().get(1).text()).isEqualTo("A lekérés nem sikerült.");
        assertThat(reloaded.getToolOutcomes().outcomes().get(1).failed()).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select jsonb_typeof(tool_outcomes) from ai_message where id = ?", String.class, id))
                .isEqualTo("object");
    }

    @Test
    void testPersist_shouldKeepToolOutcomesNull_whenOfOrNullGivenEmptyOrNullList() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-outcomes-empty@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        assertThat(ToolOutcomesEnvelope.ofOrNull(List.of())).isNull();
        assertThat(ToolOutcomesEnvelope.ofOrNull(null)).isNull();

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz kimenet nélkül");
        message.setToolOutcomes(ToolOutcomesEnvelope.ofOrNull(List.of()));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolOutcomes()).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "select tool_outcomes is null from ai_message where id = ?", Boolean.class, id))
                .isTrue();
    }

    /**
     * S9.7 (mezo-rj214.7): {@code why} exists only on a planned (pipeline) turn, where the planner
     * said why it wanted this read. The 3-arg constructor is kept for the legacy shape and the
     * ran-truth audit path — it must keep reloading with {@code why == null}.
     */
    @Test
    void testPersist_shouldRoundTripToolCallWhy_whenPlannedTurnGivesAReason() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-why@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz indoklással");
        message.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_recovery", "days=7",
                        "a felhasználó az alvásáról kérdezett"))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls().calls().getFirst().why())
                .isEqualTo("a felhasználó az alvásáról kérdezett");
    }

    @Test
    void testPersist_shouldRoundTripToolCallWhyAsNull_whenWrittenThroughLegacyThreeArgConstructor() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-why-legacy@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz indoklás nélkül");
        message.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=2"))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls().calls().getFirst().why()).isNull();
    }
}

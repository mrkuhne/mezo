package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
@Transactional
class PersonalRecordIT extends AbstractIntegrationTest {
    @Autowired private CompanionToolRegistry registry;
    @Autowired private DatabasePopulator users;
    @Autowired private JournalPopulator journals;
    @Autowired private JournalEntryRepository journalRepository;
    @Autowired private io.mrkuhne.mezo.support.populator.MealPopulator meals;
    @Autowired private io.mrkuhne.mezo.support.populator.PantryItemPopulator pantry;
    @Autowired private io.mrkuhne.mezo.feature.meal.repository.MealRepository mealRepository;
    @Autowired private io.mrkuhne.mezo.support.populator.MemoryItemPopulator memories;
    private final ObjectMapper json = new ObjectMapper();

    private JsonNode call(UUID user, String tool, Map<String, Object> args) {
        var audit = registry.newTurnAudit();
        var callback = registry.conversationCallbacks(audit).stream()
                .filter(c -> c.getToolDefinition().name().equals(tool)).findFirst().orElseThrow();
        return json.readTree(callback.call(json.writeValueAsString(args),
                new ToolContext(registry.toolContext(user, audit))));
    }

    @Test
    void testSources_shouldExposeAuditedDomains_whenDiscovering() {
        UUID user = users.populateUser("records-discover@test.local");
        String result = call(user, "list_personal_sources", Map.of("domain", "all")).toString();
        assertThat(result).contains("journal_entry", "biometric_profile", "goal", "diet_settings",
                "meal_item", "exercise_set", "person", "prediction", "experiment", "ritual_day");
        assertThat(result).doesNotContain("app_user", "push_subscription", "password", "llm_call_log");
    }

    @Test
    void testRead_shouldExecuteEveryApprovedProjection_whenDatabaseSchemaCurrent() {
        UUID user = users.populateUser("records-schema@test.local");
        var sources = call(user, "list_personal_sources", Map.of("domain", "all")).path("sources");
        assertThat(sources.size()).isGreaterThan(80);
        sources.forEach(source -> {
            var result = call(user, "read_personal_records", Map.of("source", source.asText()));
            assertThat(result.has("records")).as(source.asText()).isTrue();
        });
    }

    @Test
    void testRead_shouldReturnHistoricalFullSource_whenOlderThanThirtyDays() {
        UUID user = users.populateUser("records-history@test.local");
        var date = LocalDate.now().minusYears(2);
        var entry = journals.createEntry(user, date, "Régi pontos háttér", "quickinput");
        var result = call(user, "read_personal_records", Map.of("source", "journal_entry",
                "from", date.toString(), "to", date.toString()));
        assertThat(result.toString()).contains(entry.getId().toString(), "Régi pontos háttér");
        assertThat(result.path("hasMore").asBoolean()).isFalse();
    }

    @Test
    void testRead_shouldHideForeignAndDeletedRows_whenIdsKnown() {
        UUID a = users.populateUser("records-a@test.local");
        UUID b = users.populateUser("records-b@test.local");
        var foreign = journals.createEntry(b, LocalDate.now(), "FOREIGN_SECRET", "quickinput");
        var deleted = journals.createEntry(a, LocalDate.now(), "DELETED_SECRET", "quickinput");
        journalRepository.delete(deleted);
        journalRepository.flush();
        for (UUID id : java.util.List.of(foreign.getId(), deleted.getId())) {
            var result = call(a, "read_personal_records", Map.of("source", "journal_entry", "id", id.toString()));
            assertThat(result.path("records").isEmpty()).isTrue();
            assertThat(result.toString()).doesNotContain("SECRET");
        }
    }

    @Test
    void testRead_shouldHideCanonicalMemoryImmediately_whenOriginalSourceDeleted() {
        UUID user = users.populateUser("records-memory-delete@test.local");
        var entry = journals.createEntry(user, LocalDate.now(), "Elfelejtendő eredeti", "quickinput");
        var memory = memories.item(user, "journal_entry", entry.getId(), entry.getText(), entry.getOccurredOn());
        var args = Map.<String, Object>of("source", "memory_item", "id", memory.getId().toString());
        assertThat(call(user, "read_personal_records", args).path("records").size()).isEqualTo(1);
        journalRepository.delete(entry);
        journalRepository.flush();
        assertThat(call(user, "read_personal_records", args).path("records").isEmpty()).isTrue();
    }

    @Test
    void testRead_shouldReturnFrozenMealDetailsAndHideDeletedParents_whenFilteringChildren() {
        UUID user = users.populateUser("records-meal@test.local");
        UUID foreign = users.populateUser("records-meal-foreign@test.local");
        var item = pantry.createFoodWithNutrients(user, "Fagyasztott tápérték");
        var date = LocalDate.now().minusYears(1);
        var meal = meals.createPantryMeal(user, item, date);
        var args = Map.<String, Object>of("source", "meal_item", "parentId", meal.getId().toString(),
                "from", date.toString(), "to", date.toString());
        String result = call(user, "read_personal_records", args).toString();
        assertThat(result).contains("snapshot_protein_g", "snapshot_fiber_g", "snapshot_per", "150", "Fagyasztott");
        assertThat(call(foreign, "read_personal_records", args).path("records").isEmpty()).isTrue();
        mealRepository.delete(meal);
        mealRepository.flush();
        assertThat(call(user, "read_personal_records", args).path("records").isEmpty()).isTrue();
    }

    @Test
    void testRead_shouldTreatWildcardAsLiteral_whenSearchingText() {
        UUID user = users.populateUser("records-literal@test.local");
        journals.createEntry(user, LocalDate.now(), "Teljesítmény 100%", "quickinput");
        journals.createEntry(user, LocalDate.now(), "Másik bejegyzés", "quickinput");
        var result = call(user, "read_personal_records", Map.of("source", "journal_entry", "query", "%"));
        assertThat(result.path("records").size()).isEqualTo(1);
        assertThat(result.toString()).contains("100%");
    }

    @Test
    void testRead_shouldContinueLongTextWithoutLoss_whenRecordExceedsBudget() {
        UUID user = users.populateUser("records-long@test.local");
        String text = "Hosszú idézet: \"🍀\"\\\n".repeat(400) + "TAIL_UNIQUE";
        var entry = journals.createEntry(user, LocalDate.now(), text, "quickinput");
        StringBuilder assembled = new StringBuilder();
        int position = 0;
        for (int i = 0; i < 30; i++) {
            var result = call(user, "read_personal_records", Map.of("source", "journal_entry",
                    "id", entry.getId().toString(), "contentOffset", position));
            assertThat(result.toString().length()).isLessThanOrEqualTo(8000);
            var row = result.path("records").get(0);
            assembled.append(row.path("content").asText());
            if (row.path("nextContentOffset").isNull()) break;
            int next = row.path("nextContentOffset").asInt();
            assertThat(next).isGreaterThan(position);
            position = next;
        }
        assertThat(json.readTree(assembled.toString()).path("text").asText()).isEqualTo(text);
    }

    @Test
    void testRead_shouldPageWithoutLosingRows_whenMoreThanPageSize() {
        UUID user = users.populateUser("records-page@test.local");
        for (int i = 0; i < 11; i++) journals.createEntry(user, LocalDate.now().minusDays(i), "entry-" + i, "quickinput");
        var ids = new java.util.HashSet<String>();
        int offset = 0;
        for (int i = 0; i < 20; i++) {
            var result = call(user, "read_personal_records", Map.of("source", "journal_entry", "offset", offset));
            result.path("records").forEach(row -> assertThat(ids.add(row.path("id").asText())).isTrue());
            if (!result.path("hasMore").asBoolean()) break;
            offset = result.path("nextOffset").asInt();
        }
        assertThat(ids).hasSize(11);
    }

    @Test
    void testRead_shouldRejectUnknownSourcesAndInvalidFilters_whenUntrustedArguments() {
        UUID user = users.populateUser("records-invalid@test.local");
        for (var args : java.util.List.of(Map.of("source", "app_user"),
                Map.of("source", "journal_entry; select 1"),
                Map.of("source", "journal_entry", "from", "not-date"),
                Map.of("source", "journal_entry", "parentId", UUID.randomUUID().toString()))) {
            assertThat(call(user, "read_personal_records", Map.copyOf(args)).has("error")).isTrue();
        }
    }
}

package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.api.dto.HabitSuggestResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * AI habit suggester (mezo-n5e9.3, Task 2) against the fake LLM ({@code CompanionApiIT}'s
 * {@code @ActiveProfiles("companion-fake")} pattern) — the {@code HabitSuggestLlmAdapter}'s
 * grounding + strict-JSON parse + filter chain, end to end through the HTTP contract.
 *
 * <p>The sentinel JSON is planted via the request's {@code chainKey} field rather than {@code
 * hint}: {@code hint} carries a contract {@code @Size(max = 200)}, too tight for a multi-item
 * JSON array, while {@code chainKey} is unconstrained and — like {@code chainKey} everywhere in
 * the adapter's context — only ever read back into the LLM's context text, never validated
 * against the real chain-key set (that check applies to the MODEL'S OUTPUT chainKey, not the
 * request's preselection hint).
 *
 * <p>The adapter-absent 503 path lives in {@code HabitAiSuggestSwitchOffIT} — Task 1's coverage
 * moved there once this task's adapter started existing at the default IT profile.
 */
@ActiveProfiles("companion-fake")
class HabitAiSuggestApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private HabitCatalogService habitCatalogService;
    @Autowired private SkillProgressPopulator skillProgressPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** Grounds every test in the same fixture: the seed catalog's MORNING/EVENING chains (+ their
     *  seed defs, for the non-duplication instruction) and two LIFE skills with real XP — the
     *  grounded skillKey whitelist the adapter validates suggestions against. */
    @BeforeEach
    void seedCatalogAndSkills() {
        UUID owner = ownerId();
        habitCatalogService.ensureCatalog(owner);
        skillProgressPopulator.createSkill(owner, "mindset", "LIFE", 50, 3);
        skillProgressPopulator.createSkill(owner, "recovery", "LIFE", 30, 2);
    }

    @Test
    void testSuggest_shouldReturnBothInOrder_whenSentinelSuppliesTwoValidSuggestions() {
        HttpHeaders auth = ownerAuthHeaders();
        String sentinel = "[fake-habit-suggest:["
                + suggestionJson("Napi hála-jegyzet", "mindset", 10, "EVENING") + ","
                + suggestionJson("Esti nyújtás", "recovery", 5, "EVENING")
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().chainKey(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(2);
        assertThat(response.getSuggestions().get(0).getTitle()).isEqualTo("Napi hála-jegyzet");
        assertThat(response.getSuggestions().get(1).getTitle()).isEqualTo("Esti nyújtás");
    }

    @Test
    void testSuggest_shouldCapAtMaxSuggestions_whenSentinelSuppliesMoreThanTheCap() {
        HttpHeaders auth = ownerAuthHeaders();
        StringBuilder items = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            if (i > 0) {
                items.append(',');
            }
            items.append(suggestionJson("Javaslat " + i, i % 2 == 0 ? "mindset" : "recovery", 10, "MORNING"));
        }
        String sentinel = "[fake-habit-suggest:[" + items + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().chainKey(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(5); // mezo.companion.habit-suggest.max-suggestions
    }

    @Test
    void testSuggest_shouldDropDirtyRows_whenSkillKeyOrChainKeyUnknownOrXpOutOfRange() {
        HttpHeaders auth = ownerAuthHeaders();
        String sentinel = "[fake-habit-suggest:["
                + suggestionJson("Jó javaslat", "mindset", 10, "MORNING") + ","
                + suggestionJson("Ismeretlen skill", "unknown_skill", 10, "MORNING") + ","
                + suggestionJson("Ismeretlen lánc", "mindset", 10, "UNKNOWN_CHAIN") + ","
                + suggestionJson("Túl sok XP", "mindset", 20, "MORNING")
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().chainKey(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(1);
        assertThat(response.getSuggestions().getFirst().getTitle()).isEqualTo("Jó javaslat");
    }

    @Test
    void testSuggest_shouldReturnEmptySuggestions_whenSentinelUnparseable() {
        HttpHeaders auth = ownerAuthHeaders();
        HabitSuggestRequest request =
                HabitSuggestRequest.builder().chainKey("[fake-habit-suggest:not-json]").build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).isEmpty();
    }

    private static String suggestionJson(String title, String skillKey, int xp, String chainKey) {
        return "{\"title\":\"" + title + "\",\"why\":\"FAKE-INDOK\",\"anchorCopy\":\"teszt után\","
                + "\"skillKey\":\"" + skillKey + "\",\"xp\":" + xp + ",\"chainKey\":\"" + chainKey + "\"}";
    }
}

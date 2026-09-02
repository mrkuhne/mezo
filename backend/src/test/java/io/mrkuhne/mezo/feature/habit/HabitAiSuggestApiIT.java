package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.api.dto.HabitSuggestResponse;
import io.mrkuhne.mezo.api.dto.HabitSuggestion;
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
 * <p>The sentinel JSON is planted via the request's {@code hint} field: {@code chainKey} is now
 * validated against the caller's own live chain keys BEFORE being echoed into the LLM context at
 * all (the review fix — never echo unvalidated input), so a sentinel planted there would simply
 * never reach the prompt text. {@code hint} carries a contract {@code @Size(max = 200)}, so
 * payloads here are deliberately compact (dropped optional {@code why}/{@code anchorCopy} fields,
 * short titles); the over-cap case uses {@link
 * io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm#SUGGEST_COUNT_SENTINEL}, a compact
 * count-DSL, instead of spelling out 7 JSON objects.
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
                + suggestionJson("A", "mindset", 10, "MORNING") + ","
                + suggestionJson("B", "recovery", 5, "EVENING")
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().hint(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(2);
        assertThat(response.getSuggestions().get(0).getTitle()).isEqualTo("A");
        assertThat(response.getSuggestions().get(1).getTitle()).isEqualTo("B");
    }

    @Test
    void testSuggest_shouldCapAtMaxSuggestions_whenSentinelSuppliesMoreThanTheCap() {
        HttpHeaders auth = ownerAuthHeaders();
        HabitSuggestRequest request =
                HabitSuggestRequest.builder().hint("[fake-habit-suggest-count:7]").build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(5); // mezo.companion.habit-suggest.max-suggestions
    }

    @Test
    void testSuggest_shouldDropDirtyRows_whenSkillKeyUnknownOrXpOutOfRange() {
        HttpHeaders auth = ownerAuthHeaders();
        String sentinel = "[fake-habit-suggest:["
                + suggestionJson("J", "mindset", 10, "MORNING") + ","
                + "{\"title\":\"S\",\"skillKey\":\"unknown_skill\",\"xp\":10}" + ","
                + suggestionJson("X", "mindset", 99, "MORNING")
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().hint(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(1);
        assertThat(response.getSuggestions().getFirst().getTitle()).isEqualTo("J");
    }

    /** A separate (not folded into {@link #testSuggest_shouldDropDirtyRows_whenSkillKeyUnknownOrXpOutOfRange})
     *  test for the unknown-{@code chainKey} dirty row: that sentinel is already 199 of the
     *  {@code hint} field's 200-char cap, with zero room left for a fourth row — this covers the
     *  adapter's {@code chainKeys.contains(s.chainKey())} filter (final-review nit, mezo-n5e9.3). */
    @Test
    void testSuggest_shouldDropDirtyRow_whenChainKeyUnknown() {
        HttpHeaders auth = ownerAuthHeaders();
        String sentinel = "[fake-habit-suggest:["
                + suggestionJson("J", "mindset", 10, "MORNING") + ","
                + suggestionJson("C", "mindset", 10, "NOPE")
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().hint(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(1);
        assertThat(response.getSuggestions().getFirst().getTitle()).isEqualTo("J");
    }

    /** mezo-3zue.2: a suggestion may propose a full FOGG recipe (framework + celebration) — the
     *  five new optional contract fields must survive the round trip from the model's JSON
     *  through {@code HabitSuggestPort.Suggestion} into the {@code HabitSuggestion} DTO. */
    @Test
    void testSuggest_shouldCarryFrameworkFields_whenModelReturnsThem() {
        HttpHeaders auth = ownerAuthHeaders();
        String sentinel = "[fake-habit-suggest:["
                + "{\"title\":\"Napi szándék\",\"skillKey\":\"mindset\",\"xp\":10,\"chainKey\":\"MORNING\","
                + "\"framework\":\"FOGG\",\"celebration\":\"ökölrázás\"}"
                + "]]";
        HabitSuggestRequest request = HabitSuggestRequest.builder().hint(sentinel).build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).hasSize(1);
        HabitSuggestion suggestion = response.getSuggestions().getFirst();
        assertThat(suggestion.getFramework()).isEqualTo(HabitSuggestion.FrameworkEnum.FOGG);
        assertThat(suggestion.getCelebration()).isEqualTo("ökölrázás");
    }

    @Test
    void testSuggest_shouldReturnEmptySuggestions_whenSentinelUnparseable() {
        HttpHeaders auth = ownerAuthHeaders();
        HabitSuggestRequest request =
                HabitSuggestRequest.builder().hint("[fake-habit-suggest:not-json]").build();

        HabitSuggestResponse response = postForBody(
                "/api/habit/ai/suggest", request, auth, HttpStatus.OK, HabitSuggestResponse.class);

        assertThat(response.getSuggestions()).isEmpty();
    }

    /** Compact — {@code why}/{@code anchorCopy} dropped (both optional-in-practice for the
     *  adapter's own filter chain) to keep multi-item sentinels under {@code hint}'s 200-char cap. */
    private static String suggestionJson(String title, String skillKey, int xp, String chainKey) {
        return "{\"title\":\"" + title + "\",\"skillKey\":\"" + skillKey + "\",\"xp\":" + xp
                + ",\"chainKey\":\"" + chainKey + "\"}";
    }
}

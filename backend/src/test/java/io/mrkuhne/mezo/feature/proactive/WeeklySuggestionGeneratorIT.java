package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * W1 generation flow over the fake LLM: gather = prior-week summaries + facts + patterns +
 * snapshot; the [fake-weekly:…] sentinel (planted via a check-in note → snapshot) scripts the
 * prose; empty prior week or blank answer ⇒ NO row (honest absence). The smart tier is used —
 * the fake's completeSmart default delegates to complete, so the marker dispatch covers both.
 */
@Transactional
@ActiveProfiles("companion-fake")
class WeeklySuggestionGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private WeeklySuggestionGenerator generator;
    @Autowired private WeeklySuggestionRepository repository;
    @Autowired private WeeklySuggestionPopulator weeklySuggestionPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposePriorWeekSummariesFactsAndSnapshot_whenDataExists() {
        UUID user = userPopulator.createUser("ws-gather@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(2), "Előző héten kemény edzés volt.");
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "E heti nap — nem tartozik bele.");
        knowledgeFactPopulator.fact(user, "Laktózérzékeny", "health", 1);

        String payload = generator.gather(user, WEEK_START);

        assertThat(payload)
                .contains("Előző héten kemény edzés volt.")
                .doesNotContain("E heti nap — nem tartozik bele.")   // strictly BEFORE week_start
                .contains("Laktózérzékeny")
                .contains("AKTUÁLIS ÁLLAPOT");
    }

    @Test
    void testGather_shouldReturnNull_whenPriorWeekEmpty() {
        UUID user = userPopulator.createUser("ws-empty@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Csak e heti nap van.");

        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedProse_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("ws-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap pihenő volt.");
        checkInPopulator.createCheckIn(user, LocalDate.now(), "06:30", 4, 2,
                "[fake-weekly:Fókuszálj az alvásra és a fehérjére ezen a héten.]");

        WeeklySuggestionEntity suggestion = generator.generate(user, WEEK_START);

        assertThat(suggestion).isNotNull();
        assertThat(suggestion.getProse()).isEqualTo("Fókuszálj az alvásra és a fehérjére ezen a héten.");
        assertThat(suggestion.getWeekStart()).isEqualTo(WEEK_START);
    }

    @Test
    void testGenerate_shouldReturnExisting_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("ws-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap úszás volt.");
        WeeklySuggestionEntity existing = weeklySuggestionPopulator.suggestion(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerBlank() {
        UUID user = userPopulator.createUser("ws-blank@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap futás volt.");
        checkInPopulator.createCheckIn(user, LocalDate.now(), "06:30", 4, 2, "[fake-weekly: ]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }
}

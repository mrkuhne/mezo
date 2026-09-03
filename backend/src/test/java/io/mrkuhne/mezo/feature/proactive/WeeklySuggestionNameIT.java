package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Proves the {@code WeeklySuggestionGenerator} prompt is rendered through {@link PromptPersona}
 * before it reaches the LLM (mezo-qw37.6, Table A row 24). The {@link
 * FakeCompanionLlm#SYSTEM_ECHO_SENTINEL} planted in a prior-week daily-summary narrative flows
 * into {@code gather}'s payload (the userMessage), which makes the fake echo the RAW systemPrompt
 * back verbatim as the answer — so the persisted prose IS the rendered prompt, and the assertion
 * bites on a dropped {@code promptPersona.render(...)} call.
 */
@ActiveProfiles("companion-fake")
class WeeklySuggestionNameIT extends AbstractIntegrationTest {

    @Autowired private WeeklySuggestionGenerator generator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testGenerate_shouldNameTheUser_whenPromptIsRendered() {
        AppUserEntity user = userPopulator.createUser("weekly-name@test.local");
        user.setName("Anna");
        userPopulator.save(user);
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        dailySummaryPopulator.summary(user.getId(), weekStart.minusDays(3),
                "Edzés és jó alvás. " + FakeCompanionLlm.SYSTEM_ECHO_SENTINEL);

        var suggestion = generator.generate(user.getId(), weekStart);

        assertThat(suggestion).isNotNull();
        assertThat(suggestion.getProse())
                .contains("tervjavaslatot Anna számára")
                .doesNotContain(PromptPersona.NAME_TOKEN)
                .doesNotContain("Daniel");
    }
}

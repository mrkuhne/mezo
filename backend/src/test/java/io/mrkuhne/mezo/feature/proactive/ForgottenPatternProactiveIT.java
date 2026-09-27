package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewDigestService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyReviewGenerator;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S6 final review Important 4: "Elfelejtem" is permanent — a forgotten observation must never
 * reach a proactive LLM prompt (weekly suggestion, memoir, weekly review) nor the weekly-review
 * digest, even though its row (and its in-week events) still exist.
 */
@ActiveProfiles("companion-fake")
class ForgottenPatternProactiveIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    private static final String FORGOTTEN = "Elfelejtett észrevétel szövege";

    @Autowired private WeeklySuggestionGenerator suggestionGenerator;
    @Autowired private MemoirGenerator memoirGenerator;
    @Autowired private WeeklyReviewGenerator reviewGenerator;
    @Autowired private WeeklyReviewDigestService digestService;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void aForgottenPattern_shouldReachNoProactivePrompt_andNoDigest() {
        UUID user = userPopulator.createUser().getId();
        PatternEntity forgotten = patternPopulator.reflectionNoPlan(user, PatternEntity.STATUS_FORGOTTEN);
        forgotten.setTitle(FORGOTTEN);
        patternPopulator.save(forgotten);
        // it was confirmed inside the week before the user made Mezo forget it
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(user);
        event.setPatternId(forgotten.getId());
        event.setKind(PatternEventEntity.KIND_CONFIRMED);
        event.setOccurredAt(WEEK_START.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        patternEventRepository.saveAndFlush(event);

        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");
        sleepLogPopulator.createSleepLog(user, WEEK_START.plusDays(1), new BigDecimal("7.5"), 8);
        checkInPopulator.createCheckIn(user, WEEK_START.plusDays(1), "08:00", 8, 3, null);

        assertThat(suggestionGenerator.gather(user, WEEK_START.plusWeeks(1))).isNotNull().doesNotContain(FORGOTTEN);
        MemoirGenerator.MemoirGather memoir = memoirGenerator.gather(user, WEEK_START);
        assertThat(memoir.payload()).doesNotContain(FORGOTTEN);
        assertThat(memoir.candidates()).noneMatch(a -> FORGOTTEN.equals(a.label()));
        WeeklyReviewGenerator.WeeklyReviewGather review = reviewGenerator.gather(user, WEEK_START);
        assertThat(review.payload()).doesNotContain(FORGOTTEN);
        assertThat(review.candidates()).noneMatch(h -> forgotten.getId().equals(h.refId()));
        assertThat(digestService.getDigest(user, WEEK_START).getPatterns()).isEmpty();
    }
}

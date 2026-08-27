package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Weekly review generation flow over the fake LLM (mezo-p2tr, the {@code MemoirGeneratorIT}
 * idiom): gather = the week's {@code MeWeekService} day rows + the week's confirmed pattern
 * events + the week's memoir (when present), with numbered highlight candidates; strict-JSON
 * {@code {summary, dayNotes, anchorIndexes}} scripted via {@code [fake-review:{…}]} planted in
 * that MEMOIR'S TITLE — the ONLY candidate-bearing field the gather renders exactly ONCE (the
 * pattern/fact/life-event sections render their label BOTH in their own section AND again in the
 * numbered HORGONY-JELÖLTEK listing, so a sentinel planted there would appear twice and defeat
 * the GREEDY nested-JSON match; the memoir candidate's label is the week-start date, not its
 * title, so the title stays a single, safely-matchable occurrence — the memoir narrative
 * precedent, adapted for this generator's duplicated-label sections).
 *
 * <p>No class-level {@code @Transactional} — same emit-under-{@code REQUIRES_NEW} deadlock
 * rationale as {@code MemoirGeneratorIT} (bd mezo-gzhp.1 precedent). Isolation comes from
 * {@code ResetDatabase} via {@link AbstractIntegrationTest}.
 */
@ActiveProfiles("companion-fake")
class WeeklyReviewGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private WeeklyReviewGenerator generator;
    @Autowired private WeeklyReviewRepository repository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private MemoirRepository memoirRepository;
    @Autowired private UserPopulator userPopulator;

    /** A day with SOME logged data — just enough to clear the empty-week gate. */
    private void seedDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("7.5"), 8);
        checkInPopulator.createCheckIn(owner, date, "08:00", 8, 3, null);
    }

    /** A confirmed pattern_event in-week, grounded on a plainly-titled pattern — the Pattern
     *  highlight candidate the highlight-resolution tests target by index. */
    private void seedConfirmedPatternEvent(UUID owner, LocalDate weekStart) {
        PatternEntity pattern = patternPopulator.createPattern(
                owner, "pair-" + UUID.randomUUID().toString().substring(0, 8), "Alvás minta");
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(owner);
        event.setPatternId(pattern.getId());
        event.setKind(PatternEventEntity.KIND_CONFIRMED);
        event.setOccurredAt(weekStart.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        patternEventRepository.saveAndFlush(event);
    }

    /** A memoir row whose TITLE carries the {@code [fake-review:{…}]} sentinel — see the class
     *  javadoc for why this is the safe planting channel. */
    private void seedMemoirWithSentinel(UUID owner, LocalDate weekStart, String sentinel) {
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(owner);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(sentinel);
        memoir.setBody("Teszt heti memoár.");
        memoir.setAnchors(new MemoirAnchorsEnvelope(List.of()));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        memoirRepository.saveAndFlush(memoir);
    }

    @Test
    void generatesRowFromWeekData() {
        UUID user = userPopulator.createUser("wr-gen@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Jó hét volt.\",\"dayNotes\":[{\"date\":\""
                        + WEEK_START + "\",\"note\":\"Nyugodt hétfő.\"}],\"anchorIndexes\":[0]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(review.getWeekStart()).isEqualTo(WEEK_START);
        assertThat(review.getSummary()).isEqualTo("Jó hét volt.");
        assertThat(review.getDayNotes().notes()).hasSize(1);
        assertThat(review.getDayNotes().notes().get(0).date()).isEqualTo(WEEK_START);
        assertThat(review.getDayNotes().notes().get(0).note()).isEqualTo("Nyugodt hétfő.");
        // anchorIndexes:[0] resolves to candidate #0 — the Pattern highlight (added before the
        // Memory candidate the memoir itself contributes).
        assertThat(review.getHighlights().highlights()).hasSize(1);
        assertThat(review.getHighlights().highlights().get(0).kind()).isEqualTo("Pattern");
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("weekly_review_ready");
                    assertThat(n.getDeeplink()).isEqualTo("/me/week?start=" + WEEK_START);
                });
    }

    @Test
    void emptyWeekProducesNoRow() {
        UUID user = userPopulator.createUser("wr-empty@test.local").getId();

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user)).isEmpty();
    }

    @Test
    void unusableAnswerProducesNoRow() {
        UUID user = userPopulator.createUser("wr-broken@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, "[fake-review:{\"summary\":}]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }

    @Test
    void existingRowReturnedUntouched() {
        UUID user = userPopulator.createUser("wr-idem@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        WeeklyReviewEntity existing = weeklyReviewPopulator.weeklyReview(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void invalidHighlightIndexesAreDropped() {
        UUID user = userPopulator.createUser("wr-invalid-idx@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Vegyes hét.\",\"dayNotes\":[],\"anchorIndexes\":[0,99]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(review.getHighlights().highlights()).hasSize(1);
        assertThat(review.getHighlights().highlights().get(0).kind()).isEqualTo("Pattern");
    }
}

package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticeService;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.TextSignalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Reflexió S4 (mezo-eq85.4) Step 3, the budget's veto: {@code notice.max-per-day=0} means the
 * observation is still WRITTEN (the pattern's story stays complete — the app noticed something)
 * but never SURFACED, so no notification is emitted. A separate class rather than a case inside
 * {@code QuickNoticeServiceIT} because the cap is bound config: the repo's own idiom for a
 * property that must differ is a second {@code @TestPropertySource} context (the
 * {@code *SwitchOffIT} precedent).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.push-enabled=true",
        "mezo.companion.reflection.notice.max-per-day=0",
        "mezo.companion.reflection.notice.quiet-from=23:59",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class QuickNoticeBudgetOffIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    private static final TestPlanEnvelope ANNA_PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    @Autowired private QuickNoticeService quickNoticeService;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testOnSignal_shouldWriteAnUnsurfacedObservationAndNotNotify_whenTheDailyCapIsZero() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, ANNA_PLAN, PatternEntity.STATUS_PROPOSED);
        JournalEntryEntity entry = journalPopulator.createEntry(owner, TODAY,
                "Ma Annával sétáltunk a Duna-parton, jólesett.", "quickinput");
        TextSignalEntity signal = textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL,
                entry.getId(), TODAY, 4, 3, 2, List.of("Anna"), List.of("kapcsolatok"));

        quickNoticeService.onSignal(owner, signal.getId());

        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId());
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().getKind()).isEqualTo(PatternEventEntity.KIND_OBSERVATION);
        assertThat(events.getFirst().getPayload().surfaced()).isFalse();
        assertThat(events.getFirst().getPayload().text()).isNotBlank();

        assertThat(appNotificationRepository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(
                owner, PageRequest.of(0, 10))).isEmpty();
    }

    /**
     * mezo-5543y, the holding row's budget guard. The cold-start fallback (see
     * {@code QuickNoticeServiceIT}) creates a plan-less row so an observation that resolved to
     * NOTHING can still be seen — so when the budget says it will NOT be seen, that row has no
     * reason to exist. Creating one anyway would litter the Minták screen with rows carrying an
     * invisible card, one per journal entry, for ever.
     */
    @Test
    void testOnSignal_shouldCreateNoHoldingRow_whenTheNoticeCannotBeSurfaced() {
        UUID owner = userPopulator.createUser().getId();
        String scripted = "[[NOTICE:{\"text\":\"Ma padlón volt a hangulatod.\","
                + "\"question\":\"Történt valami?\",\"hypothesisKey\":null,"
                + "\"newTestPlan\":null,\"evidenceRefs\":[]}]]";
        JournalEntryEntity entry = journalPopulator.createEntry(owner, TODAY,
                "Ma minden szörnyű volt. " + scripted, "quickinput");
        // mood=1, sure => EXTREME_MOOD: salient, but with no row anywhere to hang it on
        TextSignalEntity signal = textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL,
                entry.getId(), TODAY, 1, 2, 5, List.of(), List.of());

        quickNoticeService.onSignal(owner, signal.getId());

        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner))
                .isEmpty();
    }
}

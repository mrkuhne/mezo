package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.QuickNoticeService;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
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
 * The push switched OFF. This was S4's SILENT LAUNCH and the shipped default (mezo-eq85.4); since
 * mezo-eq85.5 the shipped default is {@code true} and this class pins the property explicitly, so
 * it keeps proving the OFF half of the switch. {@code notice.push-enabled=false} holds back the
 * {@code OBSERVATION_NEW} push only: the observation event is still appended and, crucially, still
 * carries {@code surfaced=true}, so the Észrevételek feed has real content either way.
 *
 * <p>This is the distinction {@link QuickNoticeBudgetOffIT} does NOT cover — there the budget
 * vetoes and the event is {@code surfaced=false}. Both halves have to be asserted here or the test
 * cannot tell the two silences apart. A separate class rather than a case inside
 * {@code QuickNoticeServiceIT} for the usual reason: it is bound config, so it needs its own
 * {@code @TestPropertySource} context (the {@code *SwitchOffIT} idiom).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.push-enabled=false",
        "mezo.companion.reflection.notice.quiet-from=23:59",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class QuickNoticePushOffIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    private static final TestPlanEnvelope ANNA_PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    @Autowired private QuickNoticeService quickNoticeService;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testOnSignal_shouldStillPersistASurfacedObservationButNotNotify_whenPushIsHeldBack() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, ANNA_PLAN, PatternEntity.STATUS_PROPOSED);
        JournalEntryEntity entry = journalPopulator.createEntry(owner, TODAY,
                "Ma Annával sétáltunk a Duna-parton, jólesett.", "quickinput");
        TextSignalEntity signal = textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL,
                entry.getId(), TODAY, 4, 3, 2, List.of("Anna"), List.of("kapcsolatok"));

        quickNoticeService.onSignal(owner, signal.getId());

        // half one: the collecting side is UNTOUCHED by the silent launch
        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId());
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().getKind()).isEqualTo(PatternEventEntity.KIND_OBSERVATION);
        assertThat(events.getFirst().getPayload().surfaced()).isTrue();
        assertThat(events.getFirst().getPayload().text()).isNotBlank();

        // half two: and nothing was pushed
        assertThat(appNotificationRepository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(
                owner, PageRequest.of(0, 10))).isEmpty();
    }
}

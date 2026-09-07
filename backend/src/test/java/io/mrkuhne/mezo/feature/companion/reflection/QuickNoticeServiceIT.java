package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
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
 * Reflexió S4 (mezo-eq85.4) Step 3: the quick notice end to end — pre-screen → LLM → observation
 * event → notification, over real {@code text_signal} / {@code pattern} rows and the fake LLM.
 *
 * <p>There is NO {@code java.time.Clock} bean in this application (confirmed by the S4 controller
 * scan), so the brief's clock-freezing option does not exist. The quiet window is therefore
 * neutralised to {@code [23:59, 00:00)} — a one-minute slot that only a run started in the last
 * minute of a day could hit — instead of letting the production default (22:00→07:00) decide
 * whether the assertions hold.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.quiet-from=23:59",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class QuickNoticeServiceIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    /** The open row the happy path touches: "the days I write about Anna are followed by sleep". */
    private static final TestPlanEnvelope ANNA_PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    @Autowired private QuickNoticeService quickNoticeService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testOnSignal_shouldAppendSurfacedObservationAndNotify_whenSignalTouchesAnOpenRow() {
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
        PatternEventEntity observation = events.getFirst();
        assertThat(observation.getKind()).isEqualTo(PatternEventEntity.KIND_OBSERVATION);
        assertThat(observation.getPayload().surfaced()).isTrue();
        assertThat(observation.getPayload().text()).isNotBlank();
        assertThat(observation.getPayload().evidenceRefs())
                .contains(TextSignalEntity.SOURCE_JOURNAL + ":" + entry.getId());

        List<AppNotificationEntity> feed = appNotificationRepository
                .findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, PageRequest.of(0, 10));
        assertThat(feed).hasSize(1);
        AppNotificationEntity notification = feed.getFirst();
        assertThat(notification.getKind()).isEqualTo(AppNotificationKind.OBSERVATION_NEW.key());
        assertThat(notification.getRefId()).isEqualTo(row.getId());
        assertThat(notification.getDedupKey()).isEqualTo("observation_new:" + observation.getId());

        // the LLM may only write the OBSERVATION — the row's own verdict columns stay untouched
        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(after.getBelief()).isNull();
    }

    /**
     * A scripted {@code newTestPlan} is the only way a quick notice may CREATE a row — and the row
     * it creates is a {@code proposed} {@code quick_notice} hypothesis the nightly pass will test,
     * never a verdict.
     */
    @Test
    void testOnSignal_shouldCreateQuickNoticeRow_whenTheAnswerCarriesAValidNewTestPlan() {
        UUID owner = userPopulator.createUser().getId();
        String scripted = "[[NOTICE:{\"text\":\"Négy napja a munka viszi el a napjaidat.\","
                + "\"question\":\"Figyeljem, hogy hat a hangulatodra?\",\"hypothesisKey\":null,"
                + "\"newTestPlan\":{\"seriesA\":\"topic:munka\",\"seriesB\":\"text-mood\","
                + "\"lagDays\":0,\"expectedDirection\":\"negative\"},\"evidenceRefs\":[]}]]";
        // the three preceding days build the streak; the fourth (today) carries the sentinel
        for (int daysBack = 3; daysBack >= 1; daysBack--) {
            LocalDate day = TODAY.minusDays(daysBack);
            JournalEntryEntity past = journalPopulator.createEntry(owner, day, "Megint a munka.", "quickinput");
            textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, past.getId(), day,
                    3, 3, 3, List.of(), List.of("munka"));
        }
        JournalEntryEntity entry = journalPopulator.createEntry(owner, TODAY,
                "Ma is csak a munka volt. " + scripted, "quickinput");
        TextSignalEntity signal = textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL,
                entry.getId(), TODAY, 3, 3, 3, List.of(), List.of("munka"));

        quickNoticeService.onSignal(owner, signal.getId());

        List<PatternEntity> rows = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
        assertThat(rows).hasSize(1);
        PatternEntity created = rows.getFirst();
        assertThat(created.getOrigin()).isEqualTo(PatternEntity.ORIGIN_QUICK_NOTICE);
        assertThat(created.getKind()).isEqualTo(PatternEntity.KIND_REFLECTION);
        assertThat(created.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(created.getCategory()).isEqualTo("trigger");
        assertThat(created.getTestPlan()).isNotNull();
        assertThat(created.getTestPlan().seriesA()).isEqualTo("topic:munka");
        assertThat(created.getTestPlan().seriesB()).isEqualTo("text-mood");
        assertThat(created.getTestPlan().expectedDirection())
                .isEqualTo(TestPlanEnvelope.DIRECTION_NEGATIVE);
        assertThat(created.getBelief()).isNull();

        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, created.getId());
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().getKind()).isEqualTo(PatternEventEntity.KIND_OBSERVATION);
        assertThat(events.getFirst().getPayload().text())
                .contains("Négy napja a munka viszi el a napjaidat.");
    }
}

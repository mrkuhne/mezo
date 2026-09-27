package io.mrkuhne.mezo.feature.character.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.KeywordsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionHitEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionHitRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatExceptionService;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReads;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Emlékezet S7 Task 7 (mezo-d6ivw.7): a remembered exception at the rule's next raise — a day
 * whose notes name it records a silent hit and opens nothing; otherwise a no-push "ma is ez volt?"
 * question (EXCUSE); the occurrence after {@code exception-review-hits} hits inside the window is a
 * one-time review (REVIEW). Plus the one-tap answers and the remembered chip's undo. No
 * class-level {@code @Transactional}: {@code open} commits its own steps, and the undo test runs
 * the real async reply pipeline.
 */
@ActiveProfiles("companion-fake")
class TeamChatExceptionIT extends AbstractIntegrationTest {

    private static final String MECCS = FakeCompanionLlm.teamChatReplyScript(
            "{\"reply\":\"Értem, meccsnap volt — ez teljesen rendben van.\",\"verdict\":\"concrete_context\","
            + "\"contextTag\":\"meccsnap\",\"factText\":\"Meccsnapokon későn eszel — ez rendben van.\","
            + "\"keywords\":[\"meccs\",\"kupa\"]}");

    @Autowired private TeamChatService service;
    @Autowired private TeamChatExceptionService exceptionService;
    @Autowired private TeamChatReads reads;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private TeamChatExceptionRepository exceptions;
    @Autowired private TeamChatExceptionHitRepository hits;
    @Autowired private KnowledgeFactRepository knowledgeFacts;
    @Autowired private KnowledgeFactService knowledge;
    @Autowired private AppNotificationRepository appNotifications;
    @Autowired private TeamChatProperties properties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private UUID owner() {
        return userPopulator.createUser().getId();
    }

    private ZoneId zone() {
        return properties.zone();
    }

    private LocalDate today() {
        return LocalDate.now(zone());
    }

    private Instant todayAt(int hour, int minute) {
        return today().atTime(hour, minute).atZone(zone()).toInstant();
    }

    private void raiseLateEatingLog(UUID owner) {
        flagLogPopulator.raise(owner, FlagKey.LATE_EATING, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(
                        90, 21.5, 2, 3, 23.0, 2, Map.of(), Map.of())));
    }

    /** An active late_eating exception with a real team_chat knowledge fact behind it. */
    private TeamChatExceptionEntity activeException(UUID owner, String factText, List<String> keywords) {
        UUID factId = knowledge.captureFromTeamChat(owner, factText, "falat", null, null);
        TeamChatExceptionEntity e = new TeamChatExceptionEntity();
        e.setCreatedBy(owner);
        e.setFlagKey(FlagKey.LATE_EATING);
        e.setOwnerCharacter("falat");
        e.setContextTag("meccsnap");
        e.setNormalizedTag("meccsnap");
        e.setFactText(factText);
        e.setKeywords(new KeywordsEnvelope(keywords));
        e.setKnowledgeFactId(factId);
        e.setActive(true);
        e.setWindowStartedAt(today().minusDays(60).atStartOfDay(zone()).toInstant());
        return exceptions.saveAndFlush(e);
    }

    private TeamChatExceptionEntity activeException(UUID owner) {
        return activeException(owner, "Meccsnapokon későn eszel — ez rendben van.", List.of("meccs", "kupa"));
    }

    private void seedHit(UUID owner, UUID exceptionId, LocalDate day) {
        TeamChatExceptionHitEntity h = new TeamChatExceptionHitEntity();
        h.setCreatedBy(owner);
        h.setExceptionId(exceptionId);
        h.setHitOn(day);
        h.setSource("NOTES");
        hits.saveAndFlush(h);
    }

    private List<TeamChatThreadEntity> threadsOf(UUID owner) {
        return threads.findByCreatedByAndOpenedAtBetweenAndDeletedFalse(
                owner, Instant.now().minus(30, ChronoUnit.DAYS), Instant.now().plus(2, ChronoUnit.DAYS));
    }

    private List<TeamChatLineEntity> linesOf(UUID threadId) {
        return lines.findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(threadId);
    }

    /** The ügy's one REPLY line (the offer's open may be stamped later than the tap's "now"). */
    private TeamChatLineEntity replyOf(UUID threadId) {
        List<TeamChatLineEntity> replies = linesOf(threadId).stream().filter(l -> "REPLY".equals(l.getKind())).toList();
        assertThat(replies).hasSize(1);
        return replies.getFirst();
    }

    private TeamChatThreadEntity reread(UUID threadId) {
        return threads.findById(threadId).orElseThrow();
    }

    private List<AppNotificationEntity> teamChatPushes(UUID owner) {
        return appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner).stream()
                .filter(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .toList();
    }

    /** Moves a thread's open out of the library entry's cooldown, so the rule can open again today. */
    private void backdate(TeamChatThreadEntity thread) {
        TeamChatThreadEntity t = reread(thread.getId());
        t.setOpenedAt(t.getOpenedAt().minus(3, ChronoUnit.DAYS));
        threads.saveAndFlush(t);
    }

    private boolean factInPrompt(UUID owner, UUID factId) {
        return knowledgeFacts.findByIdAndCreatedByAndDeletedFalse(factId, owner).orElseThrow().isIncludeInPrompt();
    }

    private static HttpStatus statusOf(Throwable t) {
        return ((SystemRuntimeErrorException) t).getStatus();
    }

    @Test
    void keywordInTodaysCheckInNote_silentHit_noThread_noPush() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        checkInPopulator.createCheckIn(owner, today(), "20:00", 3, 3, "Este meccs volt, későn vacsiztam");
        raiseLateEatingLog(owner);

        assertThat(service.open(owner, FlagKey.LATE_EATING, todayAt(20, 0))).isEmpty();

        assertThat(threadsOf(owner)).isEmpty();
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today())).isEqualTo(1);
        assertThat(teamChatPushes(owner)).isEmpty();
        // idempotent: a second open the same day (catch-up sweep) records no second hit and opens nothing
        assertThat(service.open(owner, FlagKey.LATE_EATING, todayAt(20, 30))).isEmpty();
        assertThat(threadsOf(owner)).isEmpty();
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(1)))
                .isEqualTo(1);
    }

    @Test
    void noKeywordToday_opensAnExcuseOffer_silently() {
        UUID owner = owner();
        // The malformed marker forces the voice onto the template path, so the OPEN line IS the template.
        TeamChatExceptionEntity ex = activeException(owner,
                "Meccsnapokon későn eszel " + FakeCompanionLlm.TEAM_CHAT_MALFORMED, List.of("meccs"));
        checkInPopulator.createCheckIn(owner, today(), "12:00", 3, 3, "Semmi különös ma.");
        raiseLateEatingLog(owner);

        TeamChatThreadEntity opened = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        TeamChatThreadEntity t = reread(opened.getId());
        assertThat(threadsOf(owner)).singleElement().extracting(TeamChatThreadEntity::getId).isEqualTo(t.getId());
        assertThat(t.getStatus()).isEqualTo("OPEN");
        assertThat(t.getOffer()).isEqualTo("EXCUSE");
        assertThat(t.getExceptionId()).isEqualTo(ex.getId());
        assertThat(t.getPushed()).isNotEqualTo(Boolean.TRUE);
        assertThat(teamChatPushes(owner)).isEmpty();
        TeamChatLineEntity open = linesOf(t.getId()).getFirst();
        assertThat(open.getKind()).isEqualTo("OPEN");
        assertThat(open.getVoiced()).isFalse();
        assertThat(open.getBody())
                .isEqualTo("Tudom, hogy meccsnapokon későn eszel " + FakeCompanionLlm.TEAM_CHAT_MALFORMED
                        + ". Ma is ez volt a helyzet?")
                .contains(ex.getContextTag());
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(60)))
                .isZero();
    }

    @Test
    void fourHitsInWindow_nextOccurrenceIsAReview_onlyOncePerWindow() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d * 3L));
        }
        raiseLateEatingLog(owner);

        TeamChatThreadEntity review = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThat(review.getOffer()).isEqualTo("REVIEW");
        assertThat(review.getExceptionId()).isEqualTo(ex.getId());
        assertThat(teamChatPushes(owner)).isEmpty();
        TeamChatLineEntity open = linesOf(review.getId()).getFirst();
        // The REVIEW template joins the facts, so its count passes the voice guard.
        assertThat(open.getFacts().facts()).contains("Az utóbbi időben " + properties.exceptionReviewHits()
                + " alkalommal jött elő ez a kivétel: meccsnap. Ez még rendben van így?");

        Instant beforeKeep = Instant.now();
        TeamChatThreadEntity kept = exceptionService.answer(owner, review.getId(), "KEEP");

        assertThat(kept.getStatus()).isEqualTo("RESOLVED");
        assertThat(kept.getCloseReason()).isEqualTo("EXCUSED");
        assertThat(kept.getCloseNote()).isEqualTo("meccsnap");
        assertThat(replyOf(review.getId())).satisfies(l -> {
            assertThat(l.getKind()).isEqualTo("REPLY");
            assertThat(l.getCharacter()).isEqualTo("falat");
            assertThat(l.getVoiced()).isFalse();
            assertThat(l.getBody()).isEqualTo("Rendben, akkor marad így — tovább figyelek.");
        });
        TeamChatExceptionEntity restarted = exceptions.findById(ex.getId()).orElseThrow();
        assertThat(restarted.getActive()).isTrue();
        assertThat(restarted.getWindowStartedAt()).isAfterOrEqualTo(beforeKeep.minusSeconds(1))
                .isBeforeOrEqualTo(Instant.now());

        // The window restarted: the next occurrence the same day is a plain excuse question again.
        backdate(review);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity again = service.open(owner, FlagKey.LATE_EATING, todayAt(13, 0)).orElseThrow();
        assertThat(again.getOffer()).isEqualTo("EXCUSE");
        assertThat(again.getExceptionId()).isEqualTo(ex.getId());
    }

    @Test
    void hitsOlderThanTheWindow_doNotCount() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        // floor = day − (window − 1): the window's day count back is already outside it.
        for (int d = 0; d < properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(properties.exceptionWindowDays() + d));
        }
        raiseLateEatingLog(owner);

        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThat(t.getOffer()).isEqualTo("EXCUSE");
    }

    @Test
    void hitAtExactlyTheWindowFloor_counts() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        // floor = day − (window − 1): a hit ON the floor day is inside the window.
        seedHit(owner, ex.getId(), today().minusDays(properties.exceptionWindowDays() - 1L));
        for (int d = 1; d < properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        raiseLateEatingLog(owner);

        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThat(t.getOffer()).isEqualTo("REVIEW");
    }

    @Test
    void reviewAlreadyOpenedThisWindow_closedByDataUnanswered_nextOccurrenceIsAnExcuse() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        raiseLateEatingLog(owner);
        TeamChatThreadEntity review = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        assertThat(review.getOffer()).isEqualTo("REVIEW");
        service.resolve(owner, FlagKey.LATE_EATING,
                new FlagVerdict.ClearEvidence("late_days", 0.0, 2.0, null), todayAt(12, 10));
        assertThat(reread(review.getId()).getCloseReason()).isEqualTo("DATA");

        backdate(review);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity next = service.open(owner, FlagKey.LATE_EATING, todayAt(13, 0)).orElseThrow();

        assertThat(next.getOffer()).isEqualTo("EXCUSE");
        assertThat(next.getExceptionId()).isEqualTo(ex.getId());
    }

    @Test
    void answerExcused_afterMidnight_recordsTheHitOnTheOccurrencesDay() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        LocalDate yesterday = today().minusDays(1);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING,
                yesterday.atTime(23, 30).atZone(zone()).toInstant()).orElseThrow();
        assertThat(t.getOffer()).isEqualTo("EXCUSE");

        exceptionService.answer(owner, t.getId(), "EXCUSED");

        assertThat(hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(ex.getId(), t.getId(), "TAP"))
                .get().extracting(TeamChatExceptionHitEntity::getHitOn).isEqualTo(yesterday);
        assertThat(hits.existsByExceptionIdAndHitOnAndDeletedFalse(ex.getId(), today())).isFalse();
    }

    @Test
    void answerOnAnOfferWhoseExceptionWasWithdrawn_is409_noHit() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        TeamChatExceptionEntity withdrawn = exceptions.findById(ex.getId()).orElseThrow();
        withdrawn.setActive(false);
        exceptions.saveAndFlush(withdrawn);

        assertThatThrownBy(() -> exceptionService.answer(owner, t.getId(), "EXCUSED"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));

        assertThat(reread(t.getId()).getStatus()).isEqualTo("OPEN");
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(60)))
                .isZero();
    }

    @Test
    void answerExcused_closesExcused_withTapHit() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        TeamChatThreadEntity answered = exceptionService.answer(owner, t.getId(), "EXCUSED");

        assertThat(answered.getStatus()).isEqualTo("RESOLVED");
        assertThat(answered.getCloseReason()).isEqualTo("EXCUSED");
        assertThat(answered.getCloseNote()).isEqualTo("meccsnap");
        assertThat(answered.getClosedAt()).isNotNull();
        TeamChatExceptionHitEntity hit = hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(
                ex.getId(), t.getId(), "TAP").orElseThrow();
        assertThat(hit.getHitOn()).isEqualTo(today());
        assertThat(replyOf(t.getId())).satisfies(l -> {
            assertThat(l.getKind()).isEqualTo("REPLY");
            assertThat(l.getBody()).isEqualTo("Rendben, akkor ez most is kivétel volt.");
            assertThat(l.getVoiced()).isFalse();
        });
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isTrue();
    }

    @Test
    void answerStop_onReview_deactivatesMutesAndCloses() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        raiseLateEatingLog(owner);
        TeamChatThreadEntity review = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        assertThat(review.getOffer()).isEqualTo("REVIEW");

        TeamChatThreadEntity stopped = exceptionService.answer(owner, review.getId(), "STOP");

        assertThat(stopped.getStatus()).isEqualTo("RESOLVED");
        assertThat(stopped.getCloseReason()).isEqualTo("REPLY");
        assertThat(stopped.getCloseNote()).isEqualTo("kivétel kikapcsolva");
        assertThat(replyOf(review.getId()).getBody()).isEqualTo("Rendben, akkor újra szólok, ha előjön.");
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isFalse();
        assertThat(factInPrompt(owner, ex.getKnowledgeFactId())).isFalse();

        // The next raise is a normal ügy again — no offer, and it pages the user like any other.
        backdate(review);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity normal = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 30)).orElseThrow();
        assertThat(normal.getOffer()).isNull();
        assertThat(normal.getExceptionId()).isNull();
        assertThat(reread(normal.getId()).getPushed()).isTrue();
        assertThat(teamChatPushes(owner)).singleElement()
                .extracting(AppNotificationEntity::getRefId).isEqualTo(normal.getId());
    }

    @Test
    void answerWrongChoiceForOffer_is409_andIdempotentRepeat_isNoop() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThatThrownBy(() -> exceptionService.answer(owner, t.getId(), "KEEP"))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
        assertThat(reread(t.getId()).getStatus()).isEqualTo("OPEN");

        exceptionService.answer(owner, t.getId(), "EXCUSED");
        TeamChatThreadEntity again = exceptionService.answer(owner, t.getId(), "EXCUSED");

        assertThat(again.getStatus()).isEqualTo("RESOLVED");
        assertThat(again.getCloseReason()).isEqualTo("EXCUSED");
        assertThat(linesOf(t.getId())).filteredOn(l -> "REPLY".equals(l.getKind())).hasSize(1);
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(60)))
                .isEqualTo(1);
        // A mismatched choice on the closed ügy is still a 409, and a foreign user gets a 404.
        assertThatThrownBy(() -> exceptionService.answer(owner, t.getId(), "STOP"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> exceptionService.answer(owner(), t.getId(), "EXCUSED"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void answerOnAnUnofferedUgy_is409() {
        UUID owner = owner();
        raiseLateEatingLog(owner);
        TeamChatThreadEntity plain = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        assertThat(plain.getOffer()).isNull();

        assertThatThrownBy(() -> exceptionService.answer(owner, plain.getId(), "EXCUSED"))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
    }

    /** An OPEN late_eating ügy plus its OPEN line, seeded directly (the TeamChatReplyIT fixture). */
    private TeamChatThreadEntity openLateEating(UUID owner) {
        Instant dayStart = today().atStartOfDay(zone()).toInstant();
        Instant hourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        Instant openedAt = hourAgo.isAfter(dayStart) ? hourAgo : dayStart;
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(FlagKey.LATE_EATING);
        t.setOwnerCharacter("falat");
        t.setGuestCharacter("szunya");
        t.setAdviceKey("late_eating_test");
        t.setStatus("OPEN");
        t.setOpenedAt(openedAt);
        t.setPushed(false);
        t.setActions(new TeamChatActionsEnvelope(List.of()));
        TeamChatThreadEntity saved = threads.saveAndFlush(t);
        TeamChatLineEntity l = new TeamChatLineEntity();
        l.setCreatedBy(owner);
        l.setThreadId(saved.getId());
        l.setKind("OPEN");
        l.setCharacter("falat");
        l.setBody("Késő este ettél.");
        l.setVoiced(true);
        l.setFacts(new EditionFactsEnvelope(List.of("21:40")));
        l.setOccurredAt(openedAt);
        lines.saveAndFlush(l);
        return saved;
    }

    /** Task 6: a concrete reply closes the ügy as REPLY and remembers the exception. */
    private TeamChatExceptionEntity concreteClose(UUID owner, TeamChatThreadEntity t) {
        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(reread(t.getId()).getCloseReason()).isEqualTo("REPLY"));
        return exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner).orElseThrow();
    }

    @Test
    void undo_reopens_mutes_vetoes_andBlocksRecapture() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);
        TeamChatExceptionEntity ex = concreteClose(owner, t);
        assertThat(hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(ex.getId(), t.getId(), "REPLY"))
                .isPresent();

        TeamChatThreadEntity undone = exceptionService.undoRemembered(owner, t.getId());

        assertThat(undone.getStatus()).isEqualTo("OPEN");
        assertThat(undone.getClosedAt()).isNull();
        assertThat(undone.getCloseReason()).isNull();
        assertThat(undone.getCloseNote()).isNull();
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isFalse();
        assertThat(factInPrompt(owner, ex.getKnowledgeFactId())).isFalse();
        assertThat(hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(ex.getId(), t.getId(), "REPLY"))
                .isEmpty();

        // idempotent: a second undo changes nothing
        TeamChatThreadEntity again = exceptionService.undoRemembered(owner, t.getId());
        assertThat(again.getStatus()).isEqualTo("OPEN");

        // the veto: the same explanation again is answered, but never re-captured or closed
        service.reply(owner, t.getId(), "Megint a kupa miatt " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .filteredOn(l -> "REPLY".equals(l.getKind())).hasSize(2));
        assertThat(reread(t.getId()).getStatus()).isEqualTo("OPEN");
        assertThat(exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
                owner, FlagKey.LATE_EATING)).isEmpty();
        assertThat(knowledgeFacts.findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_TEAM_CHAT))
                .hasSize(1);
    }

    @Test
    void undo_withANewerOpenThreadForTheRule_staysClosed_butWithdrawsKnowledge() {
        UUID owner = owner();
        TeamChatThreadEntity first = openLateEating(owner);
        TeamChatExceptionEntity ex = concreteClose(owner, first);
        TeamChatThreadEntity newer = openLateEating(owner);

        TeamChatThreadEntity undone = exceptionService.undoRemembered(owner, first.getId());

        assertThat(undone.getStatus()).isEqualTo("RESOLVED");
        assertThat(undone.getCloseReason()).isEqualTo("REPLY");
        assertThat(reread(newer.getId()).getStatus()).isEqualTo("OPEN");
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isFalse();
        assertThat(factInPrompt(owner, ex.getKnowledgeFactId())).isFalse();
    }

    @Test
    void undo_onAnUgyWithoutARememberedException_is404() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);

        assertThatThrownBy(() -> exceptionService.undoRemembered(owner, t.getId()))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---- S7 final review fix wave -------------------------------------------------------------

    /** A REVIEW ügy for {@code ex}, seeded directly: never answered, closed by DATA. */
    private TeamChatThreadEntity ignoredReview(UUID owner, TeamChatExceptionEntity ex, Instant openedAt) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(FlagKey.LATE_EATING);
        t.setOwnerCharacter("falat");
        t.setAdviceKey("late_eating_test");
        t.setStatus("RESOLVED");
        t.setOpenedAt(openedAt);
        t.setClosedAt(openedAt.plus(2, ChronoUnit.HOURS));
        t.setCloseReason("DATA");
        t.setPushed(false);
        t.setOffer("REVIEW");
        t.setExceptionId(ex.getId());
        t.setActions(new TeamChatActionsEnvelope(List.of()));
        return threads.saveAndFlush(t);
    }

    /** Item 5: an ignored review only suppresses reviews inside its OWN rolling window. */
    @Test
    void ignoredReviewBeforeTheRollingFloor_doesNotSilenceTheNextReview() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner); // windowStartedAt = 60 days ago, never KEPT
        // The ignored review sits one day before today's floor (day − (window − 1)).
        ignoredReview(owner, ex, today().minusDays(properties.exceptionWindowDays())
                .atTime(12, 0).atZone(zone()).toInstant());
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        raiseLateEatingLog(owner);

        TeamChatThreadEntity next = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThat(next.getOffer()).isEqualTo("REVIEW");
        assertThat(next.getExceptionId()).isEqualTo(ex.getId());
    }

    /** Item 5, the other edge: an ignored review ON the floor day still counts for this window. */
    @Test
    void ignoredReviewOnTheRollingFloorDay_stillCountsForThisWindow() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        ignoredReview(owner, ex, today().minusDays(properties.exceptionWindowDays() - 1L)
                .atStartOfDay(zone()).toInstant());
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        raiseLateEatingLog(owner);

        assertThat(service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow().getOffer())
                .isEqualTo("EXCUSE");
    }

    /** Item 6: the exception follows its fact — muted in the Tudástár → the rule nudges as normal. */
    @Test
    void factMutedInTheTudastar_exceptionIsSkipped_notMutated() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        checkInPopulator.createCheckIn(owner, today(), "20:00", 3, 3, "Este meccs volt, későn vacsiztam");
        knowledge.update(owner, ex.getKnowledgeFactId(),
                new io.mrkuhne.mezo.api.dto.UpdateFactRequest().includeInPrompt(false));
        raiseLateEatingLog(owner);

        TeamChatThreadEntity normal = service.open(owner, FlagKey.LATE_EATING, todayAt(20, 0)).orElseThrow();

        assertThat(normal.getOffer()).isNull();
        assertThat(normal.getExceptionId()).isNull();
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(60)))
                .isZero();
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isTrue(); // skipped, not mutated

        // Turned back on: the exception is live again (the keyword day → a silent hit, nothing opens).
        backdate(normal);
        threads.findById(normal.getId()).ifPresent(t -> {
            t.setStatus("RESOLVED");
            t.setClosedAt(Instant.now());
            t.setCloseReason("DATA");
            threads.saveAndFlush(t);
        });
        knowledge.update(owner, ex.getKnowledgeFactId(),
                new io.mrkuhne.mezo.api.dto.UpdateFactRequest().includeInPrompt(true));
        raiseLateEatingLog(owner);
        assertThat(service.open(owner, FlagKey.LATE_EATING, todayAt(20, 30))).isEmpty();
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today())).isEqualTo(1);
    }

    /** Item 6: a deleted fact silences its exception the same way. */
    @Test
    void factDeleted_exceptionIsSkipped() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        KnowledgeFactEntity fact = knowledgeFacts.findById(ex.getKnowledgeFactId()).orElseThrow();
        fact.setDeleted(true);
        knowledgeFacts.saveAndFlush(fact);
        raiseLateEatingLog(owner);

        TeamChatThreadEntity normal = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();

        assertThat(normal.getOffer()).isNull();
        assertThat(exceptions.findById(ex.getId()).orElseThrow().getActive()).isTrue();
    }

    /** Item 10: a free-text "igen, meccs volt" on a live EXCUSE offer is the tap — hit on the
     *  occurrence's own day. */
    @Test
    void freeTextExcuse_onALiveOffer_closesExcused_hitOnTheOpenedDay() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        LocalDate yesterday = today().minusDays(1);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING,
                yesterday.atTime(23, 30).atZone(zone()).toInstant()).orElseThrow();
        assertThat(t.getOffer()).isEqualTo("EXCUSE");

        service.reply(owner, t.getId(), "Igen, kupa volt " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(reread(t.getId()).getCloseReason()).isEqualTo("EXCUSED"));

        assertThat(hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(ex.getId(), t.getId(), "TAP"))
                .get().extracting(TeamChatExceptionHitEntity::getHitOn).isEqualTo(yesterday);
        assertThat(hits.existsByExceptionIdAndHitOnAndDeletedFalse(ex.getId(), today())).isFalse();
    }

    /** Item 10: once the offer's exception is withdrawn, the same free text only gets an answer. */
    @Test
    void freeTextExcuse_onAWithdrawnOffer_onlyAnswers_noHit_noClose() {
        UUID owner = owner();
        TeamChatExceptionEntity ex = activeException(owner);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity t = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        TeamChatExceptionEntity withdrawn = exceptions.findById(ex.getId()).orElseThrow();
        withdrawn.setActive(false);
        exceptions.saveAndFlush(withdrawn);

        service.reply(owner, t.getId(), "Igen, kupa volt " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .filteredOn(l -> "REPLY".equals(l.getKind())).hasSize(1));

        assertThat(reread(t.getId()).getStatus()).isEqualTo("OPEN");
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(60)))
                .isZero();
    }

    /** Item 2 (server side): a STOP on a later REVIEW is not an undo — the source ügy's
     *  remembered block disappears; a real undo keeps it (inactive) for the confirmation. */
    @Test
    void stopOnAReview_dropsTheSourceUgysRemembered_whileAnUndoKeepsIt() {
        UUID owner = owner();
        TeamChatThreadEntity source = openLateEating(owner);
        TeamChatExceptionEntity ex = concreteClose(owner, source);
        assertThat(reads.thread(owner, reread(source.getId())).getRemembered()).isNotNull()
                .satisfies(r -> assertThat(r.getActive()).isTrue());
        // The exception's window started at capture (today); move it back so seeded hits count.
        TeamChatExceptionEntity aged = exceptions.findById(ex.getId()).orElseThrow();
        aged.setWindowStartedAt(today().minusDays(60).atStartOfDay(zone()).toInstant());
        exceptions.saveAndFlush(aged);
        for (int d = 1; d <= properties.exceptionReviewHits(); d++) {
            seedHit(owner, ex.getId(), today().minusDays(d));
        }
        backdate(source);
        raiseLateEatingLog(owner);
        TeamChatThreadEntity review = service.open(owner, FlagKey.LATE_EATING, todayAt(12, 0)).orElseThrow();
        assertThat(review.getOffer()).isEqualTo("REVIEW");

        exceptionService.answer(owner, review.getId(), "STOP");

        assertThat(reads.thread(owner, reread(source.getId())).getRemembered()).isNull();
        assertThat(reads.day(owner, today()).getLines()).filteredOn(l -> l.getThread() != null
                && source.getId().equals(l.getThread().getId())).allSatisfy(l ->
                        assertThat(l.getThread().getRemembered()).isNull());

        // Contrast: a plain undo on another ügy keeps its (now inactive) remembered block.
        UUID other = owner();
        TeamChatThreadEntity t = openLateEating(other);
        concreteClose(other, t);
        exceptionService.undoRemembered(other, t.getId());
        assertThat(reads.thread(other, reread(t.getId())).getRemembered()).isNotNull()
                .satisfies(r -> assertThat(r.getActive()).isFalse());
    }
}

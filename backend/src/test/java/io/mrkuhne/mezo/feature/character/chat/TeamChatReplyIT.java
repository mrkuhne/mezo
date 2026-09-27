package io.mrkuhne.mezo.feature.character.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionHitEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionHitRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Emlékezet S7 Task 6 (mezo-d6ivw.7): the reply pipeline — the user's USER line publishes an
 * event, the async listener (after a short debounce) lets the owner character answer every
 * unanswered USER line of the ügy with ONE REPLY line, and a concrete explanation closes the ügy
 * ({@code closeReason=REPLY}) and is remembered as an exception + a {@code team_chat} knowledge
 * fact. No class-level {@code @Transactional}: the AFTER_COMMIT listener needs real commits.
 */
@ActiveProfiles("companion-fake")
class TeamChatReplyIT extends AbstractIntegrationTest {

    private static final String MECCS = FakeCompanionLlm.teamChatReplyScript(
            "{\"reply\":\"Értem, meccsnap volt — ez teljesen rendben van.\",\"verdict\":\"concrete_context\","
            + "\"contextTag\":\"meccsnap\",\"factText\":\"Meccsnapokon későn eszel — ez rendben van.\","
            + "\"keywords\":[\"meccs\",\"kupa\"]}");

    @Autowired private TeamChatService service;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private TeamChatExceptionRepository exceptions;
    @Autowired private TeamChatExceptionHitRepository hits;
    @Autowired private KnowledgeFactRepository knowledge;
    @Autowired private AppNotificationRepository appNotifications;
    @Autowired private TeamChatProperties properties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @MockitoSpyBean private TeamChatReplyVoiceWriter replyVoiceWriter;

    /** Whether a transaction was active at the moment of each reply voice call. */
    private final List<Boolean> txActiveAtReplyVoice = new CopyOnWriteArrayList<>();

    @BeforeEach
    void recordTransactionStateAtEveryReplyVoiceCall() {
        txActiveAtReplyVoice.clear();
        doAnswer(invocation -> {
            txActiveAtReplyVoice.add(TransactionSynchronizationManager.isActualTransactionActive());
            return invocation.callRealMethod();
        }).when(replyVoiceWriter).write(any(UUID.class), any(TeamChatThreadEntity.class), anyList(), anyList(), any());
    }

    private UUID owner() {
        return userPopulator.createUser().getId();
    }

    private LocalDate today() {
        return LocalDate.now(properties.zone());
    }

    /** Earlier today in the team chat's zone and never in the future: an hour ago, clamped to the
     *  local day's start — seeded lines must sort BEFORE the USER line {@code reply} writes now. */
    private Instant earlierToday() {
        Instant dayStart = today().atStartOfDay(properties.zone()).toInstant();
        Instant hourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        return hourAgo.isAfter(dayStart) ? hourAgo : dayStart;
    }

    /** An OPEN late_eating ügy (owner falat, guest szunya) plus its OPEN line, seeded directly. */
    private TeamChatThreadEntity openLateEating(UUID owner) {
        Instant openedAt = earlierToday();
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
        line(owner, saved.getId(), "OPEN", "falat", "Késő este ettél.", true, openedAt);
        return saved;
    }

    private TeamChatLineEntity line(UUID owner, UUID threadId, String kind, String character, String body,
            boolean voiced, Instant occurredAt) {
        TeamChatLineEntity l = new TeamChatLineEntity();
        l.setCreatedBy(owner);
        l.setThreadId(threadId);
        l.setKind(kind);
        l.setCharacter(character);
        l.setBody(body);
        l.setVoiced(voiced);
        l.setFacts(new EditionFactsEnvelope(List.of("21:40")));
        l.setOccurredAt(occurredAt);
        return lines.saveAndFlush(l);
    }

    private List<TeamChatLineEntity> linesOf(UUID threadId) {
        return lines.findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(threadId);
    }

    private List<AppNotificationEntity> teamChatPushes(UUID owner) {
        return appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner).stream()
                .filter(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .toList();
    }

    private List<KnowledgeFactEntity> teamChatFacts(UUID owner) {
        return knowledge.findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_TEAM_CHAT);
    }

    @Test
    void concreteReply_answers_closesAsReply_remembers_andNeverPushes() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);

        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .extracting(TeamChatLineEntity::getKind).containsExactly("OPEN", "USER", "REPLY"));
        TeamChatLineEntity reply = linesOf(t.getId()).get(2);
        assertThat(reply.getCharacter()).isEqualTo("falat");
        assertThat(reply.getVoiced()).isTrue();
        assertThat(reply.getBody()).isEqualTo("Értem, meccsnap volt — ez teljesen rendben van.");
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(threads.findById(t.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED"));
        TeamChatThreadEntity closed = threads.findById(t.getId()).orElseThrow();
        assertThat(closed.getCloseReason()).isEqualTo("REPLY");
        assertThat(closed.getCloseNote()).isEqualTo("meccsnap");
        assertThat(closed.getClosedAt()).isNotNull();
        TeamChatExceptionEntity ex =
                exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner).orElseThrow();
        assertThat(ex.getActive()).isTrue();
        assertThat(ex.getFlagKey()).isEqualTo(FlagKey.LATE_EATING);
        assertThat(ex.getNormalizedTag()).isEqualTo("meccsnap");
        assertThat(ex.getFactText()).isEqualTo("Meccsnapokon későn eszel — ez rendben van.");
        assertThat(ex.getKeywords().keywords()).containsExactly("meccs", "kupa");
        assertThat(ex.getSourceLineId()).isEqualTo(linesOf(t.getId()).get(1).getId());
        assertThat(knowledge.findByIdAndCreatedByAndDeletedFalse(ex.getKnowledgeFactId(), owner)).get()
                .extracting(KnowledgeFactEntity::getSource).isEqualTo("team_chat");
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(1)))
                .isEqualTo(1);
        assertThat(teamChatPushes(owner)).isEmpty();
    }

    @Test
    void moodReply_answersButStaysOpen_andRemembersNothing() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);

        service.reply(owner, t.getId(), "Egyszerűen nem volt kedvem korábban enni.");

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .extracting(TeamChatLineEntity::getKind).containsExactly("OPEN", "USER", "REPLY"));
        TeamChatLineEntity reply = linesOf(t.getId()).get(2);
        assertThat(reply.getBody()).isEqualTo(FakeCompanionLlm.TEAM_CHAT_REPLY_BODY);
        assertThat(reply.getVoiced()).isTrue();
        TeamChatThreadEntity still = threads.findById(t.getId()).orElseThrow();
        assertThat(still.getStatus()).isEqualTo("OPEN");
        assertThat(still.getCloseReason()).isNull();
        assertThat(exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner)).isEmpty();
        assertThat(teamChatFacts(owner)).isEmpty();
        assertThat(teamChatPushes(owner)).isEmpty();
    }

    @Test
    void burstOfThreeUserLines_getsOneReply() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);

        // Three replies well inside the debounce: the first two events find a newer USER line and
        // step back, the third answers the whole burst.
        service.reply(owner, t.getId(), "Ma későn értem haza.");
        service.reply(owner, t.getId(), "Dugó volt.");
        service.reply(owner, t.getId(), "Holnap jobb lesz.");

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .extracting(TeamChatLineEntity::getKind)
                .containsExactly("OPEN", "USER", "USER", "USER", "REPLY"));
        // Let every listener of the burst finish before the final count.
        await().pollDelay(properties.replyDebounceMillis() + 500L, java.util.concurrent.TimeUnit.MILLISECONDS)
                .atMost(10, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                        .filteredOn(l -> "REPLY".equals(l.getKind())).hasSize(1));
        assertThat(txActiveAtReplyVoice).hasSize(1);
    }

    @Test
    void voicedCapPerThreadDay_thenTemplate_neverCloses() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);
        Instant base = earlierToday();
        for (int i = 1; i <= properties.replyVoicedPerThreadDay(); i++) {
            line(owner, t.getId(), "REPLY", "falat", "Korábbi válasz " + i + ".", true, base.plusSeconds(i));
        }

        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .filteredOn(l -> "REPLY".equals(l.getKind()))
                .hasSize(properties.replyVoicedPerThreadDay() + 1));
        TeamChatLineEntity last = linesOf(t.getId()).getLast();
        assertThat(last.getKind()).isEqualTo("REPLY");
        assertThat(last.getVoiced()).isFalse();
        assertThat(last.getBody()).isEqualTo(TeamChatReplyVoiceWriter.templateFor(
                io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter.FALAT));
        assertThat(txActiveAtReplyVoice).isEmpty();
        TeamChatThreadEntity still = threads.findById(t.getId()).orElseThrow();
        assertThat(still.getStatus()).isEqualTo("OPEN");
        assertThat(still.getCloseReason()).isNull();
        assertThat(exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner)).isEmpty();
    }

    @Test
    void replyLines_doNotEatTheDailyLineCap() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);
        Instant base = earlierToday();
        for (int i = 1; i <= properties.dailyLineCap(); i++) {
            line(owner, t.getId(), "REPLY", "falat", "Válasz " + i + ".", false, base.plusSeconds(i));
        }
        flagLogPopulator.raise(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(7.5, 7, 7, 5.0, 6.5, Map.of())));

        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, Instant.now())).isPresent();
    }

    @Test
    void secondSameTagReplyOnAnotherThread_recordsAHit_noSecondFact() {
        UUID owner = owner();
        TeamChatThreadEntity first = openLateEating(owner);
        service.reply(owner, first.getId(), "10-kor ért véget a kupa " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(threads.findById(first.getId()).orElseThrow().getCloseReason()).isEqualTo("REPLY"));
        TeamChatExceptionEntity ex =
                exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(first.getId(), owner).orElseThrow();
        // The first reply's hit moves to yesterday, so today's second occurrence is a fresh hit day.
        TeamChatExceptionHitEntity firstHit = hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(
                ex.getId(), first.getId(), "REPLY").orElseThrow();
        firstHit.setHitOn(today().minusDays(1));
        hits.saveAndFlush(firstHit);

        TeamChatThreadEntity second = openLateEating(owner);
        service.reply(owner, second.getId(), "Megint kupa volt " + MECCS);

        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(threads.findById(second.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED"));
        TeamChatThreadEntity closed = threads.findById(second.getId()).orElseThrow();
        assertThat(closed.getCloseReason()).isEqualTo("REPLY");
        assertThat(closed.getCloseNote()).isEqualTo("meccsnap");
        assertThat(hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(ex.getId(), second.getId(), "REPLY"))
                .get().extracting(TeamChatExceptionHitEntity::getHitOn).isEqualTo(today());
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), today().minusDays(1)))
                .isEqualTo(2);
        assertThat(exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(second.getId(), owner)).isEmpty();
        assertThat(exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
                owner, FlagKey.LATE_EATING)).singleElement().extracting(TeamChatExceptionEntity::getId)
                .isEqualTo(ex.getId());
        assertThat(teamChatFacts(owner)).hasSize(1);
    }

    @Test
    void llmCallRunsOutsideAnyTransaction() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);

        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .extracting(TeamChatLineEntity::getKind).containsExactly("OPEN", "USER", "REPLY"));
        assertThat(txActiveAtReplyVoice).containsExactly(false);
        assertThat(linesOf(t.getId()).getLast().getVoiced()).isTrue();
    }
}

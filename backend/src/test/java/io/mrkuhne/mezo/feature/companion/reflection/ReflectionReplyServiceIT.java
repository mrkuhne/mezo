package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyService;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §5): the chip-reply state machine. Every transition
 * here is a USER rule executed by CODE — an LLM answer never reaches {@code status} or
 * {@code belief}.
 */
@ActiveProfiles("companion-fake")
class ReflectionReplyServiceIT extends AbstractIntegrationTest {

    @Autowired private ReflectionReplyService replyService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository eventRepository;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private UserPopulator userPopulator;

    private static TestPlanEnvelope plan() {
        return new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 30);
    }

    private PatternEntity row(UUID owner, String status) {
        return patternPopulator.reflection(owner, plan(), status);
    }

    private List<PatternEventEntity> events(UUID owner, UUID patternId) {
        return eventRepository.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
                owner, patternId);
    }

    @Test
    void testReply_shouldStartMonitoringAndAppendBothEvents_whenWatchOnAProposedRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_PROPOSED);

        PatternReplyResponse response = replyService.reply(owner, row.getId(), "watch", null);

        assertThat(response.getPattern().getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(response.getConversationId()).isNull();
        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_USER_REPLY,
                        PatternEventEntity.KIND_MONITORING);
        PatternEventPayloadEnvelope payload = events(owner, row.getId()).getFirst().getPayload();
        assertThat(payload.channel()).isEqualTo("chip");
        assertThat(payload.choice()).isEqualTo("watch");
    }

    @Test
    void testReply_shouldOnlyAppendTheReply_whenWatchOnAnAlreadyMonitoringRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_MONITORING);

        replyService.reply(owner, row.getId(), "watch", null);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_USER_REPLY);
    }

    @Test
    void testReply_shouldRefuteOnlyOnTheSecondReject_whenTheUserRejectsTwice() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_MONITORING);

        PatternReplyResponse first = replyService.reply(owner, row.getId(), "reject", "nem stimmel");
        assertThat(first.getPattern().getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_USER_REPLY);

        PatternReplyResponse second = replyService.reply(owner, row.getId(), "reject", null);
        assertThat(second.getPattern().getStatus()).isEqualTo(PatternEntity.STATUS_REFUTED);
        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_REFUTED);
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_USER_REPLY,
                        PatternEventEntity.KIND_USER_REPLY, PatternEventEntity.KIND_REFUTED);
    }

    @Test
    void testReply_shouldRecomputeBeliefFromTheLastEvidence_whenTheUserAnswers() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_MONITORING);
        row.setEvidenceHits(3);
        patternPopulator.save(row);
        eventRepository.saveAndFlush(evidence(owner, row.getId()));

        BigDecimal afterWatch = replyBelief(owner, row.getId(), "watch");
        assertThat(afterWatch).isNotNull().isGreaterThan(BigDecimal.ZERO);

        // a negative reply can only lower the same number — code decides, never the model
        BigDecimal afterReject = replyBelief(owner, row.getId(), "reject");
        assertThat(afterReject).isLessThan(afterWatch);
    }

    @Test
    void testReply_shouldOpenASeededConversation_whenChoiceIsTalk() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_PROPOSED);

        PatternReplyResponse response = replyService.reply(owner, row.getId(), "talk", "mesélek");

        assertThat(response.getConversationId()).isNotNull();
        assertThat(conversationRepository.findById(response.getConversationId()).orElseThrow()
                .getSeedPatternId()).isEqualTo(row.getId());
        assertThat(response.getPattern().getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
    }

    @Test
    void testReply_shouldThrowNotFound_whenTheRowBelongsToSomeoneElse() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        PatternEntity foreign = row(stranger, PatternEntity.STATUS_PROPOSED);

        assertThatThrownBy(() -> replyService.reply(owner, foreign.getId(), "watch", null))
                .isInstanceOf(SystemRuntimeErrorException.class);
        // read the stream as its OWNER: `owner`'s view of a foreign row is empty either way
        assertThat(events(stranger, foreign.getId())).isEmpty();
        assertThat(patternRepository.findById(foreign.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_PROPOSED);
    }

    /**
     * The Pearson job owns a {@code statistical} row's lifecycle and nothing maintains its
     * {@code belief} — a chip answer must not be able to touch either (S4 review finding).
     */
    @Test
    void testReply_shouldThrowNotFound_whenTheRowIsAStatisticalCatalogRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity statistical = patternPopulator.statistical(owner, "pair-stat-reply",
                PatternEntity.STATUS_MONITORING);

        assertThatThrownBy(() -> replyService.reply(owner, statistical.getId(), "watch", null))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(events(owner, statistical.getId())).isEmpty();
        PatternEntity reloaded = patternRepository.findById(statistical.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(reloaded.getBelief()).isNull();
    }

    @Test
    void testReply_shouldThrowValidationError_whenTheChoiceIsUnknown() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = row(owner, PatternEntity.STATUS_PROPOSED);

        assertThatThrownBy(() -> replyService.reply(owner, row.getId(), "shrug", null))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(events(owner, row.getId())).isEmpty();
    }

    private BigDecimal replyBelief(UUID owner, UUID patternId, String choice) {
        replyService.reply(owner, patternId, choice, null);
        return patternRepository.findById(patternId).orElseThrow().getBelief();
    }

    private static PatternEventEntity evidence(UUID owner, UUID patternId) {
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(owner);
        event.setPatternId(patternId);
        event.setKind(PatternEventEntity.KIND_EVIDENCE);
        event.setPayload(PatternEventPayloadEnvelope.evidence(0.62, 14, 0.01, "LIVE", true));
        return event;
    }
}

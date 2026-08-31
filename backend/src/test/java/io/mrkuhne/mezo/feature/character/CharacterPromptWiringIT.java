package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.feature.proactive.service.PredictionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Task 2 wiring IT (mezo-1gim.8): proves the ONE {@link io.mrkuhne.mezo.feature.companion.CharacterPromptSource}
 * formatter reaches every wired surface — chat ({@link ChatService}), memoir ({@link MemoirGenerator}),
 * prediction ({@link PredictionGenerator}) — and stays honestly absent when the character switch is
 * off (the {@code CharacterApiSwitchOffIT}/{@code CharacterObservationJobIT} {@code @Nested}
 * enabled/disabled idiom). {@code WeeklyReviewGenerator} is deliberately NOT covered here: its
 * gather never includes the facts block ({@code knowledgeFactService.renderPromptBlock}) in the
 * first place, so per the wiring rule (facts-block-present is the insertion-point precondition) it
 * is skipped — see the task-2 report.
 */
class CharacterPromptWiringIT {

    private static final String CLAIM_TEXT = "KARAKTER-PROBA-ALLITAS";
    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    private static CharacterDimensionEntity seedDimension(CharacterDimensionRepository repository, UUID owner) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey("discipline");
        entity.setTitle("Motiváció & fegyelem");
        entity.setKind("CORE");
        entity.setExpertKey("drill");
        entity.setPortrait("");
        entity.setMaturity((short) 0);
        return repository.save(entity);
    }

    private static void seedClaim(CharacterClaimRepository repository, UUID owner, UUID dimensionId) {
        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimensionId);
        claim.setText(CLAIM_TEXT);
        claim.setConfidence(new BigDecimal("0.80"));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("doki");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(false);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim.setUpdatedAt(Instant.now());
        repository.save(claim);
    }

    @Nested
    @ActiveProfiles("companion-fake")
    class SwitchOn extends AbstractIntegrationTest {

        @Autowired private CharacterDimensionRepository dimensionRepository;
        @Autowired private CharacterClaimRepository claimRepository;
        @Autowired private ChatService chatService;
        @Autowired private MemoirGenerator memoirGenerator;
        @Autowired private PredictionGenerator predictionGenerator;
        @Autowired private UserPopulator userPopulator;
        @Autowired private AiConversationPopulator conversationPopulator;
        @Autowired private DailySummaryPopulator dailySummaryPopulator;
        @Autowired private PatternPopulator patternPopulator;

        private UUID seedOwnerWithClaim() {
            UUID owner = userPopulator.createUser().getId();
            CharacterDimensionEntity dimension = seedDimension(dimensionRepository, owner);
            seedClaim(claimRepository, owner, dimension.getId());
            return owner;
        }

        @Test
        void testPrepareTurn_shouldCarryTheKarakterBlock() {
            UUID owner = seedOwnerWithClaim();
            AiConversationEntity conversation = conversationPopulator.conversation(owner);

            ChatService.PreparedTurn turn = chatService.prepareTurn(owner, conversation.getId(),
                    SendMessageRequest.builder().content("mi a mai terv?").build());

            assertThat(turn.systemPrompt()).contains(CLAIM_TEXT);
        }

        @Test
        void testMemoirGather_shouldCarryTheKarakterBlock() {
            UUID owner = seedOwnerWithClaim();
            dailySummaryPopulator.summary(owner, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");

            MemoirGenerator.MemoirGather gather = memoirGenerator.gather(owner, WEEK_START);

            assertThat(gather).isNotNull();
            assertThat(gather.payload()).contains(CLAIM_TEXT);
        }

        @Test
        void testPredictionGather_shouldCarryTheKarakterBlock() {
            UUID owner = seedOwnerWithClaim();
            patternPopulator.statistical(owner, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);

            PredictionGenerator.PredictionGather gather = predictionGenerator.gather(owner, WEEK_START);

            assertThat(gather).isNotNull();
            assertThat(gather.payload()).contains(CLAIM_TEXT);
        }
    }

    @Nested
    @ActiveProfiles("companion-fake")
    @TestPropertySource(properties = "mezo.feature.character.enabled=false")
    class SwitchOff extends AbstractIntegrationTest {

        @Autowired private ChatService chatService;
        @Autowired private UserPopulator userPopulator;
        @Autowired private AiConversationPopulator conversationPopulator;

        @Test
        void testPrepareTurn_shouldSucceedAndOmitTheKarakterBlock_whenCharacterSwitchOff() {
            UUID owner = userPopulator.createUser().getId();
            AiConversationEntity conversation = conversationPopulator.conversation(owner);

            ChatService.PreparedTurn turn = chatService.prepareTurn(owner, conversation.getId(),
                    SendMessageRequest.builder().content("mi a mai terv?").build());

            assertThat(turn.systemPrompt()).doesNotContain("[Karakter");
        }
    }
}

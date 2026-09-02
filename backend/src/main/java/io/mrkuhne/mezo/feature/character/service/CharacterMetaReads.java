package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The system-side (AI-meta) read composer for the detector framework (round-4 spec §6.2): what the
 * companion proposed and how it went — fact/pattern triage decisions, predictions, quests,
 * experiment and challenge outcomes. Split from {@link CharacterSignalReads} (already 28
 * dependencies) because these sources describe THE SYSTEM, and the detectors reading them
 * (szkeptikus-owned, META dimension) make claims about the system, never about the user.
 *
 * <p>Catch-up honesty holds on the DATE columns (every read is bounded above by {@code to});
 * two sources mutate STATUS in place without a timestamp (prediction status, experiment/challenge
 * status + outcomeGood), so a catch-up run sees today's status for a past day — an accepted,
 * documented limitation (spec §6.4). Fact decisions are dated by the candidate's {@code createdAt}
 * because {@code learned_fact} has no decidedAt — a proxy the detector's summary names.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterMetaReads {

    static final String SOURCE_FACT = "fact";
    static final String SOURCE_PATTERN = "pattern";
    static final String CATEGORY_PATTERN = "minta";
    static final String DECISION_KEPT = "kept";
    static final String DECISION_REJECTED = "rejected";
    static final String KIND_EXPERIMENT = "experiment";
    static final String KIND_CHALLENGE = "challenge";

    private final LearnedFactRepository learnedFactRepository;
    private final PatternEventRepository patternEventRepository;
    private final PredictionRepository predictionRepository;
    private final DailyQuestRepository dailyQuestRepository;
    private final ExperimentRepository experimentRepository;
    private final ChallengeRepository challengeRepository;

    public DetectorInput.MetaWindow gather(UUID owner, LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return new DetectorInput.MetaWindow(
                gatherTriage(owner, fromInstant, toExclusive),
                gatherPredictions(owner, from, to),
                gatherQuests(owner, from, to),
                gatherProposalOutcomes(owner, from, to, fromInstant, toExclusive));
    }

    private List<DetectorInput.TriageDecisionPoint> gatherTriage(UUID owner, Instant from, Instant toExclusive) {
        List<DetectorInput.TriageDecisionPoint> out = new ArrayList<>();
        for (LearnedFactEntity f : learnedFactRepository
                .findByCreatedByAndUserDecisionIsNotNullAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(
                        owner, from, toExclusive)) {
            boolean rejected = LearnedFactEntity.DECISION_REJECT.equals(f.getUserDecision());
            boolean refined = LearnedFactEntity.DECISION_REFINE.equals(f.getUserDecision());
            out.add(new DetectorInput.TriageDecisionPoint(localDate(f.getCreatedAt()), SOURCE_FACT,
                    f.getCategory(), rejected ? DECISION_REJECTED : DECISION_KEPT, refined));
        }
        for (PatternEventEntity e : patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        owner, List.of(PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_REJECTED),
                        from, toExclusive)) {
            boolean rejected = PatternEventEntity.KIND_REJECTED.equals(e.getKind());
            out.add(new DetectorInput.TriageDecisionPoint(localDate(e.getOccurredAt()), SOURCE_PATTERN,
                    CATEGORY_PATTERN, rejected ? DECISION_REJECTED : DECISION_KEPT, false));
        }
        out.sort(Comparator.comparing(DetectorInput.TriageDecisionPoint::date));
        return out;
    }

    private List<DetectorInput.PredictionPoint> gatherPredictions(UUID owner, LocalDate from, LocalDate to) {
        return predictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(owner, from, to).stream()
                .map(p -> new DetectorInput.PredictionPoint(p.getValidFrom(), p.getValidTo(), p.getStatus(),
                        p.getConfidence(), p.getMetricKey()))
                .sorted(Comparator.comparing(DetectorInput.PredictionPoint::validTo))
                .toList();
    }

    private List<DetectorInput.QuestPoint> gatherQuests(UUID owner, LocalDate from, LocalDate to) {
        return dailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc(owner, from, to).stream()
                .map(q -> new DetectorInput.QuestPoint(q.getQuestDate(), q.getSlot(), q.getStatus()))
                .sorted(Comparator.comparing(DetectorInput.QuestPoint::questDate))
                .toList();
    }

    private List<DetectorInput.ProposalOutcomePoint> gatherProposalOutcomes(UUID owner, LocalDate from, LocalDate to,
                                                                            Instant fromInstant, Instant toExclusive) {
        List<DetectorInput.ProposalOutcomePoint> out = new ArrayList<>();
        for (ExperimentEntity e : experimentRepository
                .findByCreatedByAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThanAndDeletedFalse(
                        owner, fromInstant, toExclusive)) {
            out.add(new DetectorInput.ProposalOutcomePoint(localDate(e.getGeneratedAt()), KIND_EXPERIMENT,
                    e.getStatus(), e.getOutcomeGood()));
        }
        for (ChallengeEntity c : challengeRepository.findByCreatedByAndWorkoutDateBetweenAndDeletedFalse(owner, from, to)) {
            out.add(new DetectorInput.ProposalOutcomePoint(c.getWorkoutDate(), KIND_CHALLENGE,
                    c.getStatus(), c.getOutcomeGood()));
        }
        out.sort(Comparator.comparing(DetectorInput.ProposalOutcomePoint::date));
        return out;
    }

    private static LocalDate localDate(Instant at) {
        return at == null ? null : at.atZone(ZoneId.systemDefault()).toLocalDate();
    }
}

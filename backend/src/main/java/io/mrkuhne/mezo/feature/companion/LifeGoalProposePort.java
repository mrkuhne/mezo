package io.mrkuhne.mezo.feature.companion;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Propose-only life-goal drafting (mezo-iizd, ADR 0019): the companion's smart model proposes a
 * dimension, an intrinsic/extrinsic frame reading, 3–5 pillars chosen ONLY from the catalog text
 * the caller hands over, obstacles and ha–akkor plans. Absent bean (any gating switch off) or an
 * empty Optional ⇒ the lifegoal slice answers from its rule template. Lives in companion so the
 * dependency stays lifegoal → companion (slice 2 reads MetricSeriesService the same way).
 */
public interface LifeGoalProposePort {

    record PillarProposal(String catalogId, String label, String kind, String skillKey, int weight,
        BigDecimal threshold, String comparator, Integer daysPerWeek, BigDecimal startValue, BigDecimal targetValue) {}

    record PlanProposal(String ha, String akkor, String triggerSource, String triggerCondition, Integer delayHours) {}

    record Proposal(String dimension, String secondaryDimension, String frame, String frameNote, String reframedWhy,
        List<PillarProposal> pillars, List<String> obstacles, List<PlanProposal> plans) {}

    Optional<Proposal> propose(UUID userId, String title, String whyText, String catalogText, Set<String> skillKeys);
}

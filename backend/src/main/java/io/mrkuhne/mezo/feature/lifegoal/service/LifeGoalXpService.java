package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.lifegoal.LifeGoalSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The single XP seam of the life-goal motor (mezo-iizd.6): an evaluated `hit` pillar-day grants
 * {@code mezo.lifegoal.xp-per-hit} on the pillar's own skill through the shared idempotent
 * progression tail. Called from every pillar-day WRITE (manual evaluate + the nightly job), never
 * from a read path — {@code progress}/{@code today} compute days without storing them.
 *
 * <p>Idempotency is the D-1 deterministic key (spec §1 D-1): stable across the job's 3-day rewrite
 * window AND across a source/kind change that drops and recomputes the pillar-day rows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalXpService {

    private static final String STATUS_HIT = "hit";

    private final LifeGoalProperties properties;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final ProgressionService progressionService;

    /**
     * The D-1 XP idempotency key: {@code lifegoal:<pillarId>:<day>} hashed to a stable UUID.
     *
     * <p>Keyed on the pillar's row identity ON PURPOSE: it must survive the job's 3-day rewrite and
     * an in-place retune (mezo-iizd.2 keeps the UUID through edits). The accepted narrow leak: a
     * pillar DELETED and then re-created as an equivalent new row mints a new UUID, so up to the
     * last 3 hit-days can award XP twice (≤ 3 × xp-per-hit, feedback-only currency). Keying on
     * content (source+kind) instead would close that but break idempotency across a legitimate
     * source/kind edit, which drops and honestly re-evaluates history — the wrong trade.
     */
    public static UUID refIdFor(UUID pillarId, LocalDate day) {
        return UUID.nameUUIDFromBytes(("lifegoal:" + pillarId + ":" + day).getBytes(StandardCharsets.UTF_8));
    }

    /** Grants XP for one evaluated pillar-day; a no-op for every non-hit status. */
    public void awardIfHit(LifeGoalPillarEntity pillar, LocalDate day, String status) {
        if (!STATUS_HIT.equals(status)) {
            return;
        }
        if (ProgressionTaxonomy.ROBUSTNESS.equals(pillar.getSkillKey())) {
            // The shared tail recomputes robustness to an absolute streak target: a delta there
            // is discarded, so the award would be a ledger row granting nothing.
            log.debug("Life-goal pillar {} is robustness-keyed — no XP", pillar.getId());
            return;
        }
        if (progressionGate.getIfAvailable() == null) {
            return;
        }
        String kind = skillKindOf(pillar.getSkillKey());
        if (kind == null) {
            log.warn("Life-goal pillar {} has unknown skill key {} — no XP",
                pillar.getId(), pillar.getSkillKey());
            return;
        }
        progressionService.applyLifeGoal(pillar.getCreatedBy(), new LifeGoalSignal(
            refIdFor(pillar.getId(), day), pillar.getSkillKey(), kind,
            properties.xpPerHit(), "Életcél · " + pillar.getLabel(), day));
    }

    private static String skillKindOf(String skillKey) {
        if (ProgressionTaxonomy.LIFE.contains(skillKey)) {
            return "LIFE";
        }
        if (ProgressionTaxonomy.ATHLETIC.contains(skillKey)) {
            return "ATHLETIC";
        }
        if (ProgressionTaxonomy.MUSCLE.contains(skillKey)) {
            return "MUSCLE";
        }
        return null;
    }
}

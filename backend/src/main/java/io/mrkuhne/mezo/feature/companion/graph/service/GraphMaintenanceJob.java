package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W2.5 nightly cron (bd mezo-b3pp.10, spec §6.5) — the {@code FeedbackLearningJob} idiom:
 * per-user isolation, one bad user never kills the run. THREE independently-isolated phases per
 * user, in this order: (1) {@link GraphMaintenanceService#runMaintenance} (decay/prune/reinforce,
 * pure arithmetic), (2) {@link GraphPromotionService#reconcile} (the W2.2 nightly catch-up sweep —
 * already per-row isolated internally, mezo-b3pp.32), (3) {@link
 * LifeEventExtractionService#extractFor} for YESTERDAY (the W2.3 extraction pass; "yesterday" the
 * same convention {@code DailySummaryJob}/{@code PatternDetectionJob} use — a night's narrative
 * is only complete once the night is over).
 *
 * <p>Phase isolation is at the PHASE level here, not just per-user: a failure in phase 1 for a
 * user must not skip phases 2/3 for that SAME user, and a failure anywhere must not skip the next
 * user. Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code GRAPH_MAINTENANCE_JOB_SWITCH} — all three collaborators this job calls already require at
 * least {@code KNOWLEDGE_GRAPH_SWITCH} themselves, so direct constructor injection (no
 * {@code ObjectProvider}) is safe: whenever this bean exists, so do theirs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.GRAPH_MAINTENANCE_JOB_SWITCH},
        havingValue = "true")
public class GraphMaintenanceJob {

    private final AppUserRepository appUserRepository;
    private final GraphMaintenanceService graphMaintenanceService;
    private final GraphPromotionService graphPromotionService;
    private final LifeEventExtractionService lifeEventExtractionService;

    @Scheduled(cron = "${mezo.companion.graph.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                GraphMaintenanceResult result = graphMaintenanceService.runMaintenance(user.getId());
                log.info("Graph maintenance for user {}: {} edges decayed, {} edges pruned, "
                        + "{} candidates pruned, {} edges reinforced", user.getId(),
                    result.edgesDecayed(), result.edgesPruned(), result.candidatesPruned(),
                    result.edgesReinforced());
            } catch (Exception e) {
                log.warn("Graph maintenance failed for user {}", user.getId(), e);
            }
            try {
                int upserted = graphPromotionService.reconcile(user.getId());
                log.info("Graph reconcile for user {}: {} node(s) upserted", user.getId(), upserted);
            } catch (Exception e) {
                log.warn("Graph reconcile failed for user {}", user.getId(), e);
            }
            try {
                int candidates = lifeEventExtractionService.extractFor(user.getId(), yesterday);
                log.info("Life-event extraction for user {} on {}: {} candidate(s)", user.getId(),
                    yesterday, candidates);
            } catch (Exception e) {
                log.warn("Life-event extraction failed for user {} on {}", user.getId(), yesterday, e);
            }
        }
    }
}

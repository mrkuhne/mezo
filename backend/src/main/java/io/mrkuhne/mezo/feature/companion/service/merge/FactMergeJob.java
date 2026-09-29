package io.mrkuhne.mezo.feature.companion.service.merge;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * S9 (mezo-d6ivw.10) Task 6's cron: the weekly fan-out over every active user's confirmed,
 * plan-less, prompt-eligible facts, judging them for auto-merge or proposal (schedule: {@code
 * mezo.companion.fact-merge.cron}, 07:30 on Monday — after the dawn cluster and outside the
 * 22:00–07:00 quiet hours; see {@code application.yml}). Copies the {@code KnowledgeRecheckJob}/{@code
 * UserFanOut} idiom: per-user isolation, one failing user never aborts the sweep. {@code run()}
 * is NOT {@code @Transactional} — nor is {@link FactMergeService#runFor} any more; that
 * service opens its OWN per-plan {@code REQUIRES_NEW} transaction internally (see its class
 * javadoc), so the per-user isolation this job provides and the per-plan isolation the service
 * provides are two independent, correctly nested boundaries.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code FACT_MERGE_JOB_SWITCH} — {@link FactMergeService}
 * already requires the first itself, so direct constructor injection is safe: whenever this bean
 * exists, so does its service.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.FACT_MERGE_JOB_SWITCH},
        havingValue = "true")
public class FactMergeJob {

    private final UserFanOut userFanOut;
    private final FactMergeService factMergeService;

    @Scheduled(cron = "${mezo.companion.fact-merge.cron}")
    public void run() {
        userFanOut.forEachActiveUser("Fact merge", user -> {
            try {
                FactMergeService.Outcome outcome = factMergeService.runFor(user.getId());
                log.info("Fact merge for user {}: {} merged, {} proposed", user.getId(), outcome.merged(),
                        outcome.proposed());
            } catch (Exception e) {
                log.warn("Fact merge failed for user {} — the sweep continues", user.getId(), e);
            }
        });
    }
}

package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Envelope S2 (mezo-d6ivw.2) Task 5's cron: the quarterly fan-out over every active user's
 * confirmed, plan-less facts (schedule: {@code mezo.companion.reflection.recheck-cron}, 09:20 on
 * the 1st of Jan/Apr/Jul/Oct — deliberately OUTSIDE the dawn cluster and its default 22:00–07:00
 * quiet hours; see {@code application.yml}). Copies the {@code QuarterlyReviewJob}/{@code
 * UserFanOut} idiom: per-user isolation, one failing user never aborts the sweep. {@code run()}
 * is NOT {@code @Transactional} — nor is {@link KnowledgeRecheckService#runFor} any more; that
 * service opens its OWN per-row {@code REQUIRES_NEW} transaction internally (see its class
 * javadoc), so the per-user isolation this job provides and the per-row isolation the service
 * provides are two independent, correctly nested boundaries.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code REFLECTION_SWITCH} ∧ {@code
 * KNOWLEDGE_RECHECK_JOB_SWITCH} — {@link KnowledgeRecheckService} already requires the first two
 * itself, so direct constructor injection is safe: whenever this bean exists, so does its service.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH,
            FeaturesConfiguration.KNOWLEDGE_RECHECK_JOB_SWITCH},
        havingValue = "true")
public class KnowledgeRecheckJob {

    private final UserFanOut userFanOut;
    private final KnowledgeRecheckService recheckService;

    @Scheduled(cron = "${mezo.companion.reflection.recheck-cron}")
    public void run() {
        userFanOut.forEachActiveUser("Knowledge recheck", user -> {
            try {
                int drifted = recheckService.runFor(user.getId());
                log.info("Knowledge recheck for user {}: {} drift observation(s)", user.getId(), drifted);
            } catch (Exception e) {
                log.warn("Knowledge recheck failed for user {} — the sweep continues", user.getId(), e);
            }
        });
    }
}

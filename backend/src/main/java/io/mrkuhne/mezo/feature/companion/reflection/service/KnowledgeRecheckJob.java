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
 * confirmed, plan-less facts (schedule: {@code mezo.companion.reflection.recheck-cron}, 04:20 on
 * the 1st of Jan/Apr/Jul/Oct — right after the 04:00 {@code QuarterlyReviewJob} dawn slot). Copies
 * the {@code QuarterlyReviewJob}/{@code UserFanOut} idiom: per-user isolation, one failing user
 * never aborts the sweep, {@code run()} deliberately NOT {@code @Transactional} so {@link
 * KnowledgeRecheckService#runFor}'s own {@code @Transactional} boundary (reached through the
 * self-injected proxy) stays the per-user isolation unit.
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

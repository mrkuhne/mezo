package io.mrkuhne.mezo.feature.companion.quarterly.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W5.3 quarterly cron (bd mezo-b3pp.20, spec §9.3) — the {@code GraphMaintenanceJob} idiom:
 * per-user isolation, and PHASE isolation inside a user (a failed season pass must not cost that
 * same user their profile refresh). Two phases, in this order:
 * (1) {@link QuarterlyReviewService#runFor} for the JUST-FINISHED quarter — "finished" is the
 * same convention {@code DailySummaryJob}/{@code ConsolidationJob} use one rung down: the newest
 * period the job ever touches is the one that has actually ended;
 * (2) {@link ProfileAssembler#rebuild} — the quarterly refresh spec §9.3 asks for, run AFTER the
 * season pass so a freshly proposed season is at least visible in the same dawn's graph state.
 *
 * <p>Scheduled at 04:00 on the 1st of Jan/Apr/Jul/Oct, after that dawn's 03:50 monthly
 * consolidation rung, which completes the quarter's last month — the input this job reads.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code QUARTERLY_REVIEW_JOB_SWITCH} — both collaborators already require the first two
 * themselves, so direct constructor injection is safe: whenever this bean exists, so do theirs.
 *
 * <p>{@code run()} is deliberately NOT {@code @Transactional}: {@link
 * QuarterlyReviewService#runFor} owns its own {@code @Transactional} boundary per user (REQUIRED
 * propagation). If this method opened an outer transaction, that call would join it instead of
 * running standalone — a failure {@code runFor} swallows internally would still mark the SHARED
 * outer transaction rollback-only, and the rollback would surface at this method's commit,
 * destroying the per-user isolation this job exists to provide. {@code GraphMaintenanceJob.run()}
 * is non-transactional for the identical reason; this class copies that precedent exactly.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH},
        havingValue = "true")
public class QuarterlyReviewJob {

    private final AppUserRepository appUserRepository;
    private final QuarterlyReviewService quarterlyReviewService;
    private final ProfileAssembler profileAssembler;

    @Scheduled(cron = "${mezo.companion.quarterly.cron}")
    public void run() {
        LocalDate quarter = Quarters.previous(Quarters.startOf(LocalDate.now()));
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                int candidates = quarterlyReviewService.runFor(user.getId(), quarter);
                log.info("Quarterly season pass for user {} on {}: {} candidate(s)",
                    user.getId(), Quarters.label(quarter), candidates);
            } catch (Exception e) {
                log.warn("Quarterly season pass failed for user {} on {}", user.getId(), quarter, e);
            }
            try {
                profileAssembler.rebuild(user.getId())
                    .ifPresentOrElse(
                        id -> log.info("Quarterly profile rebuild for user {} (node {})", user.getId(), id),
                        () -> log.info("No profile signal for user {} — quarterly rebuild skipped", user.getId()));
            } catch (Exception e) {
                log.warn("Quarterly profile rebuild failed for user {} — the sweep continues",
                    user.getId(), e);
            }
        }
    }
}

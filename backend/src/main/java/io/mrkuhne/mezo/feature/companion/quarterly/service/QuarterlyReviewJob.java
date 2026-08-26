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
 * period the job ever touches is the one that has actually ended. Zero candidates covers BOTH an
 * honest gate (already processed, or no month rungs) and a swallowed model/persistence failure —
 * {@code QuarterlyReviewService} already logs its own warn in the failure paths, so nothing is
 * lost by not distinguishing the two here;
 * (2) {@link ProfileAssembler#rebuild} — run AFTER the season pass because that is what keeps the
 * Task 3 decision-quality trend current: {@code ProfileAssembler}'s {@code DÖNTÉSI MINŐSÉG}
 * section compares THIS calendar quarter's reviewed-decision outcomes against the previous
 * quarter's, so re-running the assembler right as the quarter turns over is what surfaces that
 * comparison promptly. (A freshly proposed SEASON candidate is NOT itself profile input in any
 * status: {@code ProfileAssembler#habitNodes} only reads ACTIVE {@code PATTERN}/{@code PREFERENCE}
 * nodes — a season is neither that kind nor ever active while it is still a pending candidate.)
 *
 * <p>Scheduled at 04:00 on the 1st of Jan/Apr/Jul/Oct, after that dawn's 03:50 monthly
 * consolidation rung, which completes the quarter's last month — the input this job reads.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code QUARTERLY_REVIEW_JOB_SWITCH} — both collaborators already require the first two
 * themselves, so direct constructor injection is safe: whenever this bean exists, so do theirs.
 *
 * <p>{@code run()} is deliberately NOT {@code @Transactional}: {@link
 * QuarterlyReviewService#persistCandidates} — the only write the season pass performs — carries
 * its own {@code @Transactional} boundary (REQUIRED propagation), reached through {@code runFor}'s
 * self-injected proxy. If this method opened an outer transaction, that call would join it
 * instead of running standalone — a failure {@code persistCandidates} swallows internally (caught
 * inside {@code runFor}) would still mark the SHARED outer transaction rollback-only, and the
 * rollback would surface at this method's commit, destroying the per-user isolation this job
 * exists to provide. {@code GraphMaintenanceJob.run()} is non-transactional for the identical
 * reason; this class copies that precedent exactly.
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
        String quarterLabel = Quarters.label(quarter);
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                int candidates = quarterlyReviewService.runFor(user.getId(), quarter);
                log.info("Quarterly season pass for user {} on {}: {} candidate(s)",
                    user.getId(), quarterLabel, candidates);
            } catch (Exception e) {
                log.warn("Quarterly season pass failed for user {} on {}", user.getId(), quarterLabel, e);
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

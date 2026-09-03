package io.mrkuhne.mezo.feature.companion.quarterly.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
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
 * (2) {@link ProfileAssembler#rebuild} — run AFTER the season pass, ANCHORED ON THE SAME
 * just-finished quarter phase 1 reviewed. That anchor is the point of phase 2: the assembler's
 * {@code DÖNTÉSI MINŐSÉG} section compares one quarter's reviewed-decision outcomes against the
 * quarter before it, and the quarter this job cares about is the one that just closed — NOT the
 * one that started four hours earlier at midnight. Before the review fix (mezo-b3pp.20 final
 * review, F1) the assembler derived that window itself from {@code LocalDate.now()}, so on Jan 1
 * at 04:00 it looked for decisions reviewed inside the brand-new quarter, found none, and dropped
 * the whole section — the quarterly rebuild then rewrote the profile prose from LESS input than
 * the previous Monday's weekly run had, losing the user-visible decision-quality observation on
 * precisely the day the "quarterly deep pass" was supposed to sharpen it. Passing {@code quarter}
 * explicitly is the fix; {@link ProfileAssembler#rebuild} has no no-anchor overload, so no future
 * caller can re-acquire the bug by omission. (A freshly proposed SEASON candidate is NOT itself
 * profile input in any status: {@code ProfileAssembler#habitNodes} only reads ACTIVE {@code
 * PATTERN}/{@code PREFERENCE} nodes — a season is neither that kind nor ever active while it is
 * still a pending candidate.)
 *
 * <p>Scheduled at 04:00 on the 1st of Jan/Apr/Jul/Oct, after that dawn's 03:50 monthly
 * consolidation rung, which completes the quarter's last month — the input this job reads.
 *
 * <p>Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code QUARTERLY_REVIEW_JOB_SWITCH} — both collaborators already require the first two
 * themselves, so direct constructor injection is safe: whenever this bean exists, so do theirs.
 *
 * <p><b>Phase 2 additionally honours {@code PROFILE_ASSEMBLER_JOB_SWITCH}</b> (mezo-b3pp.20 final
 * review, F2). {@code mezo.techcore.cron.profile-assembler-job.enabled=false} is a documented kill
 * switch for the profile: no weekly rebuild, no smart-tier call for it, and an archived "Rólad
 * tanultam" node stays archived. Calling {@link ProfileAssembler#rebuild} unconditionally from
 * here made that switch leaky — four times a year it would spend a smart-tier call per user and
 * force-flip the archived node back to ACTIVE, resurrecting a profile the operator (or the user)
 * had deliberately switched off. {@code @Value} is banned in this repo, so the switch is read the
 * house way — BY BEAN PRESENCE: {@link ProfileAssemblerJob}'s existence IS
 * {@code PROFILE_ASSEMBLER_JOB_SWITCH} being on (its own {@code @ConditionalOnProperty} says so),
 * so an {@link ObjectProvider} that resolves to nothing means the switch is off. It is held
 * through an {@code ObjectProvider} rather than injected directly precisely because the bean is
 * allowed to be absent (the {@code ChatService}/{@code ProfilePromptAssembler} idiom), and the
 * skip is logged rather than silent (IDENT-3: a degraded run says so). <b>Phase 1 keeps running
 * either way</b> — proposing SEASON candidates is not the profile job, and switching the profile
 * off must not silently switch the season reading off too.
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

    private final UserFanOut userFanOut;
    private final QuarterlyReviewService quarterlyReviewService;
    private final ProfileAssembler profileAssembler;
    // Bean presence IS the PROFILE_ASSEMBLER_JOB_SWITCH reading (see the class javadoc): absent
    // ⇒ the operator switched the profile off, so phase 2 must not run. ObjectProvider because
    // this collaborator is legitimately allowed not to exist.
    private final ObjectProvider<ProfileAssemblerJob> profileAssemblerJob;

    @Scheduled(cron = "${mezo.companion.quarterly.cron}")
    public void run() {
        LocalDate quarter = Quarters.previous(Quarters.startOf(LocalDate.now()));
        String quarterLabel = Quarters.label(quarter);
        boolean profileEnabled = profileAssemblerJob.getIfAvailable() != null;
        if (!profileEnabled) {
            log.info("Profile assembler job switch is off — quarterly pass on {} proposes seasons "
                + "but skips the profile rebuild", quarterLabel);
        }
        userFanOut.forEachActiveUser("Quarterly review", user -> {
            try {
                int candidates = quarterlyReviewService.runFor(user.getId(), quarter);
                log.info("Quarterly season pass for user {} on {}: {} candidate(s)",
                    user.getId(), quarterLabel, candidates);
            } catch (Exception e) {
                log.warn("Quarterly season pass failed for user {} on {}", user.getId(), quarterLabel, e);
            }
            if (!profileEnabled) {
                return;   // phase 1 is independent of the profile switch; phase 2 is not
            }
            try {
                profileAssembler.rebuild(user.getId(), quarter)
                    .ifPresentOrElse(
                        id -> log.info("Quarterly profile rebuild for user {} on {} (node {})",
                            user.getId(), quarterLabel, id),
                        () -> log.info("No profile signal for user {} — quarterly rebuild skipped", user.getId()));
            } catch (Exception e) {
                log.warn("Quarterly profile rebuild failed for user {} — the sweep continues",
                    user.getId(), e);
            }
        });
    }
}

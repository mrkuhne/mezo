package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3): the weekly profile rebuild, Monday 03:45 — deliberately AFTER
 * the 03:10 feedback rollups and the 03:30 weekly consolidation rung, both of which it reads. One
 * smart-tier call per user per week (the {@code GraphMaintenanceJob} idiom: per-user isolation,
 * one bad user never kills the run).
 *
 * <p>Direct injection of {@link ProfileAssembler} is safe because this bean requires the same two
 * switches the assembler does, plus its own cron switch — whenever this bean exists, so does the
 * assembler's.
 *
 * <p><b>Anchor quarter (W5.3 review, mezo-b3pp.20 F1):</b> this weekly sweep runs mid-quarter and
 * means the quarter it is standing in, so it anchors {@link ProfileAssembler#rebuild} on {@code
 * Quarters.startOf(LocalDate.now())} — exactly the window the assembler used to derive for itself
 * before the anchor became an explicit argument, so this job's behaviour is unchanged. The W5.3
 * quarterly job passes a DIFFERENT anchor (the quarter that just finished), which is the whole
 * reason the assembler no longer guesses.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.PROFILE_ASSEMBLER_JOB_SWITCH},
        havingValue = "true")
public class ProfileAssemblerJob {

    private final UserFanOut userFanOut;
    private final ProfileAssembler profileAssembler;

    @Scheduled(cron = "${mezo.companion.profile.cron}")
    public void run() {
        LocalDate anchorQuarter = Quarters.startOf(LocalDate.now());
        userFanOut.forEachActiveUser("Profile assembler", user -> {
            try {
                profileAssembler.rebuild(user.getId(), anchorQuarter)
                        .ifPresentOrElse(
                            id -> log.info("Profile rebuilt for user {} (node {})", user.getId(), id),
                            () -> log.info("No profile signal for user {} — skipped", user.getId()));
            } catch (Exception e) {
                log.warn("Profile rebuild failed for user {} — the sweep continues", user.getId(), e);
            }
        });
    }
}

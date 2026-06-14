package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RpeTarget;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunPrescribedSession;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunSegment;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunWeek;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's "Futás" (interval-running) blocks under {@code @Profile("demodata")} so a plain
 * demodata app starts with the running plan present (alongside the owner from
 * {@link io.mrkuhne.mezo.feature.auth.OwnerSeedData}). Mirrors {@link TrainSeedData}'s owner
 * resolution + idempotency pattern.
 *
 * <p>Seeds THREE blocks: an active 8-week explosiveness plan (the user's real plan: Kedd sprint +
 * Péntek pyramid, progressive), a planned aerobic-base block, and an archived winter base block.
 * Every value is deterministic (fixed dates, no randomness).
 *
 * <p>Idempotent: if any running block already exists the runner is a no-op (re-runnable on restart
 * and in tests).
 */
@Component
@Profile("demodata")
@Order(110) // after OwnerSeedData (and after TrainSeedData's 100) — needs the seeded owner
@RequiredArgsConstructor
public class RunningSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final RunningBlockRepository blockRepository;

    /** CommandLineRunner entry point (startup). */
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by integration tests to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (blockRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID by = owner.getId();

        seedActiveBlock(by);
        seedPlannedBlock(by);
        seedArchivedBlock(by);
    }

    // --- active block "Robbanékonyság 01" — full 8-week structure ------------------------------

    private void seedActiveBlock(UUID by) {
        block(by, "Robbanékonyság 01", "sprint-állóképesség röpihez", "active",
            "2026-06-16", "2026-08-11", 8, 3, null, activeStructure());
    }

    private RunningBlockStructure activeStructure() {
        List<RunWeek> weeks = new ArrayList<>();
        // Sprint progression: rounds + rest second per week.
        int[] sprintRounds = {5, 5, 6, 6, 8, 8, 8, 8};
        int[] sprintRest = {45, 45, 45, 45, 45, 45, 30, 30};
        // Pyramid work-second sequences + rest multiplier per week.
        int[][] pyramidWork = {
            {15, 30, 45, 30, 15},                 // week 1
            {15, 30, 45, 30, 15},                 // week 2
            {15, 30, 45, 45, 30, 15},             // week 3
            {15, 30, 45, 45, 30, 15},             // week 4
            {15, 30, 45, 60, 45, 30, 15},         // week 5
            {15, 30, 45, 60, 45, 30, 15},         // week 6
            {15, 30, 45, 60, 45, 30, 15},         // week 7
            {15, 30, 45, 60, 45, 30, 15},         // week 8
        };
        double[] pyramidRestMul = {2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 1.5, 1.5};

        for (int w = 1; w <= 8; w++) {
            String phase = w <= 4 ? "Alapozás" : "Röpi-specifikus";
            RunPrescribedSession sprint = sprintSession(sprintRounds[w - 1], sprintRest[w - 1]);
            RunPrescribedSession pyramid = pyramidSession(pyramidWork[w - 1], pyramidRestMul[w - 1]);
            weeks.add(new RunWeek(w, phase, List.of(sprint, pyramid)));
        }
        return new RunningBlockStructure(weeks);
    }

    /** Kedd sprint: warmup, rounds×(work 15s / rest), cooldown — rounds = number of (work+rest). */
    private RunPrescribedSession sprintSession(int rounds, int restSec) {
        List<RunSegment> segments = new ArrayList<>();
        segments.add(new RunSegment("warmup", 300, null));
        segments.add(new RunSegment("work", 15, null));
        segments.add(new RunSegment("rest", restSec, null));
        segments.add(new RunSegment("cooldown", 300, null));
        return new RunPrescribedSession(
            "tue-sprint", 1, "Sprint-intervallum", "sprint", new RpeTarget(9, 10), rounds, segments);
    }

    /** Péntek pyramid: warmup, explicit work/rest pairs per the work-second sequence, cooldown. */
    private RunPrescribedSession pyramidSession(int[] workSecs, double restMultiplier) {
        List<RunSegment> segments = new ArrayList<>();
        segments.add(new RunSegment("warmup", 300, null));
        for (int work : workSecs) {
            segments.add(new RunSegment("work", work, null));
            segments.add(new RunSegment("rest", (int) Math.round(work * restMultiplier), null));
        }
        segments.add(new RunSegment("cooldown", 300, null));
        return new RunPrescribedSession(
            "fri-pyramid", 4, "Piramis-intervallum", "pyramid", new RpeTarget(8, 9), null, segments);
    }

    // --- planned block "5K-alapozó" — minimal 1-week structure --------------------------------

    private void seedPlannedBlock(UUID by) {
        RunPrescribedSession steady = new RunPrescribedSession(
            "wed-steady", 2, "Egyenletes futás", "steady", new RpeTarget(4, 5), null,
            List.of(new RunSegment("warmup", 300, null),
                    new RunSegment("work", 1800, null),
                    new RunSegment("cooldown", 300, null)));
        RunningBlockStructure structure =
            new RunningBlockStructure(List.of(new RunWeek(1, "Aerob bázis", List.of(steady))));
        block(by, "5K-alapozó", "aerob bázis", "planned",
            "2026-08-14", "2026-09-24", 6, 0, null, structure);
    }

    // --- archived block "Téli base 02" — minimal 1-week structure -----------------------------

    private void seedArchivedBlock(UUID by) {
        RunPrescribedSession steady = new RunPrescribedSession(
            "wed-steady", 2, "Egyenletes futás", "steady", new RpeTarget(4, 5), null,
            List.of(new RunSegment("warmup", 300, null),
                    new RunSegment("work", 2400, null),
                    new RunSegment("cooldown", 300, null)));
        RunningBlockStructure structure =
            new RunningBlockStructure(List.of(new RunWeek(8, "Téli base", List.of(steady))));
        block(by, "Téli base 02", null, "archived",
            "2026-02-12", "2026-04-09", 8, 8, "7/10 · pulzus-megnyugvás −18mp javult", structure);
    }

    // --- plain builder ------------------------------------------------------------------------

    private RunningBlockEntity block(UUID by, String title, String goal, String status,
        String startDate, String endDate, int weeks, int currentWeek, String summary,
        RunningBlockStructure structure) {
        RunningBlockEntity b = new RunningBlockEntity();
        b.setCreatedBy(by);
        b.setTitle(title);
        b.setGoal(goal);
        b.setKind("interval");
        b.setStatus(status);
        b.setStartDate(LocalDate.parse(startDate));
        b.setEndDate(LocalDate.parse(endDate));
        b.setWeeks(weeks);
        b.setCurrentWeek(currentWeek);
        b.setSummary(summary);
        b.setStructure(structure);
        return blockRepository.save(b);
    }
}

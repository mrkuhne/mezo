package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.LegacySetDistribution;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateDays;
import io.mrkuhne.mezo.feature.train.service.MesoWeeks;
import io.mrkuhne.mezo.feature.train.service.VolumeLedger;
import io.mrkuhne.mezo.feature.train.service.WeekProposalService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * One-time conversion of runs in flight to the amount model (volume engine v2, spec §6.8, mezo-r36n9.65).
 * Until volume engine v2 a run's workout did not prescribe an exercise's stored {@code working_sets}: it
 * re-distributed the per-muscle weekly target ({@code muscle_group_volume_log.current_sets}) across the
 * week's exercises. Since v2 the stored amount IS the prescription. So every run still on
 * {@code volume_model = 1} that is {@code active} or {@code planned} is converted here: the numbers the old
 * engine effectively prescribed ({@link LegacySetDistribution#effective}) are written into
 * {@code exercise.working_sets}, the ledger is re-derived, and the run is marked {@code volume_model = 2}.
 * The person trains the morning after deploy from exactly what the old engine showed the day before.
 *
 * <p>Per run: an active run with volume-log rows gets the distribution written; an active run without rows
 * (feature switch was off, or it predates seeding) keeps its amounts and just gets a ledger; a planned run
 * keeps its amounts and gets no ledger. For active runs the {@code volume_recompute.lastRun} is also guarded:
 * if it is missing, unparsable or older than the run's calendar week, it is stamped {@code "W<calWeek>"} so the
 * new weekly proposal does not make a real step on the first {@code getToday} after the deploy — the first new
 * weekly decision happens at the NEXT week boundary. An existing {@code lastRun} at or past this week is left
 * as is.
 *
 * <p>Idempotent: only {@code volume_model = 1} runs are touched and each is flipped to 2 in the same
 * transaction, so a second start finds nothing; an exercise is written only when its value differs. One
 * transaction per run, the run row locked ({@code SELECT … FOR UPDATE}) like the weekly proposal does, so a
 * concurrent {@code getToday} waits for the commit and re-checks {@code lastRun} on the converted row. A failure
 * logs an error and leaves that run at 1 for the next start; the others still convert.
 *
 * <p>No profile: production runs the {@code demodata} profile ({@code k8s/backend/deployment.yaml}), and this
 * must run there as well as everywhere else. Gated on {@link VolumeProgressionGate} (resolved through
 * {@link ObjectProvider}): with the switch off nothing is converted and runs stay at 1. Archived runs are never
 * touched. {@code @Order(150)}: Liquibase has long finished (schema migration runs while the context
 * refreshes, before any runner), after the owner/train seeds (0/50/100) and before the goal/meal runners.
 *
 * <p>Delete this class and {@link LegacySetDistribution} once no run with {@code volume_model = 1} and status
 * active/planned remains in production.
 */
@Slf4j
@Component
@Order(150)
@RequiredArgsConstructor
public class VolumeAmountMigrationRunner implements ApplicationRunner {

    static final short LEGACY = 1;
    static final short AMOUNT_MODEL = 2;

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final VolumeLedger volumeLedger;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;
    private final PlatformTransactionManager transactionManager;

    @Override
    public void run(ApplicationArguments args) {
        run();
    }

    /** No-arg entry point (the integration test's). Returns how many runs were converted. */
    public int run() {
        if (volumeGate.getIfAvailable() == null) {
            log.info("volume amount migration: volume progression is switched off, runs stay on the old model");
            return 0;
        }
        List<MesocycleEntity> candidates = mesocycleRepository
            .findByVolumeModelAndStatusInAndDeletedFalse(LEGACY, List.of("active", "planned"));
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        int converted = 0;
        int failed = 0;
        for (MesocycleEntity candidate : candidates) {
            UUID runId = candidate.getId();
            UUID owner = candidate.getCreatedBy();
            try {
                Boolean done = tx.execute(status -> convert(owner, runId));
                if (Boolean.TRUE.equals(done)) {
                    converted++;
                }
            } catch (RuntimeException e) {
                failed++;
                log.error("volume amount migration: run {} NOT converted, stays on the old model until the next start",
                    runId, e);
            }
        }
        log.info("volume amount migration: {} run(s) converted, {} failed, {} candidate(s)",
            converted, failed, candidates.size());
        return converted;
    }

    /** One run, inside its own transaction. {@code false} = nothing to do (gone, archived, or already converted). */
    private boolean convert(UUID owner, UUID runId) {
        MesocycleEntity run = mesocycleRepository.findLockedByIdAndCreatedByAndDeletedFalse(runId, owner).orElse(null);
        if (run == null || run.getVolumeModel() != LEGACY
            || !("active".equals(run.getStatus()) || "planned".equals(run.getStatus()))) {
            return false;
        }
        boolean active = "active".equals(run.getStatus());
        int changedExercises = 0;
        boolean stamped = false;
        if (active) {
            changedExercises = writeEffectiveSets(owner, runId);
            stamped = guardLastRun(run);
        }
        run.setVolumeModel(AMOUNT_MODEL); // BEFORE the sync: the ledger skips unconverted runs
        mesocycleRepository.save(run);
        if (active) {
            volumeLedger.sync(owner, runId);
        }
        log.info("volume amount migration: run {} ({}) converted, {} exercise(s) changed, lastRun stamped: {}",
            runId, run.getStatus(), changedExercises, stamped);
        return true;
    }

    private int writeEffectiveSets(UUID owner, UUID runId) {
        List<MuscleGroupVolumeLogEntity> logs =
            volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(runId));
        if (logs.isEmpty()) {
            return 0; // the amounts stand as they are
        }
        List<UUID> templateDayIds = MesoTemplateDays.ids(
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(owner, List.of(runId)));
        if (templateDayIds.isEmpty()) {
            return 0;
        }
        List<ExerciseEntity> exercises =
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, templateDayIds);
        Map<UUID, Integer> effective = LegacySetDistribution.effective(exercises, logs);
        int changed = 0;
        for (ExerciseEntity e : exercises) {
            Integer sets = effective.get(e.getId());
            if (sets != null && !sets.equals(e.getWorkingSets())) {
                e.setWorkingSets(sets);
                exerciseRepository.save(e);
                changed++;
            }
        }
        return changed;
    }

    /**
     * Only when there is NO trustworthy record (null record, blank or unparsable {@code lastRun}): this
     * calendar week is taken as rolled — {@code lastRun = "W<calWeek>"} and {@code currentWeek = calWeek}, like
     * every other writer of {@code lastRun} — so the first open does not make a real step from a week nobody
     * can vouch for. One step may be skipped once because of that. A VALID {@code lastRun} (equal, ahead or
     * older) is left exactly as it is, and so is {@code currentWeek}: the new engine takes a pending week's step
     * itself, from the converted amounts, on the next open.
     */
    private boolean guardLastRun(MesocycleEntity run) {
        VolumeRecomputeJson current = run.getVolumeRecompute();
        if (current != null && current.lastRun() != null && !current.lastRun().isBlank()
            && WeekProposalService.parseLastRunWeek(current) > 0) {
            return false;
        }
        int calWeek = MesoWeeks.clampWeek(run.getStartDate(), run.getWeeks());
        run.setCurrentWeek(calWeek);
        String lastRun = "W" + calWeek;
        run.setVolumeRecompute(current == null
            ? new VolumeRecomputeJson(lastRun, "W" + (calWeek + 1), "weekly-rollover", List.of())
            : new VolumeRecomputeJson(lastRun, current.nextRun(), current.trigger(), current.changes()));
        return true;
    }
}

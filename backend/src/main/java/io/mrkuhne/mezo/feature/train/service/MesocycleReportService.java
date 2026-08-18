package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.Medal;
import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.feature.train.MesoReviewGate;
import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.MesoReportJson;
import io.mrkuhne.mezo.feature.train.mapper.MesoReportMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The end-of-mesocycle FROZEN report (mezo-meyc.2, spec §2). Computed once, inside the close
 * transaction ({@code TrainService.closeMesocycle}), and persisted as a typed jsonb snapshot on
 * {@code mesocycle_report} — so a historical report never drifts when the data underneath it later
 * changes (a set edited months on, a renamed catalog entry, a re-tuned volume engine).
 *
 * <p>Four deterministic blocks, all scoped to THIS run's completed meso-origin instances inside the
 * close window {@code [startDate, closedAt]} ({@code closedAt} falling back to {@code endDate} for a
 * legacy archived run that was never explicitly closed):
 *
 * <ol>
 *   <li><b>Adherence</b> — non-empty template days × elapsed meso-weeks vs the instances actually
 *       completed, plus the weeks that carried at least one.</li>
 *   <li><b>Volume</b> — {@link VolumeArcService#arc} frozen verbatim.</li>
 *   <li><b>Strength</b> — per exercise IDENTITY (catalog id, else exact name — the
 *       {@code ExerciseHistoryResolver}/{@code MedalService} idiom), the first trained meso-week's
 *       top working set vs the last one's.</li>
 *   <li><b>Records</b> — the medals earned inside the run, derived by replaying the existing
 *       {@link MedalService} evaluator (never stored medal rows — there are none).</li>
 * </ol>
 *
 * <p>The AI narrative half of the report is computed asynchronously by the companion's generator
 * (S3, {@code mezo-meyc.3}, task 15): {@code aiEvalStatus} is left {@code pending} by
 * {@link #computeAndStore} and {@link #getReport}'s {@code aiEvalEnabled} reports the presence of
 * the {@link MesoReviewGate} marker bean — the FE's signal to show the AI section and poll
 * {@code pending}, or hide it entirely when the switch is off. The two entry points that ever
 * reach {@link #computeAndStore} — {@code TrainService.closeMesocycle}'s REAL-close branch and
 * {@link #regenerate} — each publish {@link MesocycleClosed} right after the report row is
 * persisted, the companion generator's AFTER_COMMIT trigger.
 */
@Service
@RequiredArgsConstructor
public class MesocycleReportService {

    /** Top strength/record entries the report carries (the FE shows the biggest jumps). */
    private static final int TOP_HIGHLIGHTS = 5;

    private static final BigDecimal THIRTY = BigDecimal.valueOf(30);

    /** Shape-safe stand-in if a row ever carries a null {@code report} jsonb (nullable column). */
    private static final MesoReportJson EMPTY_REPORT = new MesoReportJson(
        new MesoReportJson.Adherence(0, 0, 0, 0, 0), null, List.of(),
        new MesoReportJson.Records(0, List.of()));

    private final MesocycleRepository mesocycleRepository;
    private final MesocycleReportRepository reportRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;
    private final VolumeArcService volumeArcService;
    private final MedalService medalService;
    private final MesoReportMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectProvider<MesoReviewGate> reviewGate;

    /**
     * Computes the deterministic report for {@code run} and UPSERTS it onto the run's single
     * {@code mesocycle_report} row ({@code uq_mesocycle_report_mesocycle}), resetting the AI half to
     * {@code pending}. The owner's {@code selfEval} is NOT touched — it is captured by the close
     * path and must survive a later regenerate.
     *
     * <p>Callers: {@code TrainService.closeMesocycle} (joins the close transaction, so the archive
     * flip and the report land together or not at all) and {@link #regenerate}.
     */
    @Transactional
    public MesocycleReportEntity computeAndStore(MesocycleEntity run) {
        UUID createdBy = run.getCreatedBy();
        LocalDate start = run.getStartDate();
        int weeks = run.getWeeks();
        LocalDate windowEnd = closeWindowEnd(run);
        int weeksElapsed = MesoWeeks.weekOf(start, windowEnd, weeks);

        List<WorkoutSessionEntity> instances = workoutSessionRepository
            .findCompletedMesoInstancesInWindow(createdBy, run.getId(), start, windowEnd);

        MesoReportJson report = new MesoReportJson(
            adherence(createdBy, run, weeksElapsed, instances),
            // The arc's future-week mask must agree with adherence: a run whose `currentWeek` went
            // stale (it only advances on the weekly rollover) would otherwise freeze week 2 as
            // "not reached" while adherence counts a week-2 session.
            mapper.toArcJson(volumeArcService.arc(
                createdBy, run.getId(), Math.max(run.getCurrentWeek(), weeksElapsed))),
            strength(createdBy, start, weeks, instances),
            records(createdBy, instances));

        MesocycleReportEntity row = reportRepository
            .findByMesocycleIdAndCreatedByAndDeletedFalse(run.getId(), createdBy)
            .orElseGet(() -> {
                MesocycleReportEntity fresh = new MesocycleReportEntity();
                fresh.setCreatedBy(createdBy); // server-side ownership — never from the client
                fresh.setMesocycleId(run.getId());
                return fresh;
            });
        row.setReport(report);
        // A recompute invalidates the WHOLE AI half — narrative AND the lifestyle context, both of
        // which were computed against the OLD numbers/window (mezo-meyc.3). Leaving a stale context
        // beside fresh numbers is the worse failure: with the meso-review switch off nothing would
        // ever overwrite it, so the report page would show last-window buckets next to this-window
        // results. The companion's AFTER_COMMIT generator re-populates both (or, switch off, just the
        // context) from the `pending` status below.
        row.setContext(null);
        row.setAiEval(null);
        row.setAiEvalGeneratedAt(null);
        row.setAiEvalStatus(MesocycleReportEntity.AI_EVAL_STATUS_PENDING);
        return reportRepository.save(row);
    }

    /** The run's frozen report. A run with no report yet is a 404, same as a missing/foreign run. */
    public MesocycleReportResponse getReport(UUID createdBy, UUID mesoId) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), createdBy);
        MesocycleReportEntity row = reportRepository
            .findByMesocycleIdAndCreatedByAndDeletedFalse(mesoId, createdBy)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_REPORT_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        return toResponse(run, row);
    }

    /**
     * Recomputes the deterministic report of an ARCHIVED run and resets the AI half to
     * {@code pending}, then publishes {@link MesocycleClosed} — the companion generator's
     * re-generation trigger for the narrative it regenerates asynchronously. Also the LEGACY
     * BACKFILL path: an archived run that predates the report feature has no {@code closedAt}, so
     * the window falls back to {@code endDate} (see {@link #closeWindowEnd}). An open/planned run
     * has nothing to freeze yet — 409 (never reaches the publish).
     */
    @Transactional
    public void regenerate(UUID createdBy, UUID mesoId) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), createdBy);
        if (!"archived".equals(run.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_NOT_CLOSED").build(), HttpStatus.CONFLICT);
        }
        computeAndStore(run);
        // Every accepted regenerate is a fresh re-generation trigger for the companion AI-review
        // generator (mezo-meyc.3) — the report row is already persisted at this point.
        eventPublisher.publishEvent(new MesocycleClosed(createdBy, mesoId));
    }

    // ── computation ─────────────────────────────────────────────────────────────

    /**
     * The close window's upper bound: the close instant's local date, or — for a legacy archived run
     * that was never explicitly closed (auto-archived by starting the next run, or predating this
     * feature) — the run's planned {@code endDate}. Clamped to at least {@code startDate} so a
     * malformed range can never invert the window.
     */
    private LocalDate closeWindowEnd(MesocycleEntity run) {
        LocalDate end = run.getClosedAt() != null
            ? run.getClosedAt().atZone(ZoneId.systemDefault()).toLocalDate()
            : run.getEndDate();
        return end.isBefore(run.getStartDate()) ? run.getStartDate() : end;
    }

    /**
     * Plan vs reality. {@code plannedSessions} counts only template days that actually carry
     * exercises (an empty day is not a session anyone could have done) times {@code weeksElapsed} —
     * {@code MesoWeeks.weekOf} against the close window's end, which at close time IS
     * {@code clampWeek(startDate, weeks)} and stays stable if the report is regenerated later.
     */
    private MesoReportJson.Adherence adherence(UUID createdBy, MesocycleEntity run,
            int weeksElapsed, List<WorkoutSessionEntity> instances) {
        int plannedSessions = countNonEmptyTemplateDays(createdBy, run.getId()) * weeksElapsed;
        int completedSessions = instances.size();
        int completedWeeks = (int) instances.stream()
            .map(i -> MesoWeeks.weekOf(run.getStartDate(), i.getDate(), run.getWeeks()))
            .distinct().count();
        int completionPct = plannedSessions == 0
            ? 0
            : (int) Math.round(100.0 * completedSessions / plannedSessions);
        return new MesoReportJson.Adherence(
            plannedSessions, completedSessions, run.getWeeks(), completedWeeks, completionPct);
    }

    private int countNonEmptyTemplateDays(UUID createdBy, UUID mesoId) {
        List<UUID> dayIds = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId)).stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .map(WorkoutSessionEntity::getId)
            .toList();
        if (dayIds.isEmpty()) {
            return 0;
        }
        return (int) exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, dayIds).stream()
            .map(e -> e.getWorkoutSessionId())
            .distinct().count();
    }

    /**
     * Per exercise IDENTITY: the top working set of the first meso-week it was trained in vs the top
     * set of the last one. Only identities trained in at least TWO distinct weeks get an entry — a
     * single week carries no progression to report. Ordered by relative gain, best first, entries
     * with no comparable percentage last.
     */
    private List<MesoReportJson.StrengthDelta> strength(UUID createdBy, LocalDate start, int weeks,
            List<WorkoutSessionEntity> instances) {
        if (instances.isEmpty()) {
            return List.of();
        }
        Map<UUID, LocalDate> dateByInstance = instances.stream()
            .collect(Collectors.toMap(WorkoutSessionEntity::getId, WorkoutSessionEntity::getDate,
                (a, b) -> a));
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findWorkingSetsInSessions(createdBy, List.copyOf(dateByInstance.keySet()));
        if (sets.isEmpty()) {
            return List.of();
        }
        // Identity resolution over ALL exercise rows INCLUDING soft-deleted ones: a mid-run day edit
        // replaces the template rows while their logged sets stay live (mezo-eq4w).
        Map<UUID, ExerciseIdentityRow> rowById = exerciseRepository
            .findIdentityRowsIncludingDeleted(createdBy).stream()
            .collect(Collectors.toMap(ExerciseIdentityRow::getId, r -> r));

        // TreeMap per identity: the week keys must be ORDERED — first/last bucket is the whole point.
        Map<String, TreeMap<Integer, List<ExerciseSetEntity>>> byIdentityWeek = new LinkedHashMap<>();
        Map<String, ExerciseIdentityRow> displayByIdentity = new HashMap<>();
        for (ExerciseSetEntity set : sets) {
            ExerciseIdentityRow row = rowById.get(set.getExerciseId());
            LocalDate date = dateByInstance.get(set.getWorkoutSessionId());
            if (row == null || date == null) {
                continue;
            }
            String key = identityKey(row);
            byIdentityWeek.computeIfAbsent(key, k -> new TreeMap<>())
                .computeIfAbsent(MesoWeeks.weekOf(start, date, weeks), w -> new ArrayList<>())
                .add(set);
            // display fields come from the most recent occurrence of the identity (MedalService idiom)
            displayByIdentity.merge(key, row, (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b);
        }

        Map<UUID, ExerciseCatalogEntity> catalog = exerciseCatalogRepository.findAllById(
                displayByIdentity.values().stream()
                    .map(ExerciseIdentityRow::getCatalogId).filter(Objects::nonNull).toList())
            .stream().collect(Collectors.toMap(ExerciseCatalogEntity::getId, c -> c));

        List<MesoReportJson.StrengthDelta> deltas = new ArrayList<>();
        byIdentityWeek.forEach((key, weekBuckets) -> {
            if (weekBuckets.size() < 2) {
                return; // one week trained ⇒ nothing to compare
            }
            int firstWeek = weekBuckets.firstKey();
            int lastWeek = weekBuckets.lastKey();
            TopSet first = topSetOf(weekBuckets.get(firstWeek));
            TopSet last = topSetOf(weekBuckets.get(lastWeek));
            ExerciseIdentityRow display = displayByIdentity.get(key);
            ExerciseCatalogEntity cat =
                display.getCatalogId() != null ? catalog.get(display.getCatalogId()) : null;
            deltas.add(new MesoReportJson.StrengthDelta(
                cat != null ? cat.getName() : display.getName(),
                display.getCatalogId(),
                cat != null ? cat.getMuscle() : display.getMuscle(),
                firstWeek, lastWeek,
                toDouble(first.weightKg()), first.reps(),
                toDouble(last.weightKg()), last.reps(),
                round(first.e1rm(), 2), round(last.e1rm(), 2),
                deltaKg(first, last), deltaPct(first, last)));
        });
        deltas.sort(Comparator
            .comparing(MesoReportJson.StrengthDelta::deltaPct,
                Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(MesoReportJson.StrengthDelta::exerciseName));
        return List.copyOf(deltas);
    }

    /**
     * The medals earned inside the run, DERIVED by replaying {@link MedalService} over the owner's
     * set history and keeping the awards that landed in this run's instances — nothing is read from
     * a medal table (there is none), which is why the block has to be frozen here at all.
     */
    private MesoReportJson.Records records(UUID createdBy, List<WorkoutSessionEntity> instances) {
        Set<UUID> instanceIds = instances.stream()
            .map(WorkoutSessionEntity::getId).collect(Collectors.toSet());
        List<Medal> medals = medalService.forSessions(createdBy, instanceIds);
        List<MesoReportJson.RecordHighlight> top = medals.stream()
            .limit(TOP_HIGHLIGHTS)
            .map(m -> new MesoReportJson.RecordHighlight(
                m.getExerciseName(), m.getType().getValue(), m.getDate(), toDouble(m.getValue())))
            .toList();
        return new MesoReportJson.Records(medals.size(), top);
    }

    // ── strength helpers ────────────────────────────────────────────────────────

    /** Records/challenge identity idiom: catalog id when linked, else the exact name. */
    private static String identityKey(ExerciseIdentityRow row) {
        return row.getCatalogId() != null ? "c:" + row.getCatalogId() : "n:" + row.getName();
    }

    /** One week bucket's best working set. {@code e1rm} is null for a weightless (bodyweight) set. */
    private record TopSet(BigDecimal weightKg, int reps, Double e1rm) {}

    /**
     * Best set of a bucket by Epley e1RM. A weightless set carries no e1RM, so it ranks BELOW every
     * loaded set and only competes on reps — a bodyweight-only week is compared by reps alone.
     */
    private static TopSet topSetOf(List<ExerciseSetEntity> bucket) {
        ExerciseSetEntity best = bucket.stream()
            .max(Comparator
                .comparing(MesocycleReportService::e1rm,
                    Comparator.nullsFirst(Comparator.<Double>naturalOrder()))
                .thenComparing(ExerciseSetEntity::getReps)
                .thenComparing(s -> s.getId().toString()))
            .orElseThrow();
        return new TopSet(best.getWeightKg(), best.getReps(), e1rm(best));
    }

    /** Epley: {@code weight × (1 + reps/30)}; null (not zero) when the set carries no load. */
    private static Double e1rm(ExerciseSetEntity set) {
        if (set.getWeightKg() == null) {
            return null;
        }
        return set.getWeightKg()
            .multiply(BigDecimal.valueOf(30L + set.getReps()))
            .divide(THIRTY, 6, RoundingMode.HALF_UP)
            .doubleValue();
    }

    /** Absolute gain in the LOAD actually lifted; null when either end was weightless. */
    private static Double deltaKg(TopSet first, TopSet last) {
        if (first.weightKg() == null || last.weightKg() == null) {
            return null;
        }
        return round(last.weightKg().subtract(first.weightKg()).doubleValue(), 2);
    }

    /**
     * Relative gain measured on e1RM, not on raw load: the same weight for more reps IS progress and
     * must not read as 0%. Null when either end was weightless (nothing comparable to divide by).
     */
    private static Double deltaPct(TopSet first, TopSet last) {
        if (first.e1rm() == null || last.e1rm() == null || first.e1rm() == 0.0) {
            return null;
        }
        return round((last.e1rm() - first.e1rm()) / first.e1rm() * 100.0, 1);
    }

    private static Double round(Double value, int scale) {
        return value == null ? null
            : BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).doubleValue();
    }

    private static Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    // ── response assembly ───────────────────────────────────────────────────────

    private MesocycleReportResponse toResponse(MesocycleEntity run, MesocycleReportEntity row) {
        MesoReportJson report = row.getReport() != null ? row.getReport() : EMPTY_REPORT;
        return MesocycleReportResponse.builder()
            .mesocycleId(run.getId())
            .templateId(run.getTemplateId())
            .title(run.getTitle())
            .startDate(run.getStartDate())
            .endDate(run.getEndDate())
            .closedAt(run.getClosedAt() == null ? null : run.getClosedAt().atOffset(ZoneOffset.UTC))
            .weeks(run.getWeeks())
            .selfEval(row.getSelfEval())
            .aiEval(row.getAiEval())
            .aiEvalStatus(MesocycleReportResponse.AiEvalStatusEnum.fromValue(row.getAiEvalStatus()))
            .aiEvalGeneratedAt(row.getAiEvalGeneratedAt() == null
                ? null : row.getAiEvalGeneratedAt().atOffset(ZoneOffset.UTC))
            .aiEvalEnabled(reviewGate.getIfAvailable() != null)
            .adherence(mapper.toAdherence(report.adherence()))
            .volume(report.volume() == null ? null : mapper.toArc(report.volume()))
            .strength(mapper.toStrength(report.strength()))
            .records(mapper.toRecords(report.records()))
            .context(mapper.toContext(row.getContext()))
            .build();
    }
}

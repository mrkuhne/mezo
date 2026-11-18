package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason;
import io.mrkuhne.mezo.feature.train.service.WeeklySignalReader.GroupSignals;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly proposal (volume engine v2, spec §6.4): once per calendar week of an active run, per
 * trained counting muscle group a {@link VolumeDecider} decision, turned into one line per changed
 * exercise ({@link SetSlots} picks where a set goes or comes from), stored as a {@code weekly}
 * {@link MesoWeekProposalEntity}, followed by the weight / rep preview lines of {@link LoadLinePreview}
 * — and, in {@code auto} mode (the only one built so far), applied
 * at once by writing the exercises' {@code working_sets}. The ledger is then re-derived and the
 * run's {@code volume_recompute} audit and {@code currentWeek} advance, in the shapes the web
 * readers already know.
 *
 * <p>Idempotent per calendar week twice over: {@code volume_recompute.lastRun} and the partial
 * unique index on a run's weekly proposal. Gate off: does nothing.
 */
@Service
@RequiredArgsConstructor
public class WeekProposalService {

    static final String TRIGGER_LABEL = "weekly-rollover";
    private static final String PHASE_DELOAD = "Deload";
    private static final String MODE_AUTO = "auto";

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final MesoWeekProposalRepository proposalRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WeeklySignalReader signalReader;
    private final EnergyBalancePort energyBalance;
    private final VolumeLedger volumeLedger;
    private final TemplatePlan templatePlan;
    private final VolumeProperties props;
    private final MuscleProgressReader muscleProgress;
    private final LoadLinePreview loadLinePreview;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;

    /**
     * What happened to one muscle group this week: the audit's {@code Change} is built from it.
     * {@code before} is the plan as found, {@code restored} after the post-deload restore,
     * {@code after} after the week's decision; {@code keptOwn} = a deload-week edit of the owner's stood.
     */
    record GroupOutcome(String group, int before, int restored, int after, VolumeDecider.Result result,
                        boolean noSlot, boolean keptOwn, boolean stalled) {
        boolean changed() {
            return after != before;
        }
    }

    /** A built (persisted, not yet applied) proposal and the per-group outcomes behind it. */
    record Draft(MesoWeekProposalEntity proposal, Map<String, GroupOutcome> outcomes) {}

    /**
     * Serialised per run: the run row is locked ({@code SELECT … FOR UPDATE}) and the week re-checked
     * on the locked row, so a second opener of the same new week waits and then sees it stamped. The
     * caller's {@code meso} object gets the resulting {@code currentWeek} / {@code volumeRecompute}.
     */
    @Transactional
    public void generateIfDue(UUID createdBy, MesocycleEntity meso) {
        if (volumeGate.getIfAvailable() == null || meso.getVolumeModel() < 2) {
            return; // an unconverted run belongs to VolumeAmountMigrationRunner until it is migrated
        }
        if (MesoWeeks.clampWeek(meso.getStartDate(), meso.getWeeks()) <= parseLastRunWeek(meso.getVolumeRecompute())) {
            return; // cheap pre-check on the caller's copy: this calendar week is already recorded
        }
        MesocycleEntity run = mesocycleRepository
            .findLockedByIdAndCreatedByAndDeletedFalse(meso.getId(), createdBy).orElse(null);
        if (run == null || run.getVolumeModel() < 2) {
            return; // re-checked on the locked row: the migration may have just converted — or not yet
        }
        try {
            generateLocked(createdBy, run);
        } finally {
            if (run != meso) {
                meso.setCurrentWeek(run.getCurrentWeek());
                meso.setVolumeRecompute(run.getVolumeRecompute());
            }
        }
    }

    private void generateLocked(UUID createdBy, MesocycleEntity run) {
        int calWeek = MesoWeeks.clampWeek(run.getStartDate(), run.getWeeks());
        if (calWeek <= parseLastRunWeek(run.getVolumeRecompute())) {
            return; // a concurrent opener recorded it while we waited for the lock
        }
        if (calWeek <= 1) {
            // Week 1: the plan stands. Recorded once, nothing generated.
            stamp(run, calWeek, List.of());
            return;
        }
        if (proposalRepository.findWeekly(createdBy, run.getId(), calWeek).isPresent()) {
            // The week was decided before (a kímélő step-back moved the run back and the calendar
            // is repeating it, or the unique index backstop): record it, regenerate nothing.
            stamp(run, calWeek, List.of());
            return;
        }
        Draft draft = build(createdBy, run, calWeek);
        if (MODE_AUTO.equals(props.weeklyReview().mode())) {
            apply(draft.proposal());
        } // manual mode is a later slice: the proposal stays pending and nothing is applied

        volumeLedger.sync(createdBy, run.getId());
        appendAdjustments(createdBy, run.getId(), calWeek, draft.outcomes());
        stamp(run, calWeek, draft.outcomes().values().stream().map(WeekProposalService::change).toList());
    }

    /**
     * Decides every participating group on a working copy of the week's slots (so consecutive picks
     * see each other) and persists the proposal as {@code pending}, lines undecided.
     */
    Draft build(UUID createdBy, MesocycleEntity meso, int calWeek) {
        List<TemplatePlan.Row> plan = templatePlan.rows(createdBy, meso.getId());
        Map<String, List<TemplatePlan.Row>> byGroup = new TreeMap<>();
        plan.stream().filter(r -> r.group() != null)
            .forEach(r -> byGroup.computeIfAbsent(r.group(), k -> new ArrayList<>()).add(r));

        Map<String, GroupSignals> signals = signalReader.read(createdBy, meso, calWeek);
        // Styled runs only (empty otherwise): groups whose every exercise held for the stall window — audit only.
        Set<String> stalledGroups = muscleProgress.stalledGroups(createdBy, meso, calWeek - 1);
        boolean deficit = energyBalance.isInDeficit(createdBy, LocalDate.now());
        boolean deloadPhase = isDeloadPhase(meso, calWeek);

        Map<UUID, Integer> working = new HashMap<>();
        plan.forEach(r -> working.put(r.exercise().getId(), r.exercise().getWorkingSets()));
        Map<UUID, Integer> fromSets = new LinkedHashMap<>(); // insertion order = line order
        Map<UUID, List<String>> lineReasons = new HashMap<>();
        List<RestoreEntryJson> restore = new ArrayList<>();
        Map<String, GroupOutcome> outcomes = new LinkedHashMap<>();
        Map<String, VolumeBands.Band> bands = new HashMap<>();

        Map<String, Integer> beforeByGroup = new HashMap<>();
        byGroup.forEach((group, rows) -> beforeByGroup.put(group, sum(rows, working)));
        Set<String> keptOwn = restoreAfterDeload(createdBy, meso.getId(), calWeek, plan, working, fromSets, lineReasons);

        byGroup.forEach((group, rows) -> {
            int before = beforeByGroup.get(group);
            int restored = sum(rows, working);
            GroupSignals s = signals.getOrDefault(group, new GroupSignals(0, false, false, false, false));
            PriorityTier tier = PriorityTier.of(meso.getMusclePriorities(), group);
            VolumeBands.Band band = VolumeBands.band(props.baselines().get(group), tier,
                meso.isSportLoaded(group), props.bands());
            bands.put(group, band);
            VolumeDecider.Result result = VolumeDecider.decide(new VolumeDecider.Input(
                calWeek, tier, band,
                restored, before, s.logged(), s.grind(), s.tooMuch(), s.jointPain(), s.sorenessHigh(),
                deficit, deloadPhase, props.stepEmphasize(), props.stepGrow(), props.stepDeficit()));
            List<String> reasons = result.reasons().stream().map(WeekProposalService::code).toList();
            boolean noSlot = false;
            switch (result.lever()) {
                case UP -> {
                    int placed = 0;
                    for (int i = 0; i < result.delta(); i++) {
                        Optional<UUID> pick = SetSlots.pickUp(slots(rows, working),
                            props.bands().exerciseCap(), props.bands().sessionCap());
                        if (pick.isEmpty()) {
                            break;
                        }
                        move(pick.get(), +1, working, fromSets, lineReasons, reasons);
                        placed++;
                    }
                    noSlot = placed == 0 && result.delta() > 0;
                }
                case DOWN -> SetSlots.pickDown(slots(rows, working))
                    .ifPresent(id -> move(id, -1, working, fromSets, lineReasons, reasons));
                case DELOAD -> rows.forEach(r -> {
                    UUID id = r.exercise().getId();
                    int sets = working.get(id);
                    int halved = Math.max(1, BigDecimal.valueOf(sets).multiply(props.deloadFraction())
                        .setScale(0, RoundingMode.CEILING).intValue());
                    if (halved != sets) {
                        fromSets.putIfAbsent(id, sets);
                        lineReasons.put(id, reasons);
                        working.put(id, halved);
                        restore.add(new RestoreEntryJson(id, r.exercise().getCatalogId(), r.exercise().getName(),
                            r.dayIndex(), sets, halved));
                    }
                });
                default -> { } // HOLD / NONE: no line
            }
            outcomes.put(group, new GroupOutcome(group, before, restored, sum(rows, working), result, noSlot,
                keptOwn.contains(group), stalledGroups.contains(group)));
        });

        Map<UUID, TemplatePlan.Row> rowById = plan.stream()
            .collect(Collectors.toMap(r -> r.exercise().getId(), r -> r, (a, b) -> a));
        List<WeekProposalLineJson> lines = new ArrayList<>();
        fromSets.forEach((id, from) -> {
            int to = working.get(id);
            if (to == from) {
                return; // moved up and back down again: no net change
            }
            TemplatePlan.Row row = rowById.get(id);
            lines.add(new WeekProposalLineJson(UUID.randomUUID().toString(), id, row.exercise().getName(),
                row.dayIndex(), row.group(), WeekProposalLineJson.KIND_SETS, from, to, lineReasons.get(id), null,
                row.dayName(), null, null));
        });
        // Weight / rep lines after the set lines: a preview of the week's load progression, never written.
        lines.addAll(loadLinePreview.lines(createdBy, meso, calWeek, plan, deloadPhase));
        List<WeekProposalGroupJson> groups = outcomes.values().stream()
            .map(o -> groupJson(o, PriorityTier.of(meso.getMusclePriorities(), o.group()), bands.get(o.group())))
            .toList();

        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(createdBy);
        proposal.setMesocycleId(meso.getId());
        proposal.setWeek(calWeek);
        proposal.setKind(MesoWeekProposalEntity.KIND_WEEKLY);
        proposal.setStatus(MesoWeekProposalEntity.STATUS_PENDING);
        proposal.setLines(lines);
        proposal.setRestore(restore.isEmpty() ? null : restore);
        proposal.setGroups(groups);
        return new Draft(proposalRepository.save(proposal), outcomes);
    }

    /**
     * Accepts every line and writes a set line's {@code to} onto the exercise row; a weight / rep line
     * is accepted without a write (the session's read-time prescription carries it). A set line whose
     * exercise row no longer exists is {@code kept} and skipped — never an error. Fills {@code planAfter} with
     * every counting exercise's sets after the write.
     */
    void apply(MesoWeekProposalEntity proposal) {
        UUID createdBy = proposal.getCreatedBy();
        List<WeekProposalLineJson> decided = new ArrayList<>();
        List<ExerciseEntity> written = new ArrayList<>();
        for (WeekProposalLineJson line : proposal.getLines()) {
            if (!WeekProposalLineJson.KIND_SETS.equals(line.kind())) {
                decided.add(line.withDecision(WeekProposalLineJson.DECISION_ACCEPTED)); // load line: no write
                continue;
            }
            Optional<ExerciseEntity> row = exerciseRepository.findById(line.exerciseId())
                .filter(e -> createdBy.equals(e.getCreatedBy()));
            if (row.isEmpty()) {
                decided.add(line.withDecision(WeekProposalLineJson.DECISION_KEPT));
                continue;
            }
            row.get().setWorkingSets(line.to());
            written.add(row.get());
            decided.add(line.withDecision(WeekProposalLineJson.DECISION_ACCEPTED));
        }
        exerciseRepository.saveAll(written);

        Map<String, Integer> planAfter = new LinkedHashMap<>();
        templateExercises(createdBy, proposal.getMesocycleId()).stream()
            .filter(ExerciseEntity::isCountsTowardVolume)
            .forEach(e -> planAfter.put(e.getId().toString(), e.getWorkingSets()));

        proposal.setLines(decided);
        proposal.setPlanAfter(planAfter);
        proposal.setStatus(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        proposal.setDecidedAt(Instant.now());
        proposalRepository.save(proposal);

        // The deload this week gave back from is consumed: no later week can restore it again.
        deloadToRestore(createdBy, proposal.getMesocycleId(), proposal.getWeek()).ifPresent(deload -> {
            deload.setRestore(List.of());
            proposalRepository.save(deload);
        });
    }

    // ── steps ─────────────────────────────────────────────────────────────────────────────────

    /** The latest applied weekly proposal before {@code week}, when it still carries a restore. */
    private Optional<MesoWeekProposalEntity> deloadToRestore(UUID createdBy, UUID mesoId, int week) {
        return proposalRepository.findLatestApplied(createdBy, mesoId, week)
            .filter(p -> p.getRestore() != null && !p.getRestore().isEmpty());
    }

    /**
     * The week after a deload starts from the pre-deload amounts (spec §6.4 rule 2) — as LINES of
     * this week's proposal, on the working copy, before the weekly decisions. Each entry finds its
     * current row by id, else by identity on the same template day (a day edit re-mints rows). A row
     * the owner changed since the deload keeps his number; a restore never breaks the exercise or the
     * session cap (as much as fits, never below the current amount).
     *
     * @return the groups where an owner's deload-week edit stood
     */
    private Set<String> restoreAfterDeload(UUID createdBy, UUID mesoId, int calWeek, List<TemplatePlan.Row> plan,
                                           Map<UUID, Integer> working, Map<UUID, Integer> fromSets,
                                           Map<UUID, List<String>> lineReasons) {
        List<RestoreEntryJson> entries = deloadToRestore(createdBy, mesoId, calWeek)
            .map(MesoWeekProposalEntity::getRestore).orElse(List.of());
        Set<String> keptOwn = new HashSet<>();
        Map<RestoreEntryJson, TemplatePlan.Row> pairs = TemplatePlan.matchEntries(entries, plan);

        // The owner's deload-week edit stands; the rest are eligible to return to their own number.
        Map<RestoreEntryJson, TemplatePlan.Row> eligible = new LinkedHashMap<>();
        pairs.forEach((entry, row) -> {
            if (working.get(row.exercise().getId()) != entry.deloadSets()) {
                keptOwn.add(row.group());
            } else {
                eligible.put(entry, row);
            }
        });

        // Per group-day: the caps only limit a restore BEYOND the day's pre-deload state. When every
        // eligible entry returning to its own number keeps the day within max(session cap, what the
        // entries summed to before the deload), each one simply returns (no cap can cut his number).
        Map<String, Boolean> dayFullyRestorable = new HashMap<>();
        for (TemplatePlan.Row row : plan) {
            if (row.group() == null) {
                continue;
            }
            String dayKey = row.group() + "|" + row.dayIndex();
            dayFullyRestorable.computeIfAbsent(dayKey, k -> {
                int after = plan.stream().filter(r -> r.group() != null && dayKeyOf(r).equals(k))
                    .mapToInt(r -> {
                        int cur = working.get(r.exercise().getId());
                        return eligible.entrySet().stream()
                            .filter(e -> e.getValue() == r).mapToInt(e -> Math.max(cur, e.getKey().sets()))
                            .findFirst().orElse(cur);
                    }).sum();
                int before = eligible.entrySet().stream().filter(e -> dayKeyOf(e.getValue()).equals(k))
                    .mapToInt(e -> e.getKey().sets()).sum();
                return after <= Math.max(props.bands().sessionCap(), before);
            });
        }

        eligible.forEach((entry, row) -> {
            UUID id = row.exercise().getId();
            int current = working.get(id);
            int to;
            if (dayFullyRestorable.get(dayKeyOf(row))) {
                to = Math.max(current, entry.sets());
            } else {
                int dayTotal = plan.stream()
                    .filter(r -> row.group().equals(r.group()) && r.dayIndex() == row.dayIndex())
                    .mapToInt(r -> working.get(r.exercise().getId())).sum();
                int fits = Math.min(Math.min(entry.sets(), Math.max(props.bands().exerciseCap(), entry.sets())),
                    current + Math.max(0, props.bands().sessionCap() - dayTotal));
                to = Math.max(current, fits);
            }
            if (to > current) {
                fromSets.putIfAbsent(id, current);
                lineReasons.put(id, List.of(code(Reason.DELOAD_RESTORE)));
                working.put(id, to);
            }
        });
        return keptOwn;
    }

    private static String dayKeyOf(TemplatePlan.Row row) {
        return row.group() + "|" + row.dayIndex();
    }

    /** Appends this week's move to each changed group's (freshly synced) ledger row provenance. */
    private void appendAdjustments(UUID createdBy, UUID mesoId, int calWeek, Map<String, GroupOutcome> outcomes) {
        List<MuscleGroupVolumeLogEntity> touched = new ArrayList<>();
        for (MuscleGroupVolumeLogEntity row
                : volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesoId))) {
            GroupOutcome o = outcomes.get(row.getMuscle());
            if (o == null || !o.changed() || row.getSource() == null) {
                continue;
            }
            ProvenanceEnvelope source = row.getSource();
            List<ProvenanceEnvelope.Adjustment> adjustments =
                new ArrayList<>(source.adjustments() != null ? source.adjustments() : List.of());
            // kind stays within the contract's VolumeAdjustment.kind enum — a weekly move is "pattern".
            adjustments.add(new ProvenanceEnvelope.Adjustment(
                "pattern", "W" + calWeek + ": " + changeText(o), Map.of(), isDeload(o) ? Boolean.TRUE : null));
            row.setSource(new ProvenanceEnvelope(
                source.baseline(), adjustments, source.confidence(), source.note(), source.userOverride()));
            touched.add(row);
        }
        volumeLogRepository.saveAll(touched);
    }

    private void stamp(MesocycleEntity meso, int calWeek, List<VolumeRecomputeJson.Change> changes) {
        meso.setCurrentWeek(calWeek);
        meso.setVolumeRecompute(new VolumeRecomputeJson(
            "W" + calWeek, "W" + (calWeek + 1), TRIGGER_LABEL, changes));
        mesocycleRepository.save(meso);
    }

    // ── plan reading ──────────────────────────────────────────────────────────────────────────

    private List<ExerciseEntity> templateExercises(UUID createdBy, UUID mesoId) {
        List<UUID> templateIds = MesoTemplateDays.ids(workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId)));
        return templateIds.isEmpty() ? List.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds);
    }

    private static List<SetSlots.Slot> slots(List<TemplatePlan.Row> rows, Map<UUID, Integer> working) {
        return rows.stream()
            .map(r -> new SetSlots.Slot(r.exercise().getId(), r.dayIndex(), working.get(r.exercise().getId())))
            .toList();
    }

    private static int sum(List<TemplatePlan.Row> rows, Map<UUID, Integer> working) {
        return rows.stream().mapToInt(r -> working.get(r.exercise().getId())).sum();
    }

    /** One set moved on the working copy; repeated moves of one exercise (a restore included) merge
     *  into one {@code from → to} line carrying all their reasons. */
    private static void move(UUID id, int by, Map<UUID, Integer> working, Map<UUID, Integer> fromSets,
                             Map<UUID, List<String>> lineReasons, List<String> reasons) {
        fromSets.putIfAbsent(id, working.get(id));
        lineReasons.merge(id, reasons, (had, more) -> java.util.stream.Stream.concat(had.stream(), more.stream())
            .distinct().toList());
        working.merge(id, by, Integer::sum);
    }

    /** DA1: {@code phaseCurve} is 1-based against a 1-based week — index {@code calWeek − 1}, bounds-checked. */
    private static boolean isDeloadPhase(MesocycleEntity meso, int calWeek) {
        List<String> phaseCurve = meso.getPhaseCurve();
        int idx = calWeek - 1;
        if (phaseCurve == null || idx < 0 || idx >= phaseCurve.size()) {
            return false;
        }
        return PHASE_DELOAD.equalsIgnoreCase(phaseCurve.get(idx));
    }

    /** {@code "W{n}"} → {@code n}; {@code null}/blank/unparsable ⇒ 0 (never recorded yet). */
    public static int parseLastRunWeek(VolumeRecomputeJson recompute) {
        if (recompute == null || recompute.lastRun() == null || recompute.lastRun().isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(recompute.lastRun().replaceFirst("(?i)^W", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ── audit wording (display strings, Hungarian) ────────────────────────────────────────────

    /** Contract reason code: the enum name, lower-case snake. */
    private static String code(Reason reason) {
        return reason.name().toLowerCase(Locale.ROOT);
    }

    private static boolean isDeload(GroupOutcome o) {
        return o.result().lever() == Lever.DELOAD;
    }

    private static VolumeRecomputeJson.Change change(GroupOutcome o) {
        return new VolumeRecomputeJson.Change(o.group(), changeText(o), reasonText(o), isDeload(o) ? Boolean.TRUE : null);
    }

    private static String changeText(GroupOutcome o) {
        if (isDeload(o)) {
            return "Deload " + o.before() + " → " + o.after();
        }
        if (o.restored() > o.before()) {
            int step = o.after() - o.restored();
            String arrow = " (" + o.before() + " → " + o.after() + ")";
            return step == 0 ? "visszaállt a könnyített hét után" + arrow
                : "visszaállt és " + (step > 0 ? "+" : "") + step + arrow;
        }
        if (o.noSlot()) {
            return "nincs hely új sorozatnak (" + o.before() + ")";
        }
        int diff = o.after() - o.before();
        if (diff == 0) {
            return "tart (" + o.before() + ")";
        }
        return (diff > 0 ? "+" : "") + diff + " (" + o.before() + " → " + o.after() + ")";
    }

    /** The stored per-muscle outcome: the contract reason codes under the same conditions {@link #reasonText} uses. */
    private static WeekProposalGroupJson groupJson(GroupOutcome o, PriorityTier tier, VolumeBands.Band band) {
        List<String> reasons = new ArrayList<>();
        if (o.restored() > o.before()) {
            reasons.add(code(Reason.DELOAD_RESTORE));
        }
        o.result().reasons().forEach(r -> reasons.add(code(r)));
        if (o.stalled()) {
            reasons.add(code(Reason.STALLED));
        }
        if (o.noSlot()) {
            reasons.add(code(Reason.NO_SLOT));
        }
        return new WeekProposalGroupJson(o.group(), tier.name().toLowerCase(Locale.ROOT),
            band == null ? null : band.low(), band == null ? null : band.high(),
            band != null && band.sportAdjusted(), o.before(), o.after(), reasons.stream().distinct().toList());
    }

    private static String reasonText(GroupOutcome o) {
        List<String> parts = new ArrayList<>();
        if (o.restored() > o.before()) {
            parts.add(hu(Reason.DELOAD_RESTORE));
        }
        if (o.keptOwn()) {
            parts.add("a könnyített hét után a saját számod maradt");
        }
        parts.addAll(o.result().reasons().stream().map(WeekProposalService::hu).toList());
        if (o.stalled()) {
            parts.add(hu(Reason.STALLED));
        }
        if (o.noSlot()) {
            parts.add(hu(Reason.NO_SLOT));
        } else if (o.result().lever() == Lever.UP && o.after() - o.restored() < o.result().delta()) {
            parts.add("nincs hely több sorozatnak");
        }
        return parts.isEmpty() ? "a terv áll" : String.join(", ", parts);
    }

    private static String hu(Reason reason) {
        return switch (reason) {
            case ALL_SETS_DONE -> "minden sorozat megvolt";
            case FELT_EASY -> "könnyűnek érezted";
            case DEFICIT_PACE -> "fogyás alatt lassabb tempó";
            case ROOM_IN_BAND -> "van még hely a sávban";
            case SORENESS_CLEARED -> "elmúlt az izomláz";
            case GRIND -> "túl nehéz volt";
            case TOO_MUCH -> "sok volt";
            case SETS_MISSED -> "kimaradt sorozat";
            case JOINT_PAIN -> "ízületi fájdalom";
            case SORENESS -> "még izomláz";
            case TIER_MAINTAIN -> "tartás";
            case DELOAD -> "deload hét";
            case NO_SLOT -> "nincs hely új sorozatnak";
            case AT_CEILING -> "elérte a sáv tetejét";
            case DELOAD_RESTORE -> "visszaállt a könnyített hét után";
            case STALLED -> "megállt a fejlődés";
        };
    }
}

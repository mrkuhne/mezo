package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
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
 * {@link MesoWeekProposalEntity} — and, in {@code auto} mode (the only one built so far), applied
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
    private final VolumeProperties props;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;

    /** What happened to one muscle group this week: the audit's {@code Change} is built from it. */
    record GroupOutcome(String group, int before, int after, VolumeDecider.Result result, boolean noSlot) {
        boolean changed() {
            return after != before;
        }
    }

    /** A built (persisted, not yet applied) proposal and the per-group outcomes behind it. */
    record Draft(MesoWeekProposalEntity proposal, Map<String, GroupOutcome> outcomes) {}

    /** Mutates {@code meso} in place ({@code currentWeek}, {@code volumeRecompute}) and saves it. */
    @Transactional
    public void generateIfDue(UUID createdBy, MesocycleEntity meso) {
        if (volumeGate.getIfAvailable() == null) {
            return;
        }
        int calWeek = MesoWeeks.clampWeek(meso.getStartDate(), meso.getWeeks());
        if (calWeek <= parseLastRunWeek(meso.getVolumeRecompute())) {
            return; // this calendar week is already recorded
        }
        if (calWeek <= 1) {
            // Week 1: the plan stands. Recorded once, nothing generated.
            stamp(meso, calWeek, List.of());
            return;
        }
        if (proposalRepository.findWeekly(createdBy, meso.getId(), calWeek).isPresent()) {
            return;
        }
        restoreAfterDeload(createdBy, meso.getId(), calWeek);

        Draft draft = build(createdBy, meso, calWeek);
        if (MODE_AUTO.equals(props.weeklyReview().mode())) {
            apply(draft.proposal());
        } // manual mode is a later slice: the proposal stays pending and nothing is applied

        volumeLedger.sync(createdBy, meso.getId());
        appendAdjustments(createdBy, meso.getId(), calWeek, draft.outcomes());
        stamp(meso, calWeek, draft.outcomes().values().stream().map(WeekProposalService::change).toList());
    }

    /**
     * Decides every participating group on a working copy of the week's slots (so consecutive picks
     * see each other) and persists the proposal as {@code pending}, lines undecided.
     */
    Draft build(UUID createdBy, MesocycleEntity meso, int calWeek) {
        List<PlanRow> plan = planRows(createdBy, meso.getId());
        Map<String, List<PlanRow>> byGroup = new TreeMap<>();
        plan.stream().filter(r -> r.group() != null)
            .forEach(r -> byGroup.computeIfAbsent(r.group(), k -> new ArrayList<>()).add(r));

        Map<String, GroupSignals> signals = signalReader.read(createdBy, meso, calWeek);
        boolean deficit = energyBalance.isInDeficit(createdBy, LocalDate.now());
        boolean deloadPhase = isDeloadPhase(meso, calWeek);

        Map<UUID, Integer> working = new HashMap<>();
        plan.forEach(r -> working.put(r.exercise().getId(), r.exercise().getWorkingSets()));
        Map<UUID, Integer> fromSets = new LinkedHashMap<>(); // insertion order = line order
        Map<UUID, List<String>> lineReasons = new HashMap<>();
        Map<String, Integer> restore = new LinkedHashMap<>();
        Map<String, GroupOutcome> outcomes = new LinkedHashMap<>();

        byGroup.forEach((group, rows) -> {
            int before = sum(rows, working);
            GroupSignals s = signals.getOrDefault(group, new GroupSignals(0, false, false, false, false));
            VolumeDecider.Result result = VolumeDecider.decide(new VolumeDecider.Input(
                calWeek, PriorityTier.of(meso.getMusclePriorities(), group),
                VolumeBands.band(props.baselines().get(group),
                    PriorityTier.of(meso.getMusclePriorities(), group), props.bands()),
                before, s.logged(), s.grind(), s.tooMuch(), s.jointPain(), s.sorenessHigh(),
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
                        restore.put(id.toString(), sets);
                    }
                });
                default -> { } // HOLD / NONE: no line
            }
            outcomes.put(group, new GroupOutcome(group, before, sum(rows, working), result, noSlot));
        });

        Map<UUID, PlanRow> rowById = plan.stream()
            .collect(Collectors.toMap(r -> r.exercise().getId(), r -> r, (a, b) -> a));
        List<WeekProposalLineJson> lines = new ArrayList<>();
        fromSets.forEach((id, from) -> {
            int to = working.get(id);
            if (to == from) {
                return; // moved up and back down again: no net change
            }
            PlanRow row = rowById.get(id);
            lines.add(new WeekProposalLineJson(UUID.randomUUID().toString(), id, row.exercise().getName(),
                row.dayIndex(), row.group(), WeekProposalLineJson.KIND_SETS, from, to, lineReasons.get(id), null));
        });

        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(createdBy);
        proposal.setMesocycleId(meso.getId());
        proposal.setWeek(calWeek);
        proposal.setKind(MesoWeekProposalEntity.KIND_WEEKLY);
        proposal.setStatus(MesoWeekProposalEntity.STATUS_PENDING);
        proposal.setLines(lines);
        proposal.setRestore(restore.isEmpty() ? null : restore);
        return new Draft(proposalRepository.save(proposal), outcomes);
    }

    /**
     * Accepts every line and writes its {@code to} onto the exercise row. A line whose exercise row
     * no longer exists is {@code kept} and skipped — never an error. Fills {@code planAfter} with
     * every counting exercise's sets after the write.
     */
    void apply(MesoWeekProposalEntity proposal) {
        UUID createdBy = proposal.getCreatedBy();
        List<WeekProposalLineJson> decided = new ArrayList<>();
        List<ExerciseEntity> written = new ArrayList<>();
        for (WeekProposalLineJson line : proposal.getLines()) {
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
    }

    // ── steps ─────────────────────────────────────────────────────────────────────────────────

    /** The week after a deload starts from the pre-deload amounts (rows that no longer exist are skipped). */
    private void restoreAfterDeload(UUID createdBy, UUID mesoId, int calWeek) {
        Map<String, Integer> restore = proposalRepository.findLatestApplied(createdBy, mesoId, calWeek)
            .map(MesoWeekProposalEntity::getRestore).orElse(null);
        if (restore == null || restore.isEmpty()) {
            return;
        }
        List<ExerciseEntity> rows = new ArrayList<>();
        restore.forEach((id, sets) -> exerciseRepository.findById(UUID.fromString(id))
            .filter(e -> createdBy.equals(e.getCreatedBy()))
            .ifPresent(e -> {
                e.setWorkingSets(sets);
                rows.add(e);
            }));
        exerciseRepository.saveAll(rows);
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

    /** A counting exercise of a template day; {@code group} null when the group has no band. */
    private record PlanRow(ExerciseEntity exercise, int dayIndex, String group) {}

    private List<PlanRow> planRows(UUID createdBy, UUID mesoId) {
        Map<UUID, Integer> dayIndex = new HashMap<>();
        workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId))
            .stream().filter(s -> s.getTemplateSessionId() == null)
            .forEach(s -> dayIndex.put(s.getId(), s.getOrderIndex() == null ? 0 : s.getOrderIndex()));
        if (dayIndex.isEmpty()) {
            return List.of();
        }
        return exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.copyOf(dayIndex.keySet()))
            .stream()
            .filter(ExerciseEntity::isCountsTowardVolume)
            .map(e -> {
                String group = e.getMuscle() == null || e.getMuscle().isBlank() ? null : MuscleGroup.of(e.getMuscle());
                return new PlanRow(e, dayIndex.get(e.getWorkoutSessionId()),
                    group != null && props.baselines().containsKey(group) ? group : null);
            })
            .sorted((a, b) -> a.dayIndex() != b.dayIndex() ? Integer.compare(a.dayIndex(), b.dayIndex())
                : Integer.compare(orderIndex(a.exercise()), orderIndex(b.exercise())))
            .toList();
    }

    private List<ExerciseEntity> templateExercises(UUID createdBy, UUID mesoId) {
        List<UUID> templateIds = MesoTemplateDays.ids(workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId)));
        return templateIds.isEmpty() ? List.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds);
    }

    private static int orderIndex(ExerciseEntity e) {
        return e.getOrderIndex() == null ? 0 : e.getOrderIndex();
    }

    private static List<SetSlots.Slot> slots(List<PlanRow> rows, Map<UUID, Integer> working) {
        return rows.stream()
            .map(r -> new SetSlots.Slot(r.exercise().getId(), r.dayIndex(), working.get(r.exercise().getId())))
            .toList();
    }

    private static int sum(List<PlanRow> rows, Map<UUID, Integer> working) {
        return rows.stream().mapToInt(r -> working.get(r.exercise().getId())).sum();
    }

    /** One set moved on the working copy; repeated moves of one exercise merge into one {@code from → to} line. */
    private static void move(UUID id, int by, Map<UUID, Integer> working, Map<UUID, Integer> fromSets,
                             Map<UUID, List<String>> lineReasons, List<String> reasons) {
        fromSets.putIfAbsent(id, working.get(id));
        lineReasons.put(id, reasons);
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
    private static int parseLastRunWeek(VolumeRecomputeJson recompute) {
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
        if (o.noSlot()) {
            return "nincs hely új sorozatnak (" + o.before() + ")";
        }
        int diff = o.after() - o.before();
        if (diff == 0) {
            return "tart (" + o.before() + ")";
        }
        return (diff > 0 ? "+" : "") + diff + " (" + o.before() + " → " + o.after() + ")";
    }

    private static String reasonText(GroupOutcome o) {
        List<String> parts = new ArrayList<>(o.result().reasons().stream().map(WeekProposalService::hu).toList());
        if (o.noSlot()) {
            parts.add(hu(Reason.NO_SLOT));
        } else if (o.result().lever() == Lever.UP && o.after() - o.before() < o.result().delta()) {
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
        };
    }
}

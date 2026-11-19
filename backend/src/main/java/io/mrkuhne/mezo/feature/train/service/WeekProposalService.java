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
import java.util.Objects;
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
 * {@link MesoWeekProposalEntity}, followed by the weight / rep preview lines of {@link LoadLinePreview}.
 * In {@code auto} mode it is applied at once by writing the exercises' {@code working_sets}; the
 * ledger is then re-derived. In {@code manual} mode it stays {@code pending} — nothing is written
 * until a line is decided ({@link #applySetLine} + {@link #close}, the decisions endpoint's seam), and
 * an undecided proposal expires at the next week boundary. Either way the run's
 * {@code volume_recompute} audit and {@code currentWeek} advance, in the shapes the web readers know.
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
    /** Manual-mode audit prefix: the week's change is a proposal until he decides it. */
    static final String PROPOSAL_PREFIX = "javaslat: ";

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
            // Week 1: the plan stands. Recorded once, nothing generated (no earlier proposal can pend).
            stamp(run, calWeek, List.of());
            return;
        }
        // The week boundary: whatever was left undecided before this week never happens. Before the
        // repeated-week check (a step-back still closes older weeks) and before building (the restore
        // lookup must see a deload week closed and pruned to what he accepted).
        expirePending(createdBy, run.getId(), calWeek);
        if (proposalRepository.findWeekly(createdBy, run.getId(), calWeek).isPresent()) {
            // The week was decided before (a kímélő step-back moved the run back and the calendar
            // is repeating it, or the unique index backstop): record it, regenerate nothing.
            stamp(run, calWeek, List.of());
            return;
        }
        Draft draft = build(createdBy, run, calWeek);
        if (!MODE_AUTO.equals(props.weeklyReview().mode())) {
            // Manual: the proposal waits. Nothing written, so the ledger and its provenance stay as they
            // are; the week is still recorded, its audit worded as a proposal. A week with no line has
            // nothing to review: closed at once (every line vacuously decided), so it never pends.
            if (draft.proposal().getLines().isEmpty()) {
                close(draft.proposal(), MesoWeekProposalEntity.STATUS_APPLIED);
            }
            stamp(run, calWeek, draft.outcomes().values().stream().map(WeekProposalService::proposedChange).toList());
            return;
        }
        apply(draft.proposal());
        volumeLedger.sync(createdBy, run.getId());
        appendAdjustments(createdBy, run.getId(), calWeek, draft.outcomes());
        stamp(run, calWeek, draft.outcomes().values().stream().map(WeekProposalService::change).toList());
    }

    /** Every still-pending proposal of the run (weekly and tier_change) before {@code calWeek} → {@code expired}. */
    private void expirePending(UUID createdBy, UUID mesoId, int calWeek) {
        proposalRepository.findPendingBefore(createdBy, mesoId, calWeek)
            .forEach(p -> close(p, MesoWeekProposalEntity.STATUS_EXPIRED));
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
        Map<String, Integer> tierMoves = tierChangeMovesSinceLastWeek(createdBy, meso.getId(), calWeek);
        Set<String> keptOwn = restoreAfterDeload(createdBy, meso.getId(), calWeek, plan, working, fromSets, lineReasons);

        byGroup.forEach((group, rows) -> {
            int before = beforeByGroup.get(group);
            // What last week prescribed while he trained it: a tier change since then moved the plan after.
            int plannedLastWeek = Math.max(0, before - tierMoves.getOrDefault(group, 0));
            int restored = sum(rows, working);
            GroupSignals s = signals.getOrDefault(group, new GroupSignals(0, false, false, false, false));
            PriorityTier tier = PriorityTier.of(meso.getMusclePriorities(), group);
            VolumeBands.Band band = VolumeBands.band(props.baselines().get(group), tier,
                meso.isSportLoaded(group), props.bands());
            bands.put(group, band);
            VolumeDecider.Result result = VolumeDecider.decide(new VolumeDecider.Input(
                calWeek, tier, band,
                restored, plannedLastWeek, s.logged(), s.grind(), s.tooMuch(), s.jointPain(), s.sorenessHigh(),
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
                row.dayName(), null, null, null, null, null, null, null, null, null));
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
     * Per group, the net sets the run's tier changes wrote since the previous week's weekly proposal was built
     * (since the run's start when there is none): the accepted set lines (an accepted set line is always a
     * written one — {@link #applySetLine} records {@code kept} otherwise), whatever the proposal's status. A
     * change made in the middle of last week, or on this week's first day before this build, is counted — last
     * week was logged under the plan before it, so {@code SETS_MISSED} is judged against that plan.
     */
    private Map<String, Integer> tierChangeMovesSinceLastWeek(UUID createdBy, UUID mesoId, int calWeek) {
        Instant since = proposalRepository.findWeeklyBefore(createdBy, mesoId, calWeek).stream()
            .findFirst().map(MesoWeekProposalEntity::getCreatedAt).orElse(Instant.EPOCH);
        Map<String, Integer> moves = new HashMap<>();
        proposalRepository.findTierChangesCreatedAfter(createdBy, mesoId, since).stream()
            .flatMap(p -> p.getLines().stream())
            .filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind()))
            .filter(l -> WeekProposalLineJson.DECISION_ACCEPTED.equals(l.decision()))
            .filter(l -> l.muscleGroup() != null && l.from() != null && l.to() != null)
            .forEach(l -> moves.merge(l.muscleGroup(), l.to() - l.from(), Integer::sum));
        return moves;
    }

    /**
     * The {@code auto} path: every line accepted ({@link #applySetLine} — a set line whose row vanished
     * is {@code kept}, never an error), then closed {@code auto_applied}.
     */
    void apply(MesoWeekProposalEntity proposal) {
        proposal.setLines(proposal.getLines().stream().map(l -> applySetLine(proposal, l)).toList());
        close(proposal, MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
    }

    /**
     * Accepts one line. A set line writes its {@code to} onto the exercise row only while that row (the
     * owner's, still there) holds the line's {@code from}; a vanished or since-moved row is recorded
     * {@code kept} and nothing is written (his own edit stands). A weight / rep line is accepted without a
     * write (the session's read-time prescription carries it). The caller re-syncs the ledger after a write.
     *
     * @return the line with its decision
     */
    WeekProposalLineJson applySetLine(MesoWeekProposalEntity proposal, WeekProposalLineJson line) {
        if (!WeekProposalLineJson.KIND_SETS.equals(line.kind())) {
            return line.withDecision(WeekProposalLineJson.DECISION_ACCEPTED); // load line: no write
        }
        Optional<ExerciseEntity> row = exerciseRepository.findById(line.exerciseId())
            .filter(e -> proposal.getCreatedBy().equals(e.getCreatedBy()))
            .filter(e -> Objects.equals(e.getWorkingSets(), line.from()));
        if (row.isEmpty()) {
            return line.withDecision(WeekProposalLineJson.DECISION_KEPT);
        }
        row.get().setWorkingSets(line.to());
        exerciseRepository.save(row.get());
        return line.withDecision(WeekProposalLineJson.DECISION_ACCEPTED);
    }

    /**
     * Closes a proposal as {@code applied}, {@code auto_applied} or {@code expired} (its lines as the caller
     * left them): {@code decidedAt}, and {@code planAfter} = every counting template exercise's sets now.
     * A deload proposal's {@code restore} keeps only the entries whose set line was accepted (an undecided
     * or kept halving never happened, so there is nothing to give back). An applied weekly proposal consumes
     * the deload restore it was offered (emptied — never given twice, whatever was decided on its lines);
     * an expired one drops only the entries its accepted restore lines gave back, so the next week offers
     * the rest again.
     */
    void close(MesoWeekProposalEntity proposal, String status) {
        UUID createdBy = proposal.getCreatedBy();
        Map<String, Integer> planAfter = new LinkedHashMap<>();
        templateExercises(createdBy, proposal.getMesocycleId()).stream()
            .filter(ExerciseEntity::isCountsTowardVolume)
            .forEach(e -> planAfter.put(e.getId().toString(), e.getWorkingSets()));
        proposal.setPlanAfter(planAfter);
        proposal.setStatus(status);
        proposal.setDecidedAt(Instant.now());
        if (proposal.getRestore() != null && !proposal.getRestore().isEmpty()) {
            Set<UUID> accepted = proposal.getLines().stream()
                .filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind()))
                .filter(l -> WeekProposalLineJson.DECISION_ACCEPTED.equals(l.decision()))
                .map(WeekProposalLineJson::exerciseId)
                .collect(Collectors.toSet());
            proposal.setRestore(proposal.getRestore().stream()
                .filter(e -> accepted.contains(e.exerciseId())).toList());
        }
        proposalRepository.save(proposal);

        if (!MesoWeekProposalEntity.KIND_WEEKLY.equals(proposal.getKind())) {
            return; // a tier change never touches a deload's restore
        }
        boolean applied = MesoWeekProposalEntity.STATUS_APPLIED.equals(status)
            || MesoWeekProposalEntity.STATUS_AUTO_APPLIED.equals(status);
        deloadToRestore(createdBy, proposal.getMesocycleId(), proposal.getWeek()).ifPresent(deload -> {
            deload.setRestore(applied ? List.of() : notGivenBack(deload.getRestore(), proposal));
            proposalRepository.save(deload);
        });
    }

    /**
     * An expired week's restore lines that he accepted were written — that part of the deload is given back.
     * The remaining entries: those not matched (id, else identity on the same day — the restore's own
     * matching) to a row whose {@code deload_restore} line was accepted. Empty when every entry came back.
     */
    private List<RestoreEntryJson> notGivenBack(List<RestoreEntryJson> entries, MesoWeekProposalEntity proposal) {
        String restoreCode = code(Reason.DELOAD_RESTORE);
        Set<UUID> givenBack = proposal.getLines().stream()
            .filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind()))
            .filter(l -> WeekProposalLineJson.DECISION_ACCEPTED.equals(l.decision()))
            .filter(l -> l.reasons() != null && l.reasons().contains(restoreCode))
            .map(WeekProposalLineJson::exerciseId)
            .collect(Collectors.toSet());
        if (givenBack.isEmpty()) {
            return entries;
        }
        Map<RestoreEntryJson, TemplatePlan.Row> pairs = TemplatePlan.matchEntries(entries,
            templatePlan.rows(proposal.getCreatedBy(), proposal.getMesocycleId()));
        return entries.stream()
            .filter(e -> !givenBack.contains(e.exerciseId()))
            .filter(e -> pairs.get(e) == null || !givenBack.contains(pairs.get(e).exercise().getId()))
            .toList();
    }

    // ── steps ─────────────────────────────────────────────────────────────────────────────────

    /**
     * The deload to give back from before {@code week}: the latest closed (applied, auto-applied or expired)
     * weekly proposal that was a deload (non-null {@code restore}), when its restore is still non-empty.
     * Stopping at the latest deload — even an emptied one — keeps an older, never-consumed restore from
     * resurfacing after a later deload was given back.
     */
    private Optional<MesoWeekProposalEntity> deloadToRestore(UUID createdBy, UUID mesoId, int week) {
        return proposalRepository.findClosedWeeklyBefore(createdBy, mesoId, week).stream()
            .filter(p -> p.getRestore() != null)
            .findFirst()
            .filter(p -> !p.getRestore().isEmpty());
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
            .map(r -> SetSlots.Slot.of(r.exercise().getId(), r.dayIndex(), working.get(r.exercise().getId()), r.capExtra()))
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

    /**
     * DA1: {@code phaseCurve} is 1-based against a 1-based week — index {@code calWeek − 1}, bounds-checked.
     * Shared with {@link TierChangeProposalService} (no band fix in a deload week).
     */
    static boolean isDeloadPhase(MesocycleEntity meso, int calWeek) {
        return isDeloadPhase(meso.getPhaseCurve(), calWeek);
    }

    /** The same rule on a bare phase curve (a run's or a draft's); null or out of bounds is not a deload. */
    static boolean isDeloadPhase(List<String> phaseCurve, int calWeek) {
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

    /** Manual mode: a changed group's audit line reads as a proposal ("javaslat: +1 …"); a held one as usual. */
    private static VolumeRecomputeJson.Change proposedChange(GroupOutcome o) {
        VolumeRecomputeJson.Change c = change(o);
        return o.changed() ? new VolumeRecomputeJson.Change(c.muscle(), PROPOSAL_PREFIX + c.change(), c.reason(),
            c.warning()) : c;
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

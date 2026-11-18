package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A tier or sport change on a running block (volume engine v2 S3, spec §6.5, defect 9): the groups whose band
 * moved in that request and whose plan now sits outside the new band get the plan evaluator's cap-respecting
 * edits ({@link PlanEvaluator}, spec §6.3 — which may cut) as one {@code tier_change} proposal of the calendar
 * week. A still-pending tier change of the run is {@code superseded} first, so at most one pends. {@code auto}
 * mode applies it at once ({@code auto_applied}, ledger re-synced, a provenance note per changed group);
 * {@code manual} leaves it pending for the decisions endpoint. A group he did not touch is never pulled back
 * (§6.4: a plan saved above its band stays). The run's weekly audit / {@code currentWeek} are not touched.
 *
 * <p>Only with the volume-progression gate on, on an active amount-model (v2) run; the caller holds the run's
 * row lock (the weekly generation's lock order: run row, then plan rows and proposals).
 */
@Service
@RequiredArgsConstructor
public class TierChangeProposalService {

    private static final String STATUS_ACTIVE = "active";
    private static final String MODE_AUTO = "auto";
    static final String REASON_TIER_CHANGE = "tier_change";
    static final String REASON_ROOM_IN_BAND = "room_in_band";
    static final String REASON_ABOVE_BAND = "above_band";
    static final String REASON_NO_SLOT = "no_slot";

    private final MesoWeekProposalRepository proposalRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final TemplatePlan templatePlan;
    private final WeekProposalService weekProposalService;
    private final VolumeLedger volumeLedger;
    private final VolumeProperties props;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;

    /** Every landmark group's band under the run's current tiers and sport groups. */
    public Map<String, Band> bandsOf(MesocycleEntity run) {
        Map<String, Band> bands = new LinkedHashMap<>();
        props.baselines().forEach((group, landmarks) -> bands.put(group, VolumeBands.band(landmarks,
            PriorityTier.of(run.getMusclePriorities(), group), run.isSportLoaded(group), props.bands())));
        return bands;
    }

    /**
     * Raises (and in {@code auto} mode applies) the tier-change proposal for the run's new tiers / sport groups.
     *
     * @param bandsBefore {@link #bandsOf} the run before the change
     * @return the stored proposal; empty when no changed group needs an edit (nothing is superseded then)
     */
    @Transactional
    public Optional<MesoWeekProposalEntity> raise(UUID createdBy, MesocycleEntity run, Map<String, Band> bandsBefore) {
        if (volumeGate.getIfAvailable() == null || run.getVolumeModel() < 2
                || !STATUS_ACTIVE.equals(run.getStatus())) {
            return Optional.empty();
        }
        Map<String, Band> bandsAfter = bandsOf(run);
        Set<String> changed = new HashSet<>();
        bandsAfter.forEach((group, band) -> {
            if (!band.equals(bandsBefore.get(group))) {
                changed.add(group);
            }
        });
        if (changed.isEmpty()) {
            return Optional.empty();
        }

        // The run's plan as the evaluator reads it: one day per template day (day order), position → row.
        Map<Integer, List<TemplatePlan.Row>> byDay = new TreeMap<>();
        templatePlan.rows(createdBy, run.getId())
            .forEach(r -> byDay.computeIfAbsent(r.dayIndex(), k -> new ArrayList<>()).add(r));
        List<List<TemplatePlan.Row>> dayRows = new ArrayList<>(byDay.values());
        List<PlanEvaluator.PlanDay> days = dayRows.stream().map(rows -> new PlanEvaluator.PlanDay(
            rows.get(0).dayName(),
            rows.stream().map(r -> new PlanEvaluator.PlanExercise(r.group(), sets(r), 0, true)).toList())).toList();
        PlanEvaluator.Result evaluation = PlanEvaluator.evaluate(new PlanEvaluator.Input(run.getWeeks(),
            run.getPhaseCurve() == null ? List.of() : run.getPhaseCurve(), days, run.getMusclePriorities(),
            run.getSportGroups() == null ? Set.of() : new HashSet<>(run.getSportGroups()), false, null, Set.of(),
            props));

        List<WeekProposalLineJson> lines = new ArrayList<>();
        List<WeekProposalGroupJson> groups = new ArrayList<>();
        for (PlanEvaluator.MuscleResult m : evaluation.muscles()) {
            if (!changed.contains(m.muscle()) || m.fit() == PlanEvaluator.Fit.INSIDE || m.weeklySets() == 0) {
                continue; // untouched, still inside, or not trained in this plan
            }
            List<String> reasons = List.of(REASON_TIER_CHANGE,
                m.fit() == PlanEvaluator.Fit.BELOW ? REASON_ROOM_IN_BAND : REASON_ABOVE_BAND);
            int after = m.weeklySets();
            for (PlanEvaluator.ProposalEdit edit : m.proposal()) { // one net edit per exercise already
                TemplatePlan.Row row = dayRows.get(edit.dayIndex()).get(edit.exerciseIndex());
                int from = sets(row);
                lines.add(new WeekProposalLineJson(UUID.randomUUID().toString(), row.exercise().getId(),
                    row.exercise().getName(), row.dayIndex(), row.group(), WeekProposalLineJson.KIND_SETS,
                    from, from + edit.delta(), reasons, null, row.dayName(), null, null));
                after += edit.delta();
            }
            List<String> groupReasons = new ArrayList<>(reasons);
            if (m.proposal().isEmpty()) {
                groupReasons.add(REASON_NO_SLOT);
            }
            groups.add(new WeekProposalGroupJson(m.muscle(), m.tier().name().toLowerCase(Locale.ROOT),
                m.band().low(), m.band().high(), m.band().sportAdjusted(), m.weeklySets(), after,
                List.copyOf(groupReasons)));
        }
        if (lines.isEmpty()) {
            return Optional.empty();
        }

        proposalRepository.findPendingTierChanges(createdBy, run.getId())
            .forEach(p -> weekProposalService.close(p, MesoWeekProposalEntity.STATUS_SUPERSEDED));
        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(createdBy);
        proposal.setMesocycleId(run.getId());
        proposal.setWeek(MesoWeeks.clampWeek(run.getStartDate(), run.getWeeks()));
        proposal.setKind(MesoWeekProposalEntity.KIND_TIER_CHANGE);
        proposal.setStatus(MesoWeekProposalEntity.STATUS_PENDING);
        proposal.setLines(lines);
        proposal.setGroups(groups);
        proposal = proposalRepository.save(proposal);

        if (MODE_AUTO.equals(props.weeklyReview().mode())) {
            weekProposalService.apply(proposal);
            volumeLedger.sync(createdBy, run.getId());
            appendAdjustments(createdBy, run, proposal, bandsBefore, bandsAfter);
        }
        return Optional.of(proposal);
    }

    /**
     * Appends the change to each changed group's (freshly synced) ledger provenance: {@code "prioritás-váltás:
     * 11 → 14"}, or {@code "sport-terhelés: 12 → 10"} when only the sport flag moved the band.
     */
    private void appendAdjustments(UUID createdBy, MesocycleEntity run, MesoWeekProposalEntity proposal,
                                   Map<String, Band> before, Map<String, Band> after) {
        Map<String, Integer> delta = new HashMap<>();
        proposal.getLines().stream()
            .filter(l -> WeekProposalLineJson.DECISION_ACCEPTED.equals(l.decision()))
            .forEach(l -> delta.merge(l.muscleGroup(), l.to() - l.from(), Integer::sum));
        Map<String, Integer> setsBefore = new HashMap<>();
        proposal.getGroups().forEach(g -> setsBefore.put(g.muscle(), g.setsBefore()));
        List<MuscleGroupVolumeLogEntity> touched = new ArrayList<>();
        for (MuscleGroupVolumeLogEntity row
                : volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(run.getId()))) {
            int d = delta.getOrDefault(row.getMuscle(), 0);
            if (d == 0 || row.getSource() == null) {
                continue;
            }
            int from = setsBefore.get(row.getMuscle());
            String label = (sportOnly(row.getMuscle(), before.get(row.getMuscle()), after.get(row.getMuscle()), run)
                ? "sport-terhelés: " : "prioritás-váltás: ") + from + " → " + (from + d);
            ProvenanceEnvelope source = row.getSource();
            List<ProvenanceEnvelope.Adjustment> adjustments =
                new ArrayList<>(source.adjustments() != null ? source.adjustments() : List.of());
            // kind stays within the contract's VolumeAdjustment.kind enum — a plan move is "pattern".
            adjustments.add(new ProvenanceEnvelope.Adjustment("pattern", label, Map.of(), null));
            row.setSource(new ProvenanceEnvelope(
                source.baseline(), adjustments, source.confidence(), source.note(), source.userOverride()));
            touched.add(row);
        }
        volumeLogRepository.saveAll(touched);
    }

    /** Only the sport flag moved the band: the new tier under the old flag gives back the old band. */
    private boolean sportOnly(String group, Band before, Band after, MesocycleEntity run) {
        if (before == null || after == null || before.sportAdjusted() == after.sportAdjusted()) {
            return false;
        }
        return before.equals(VolumeBands.band(props.baselines().get(group),
            PriorityTier.of(run.getMusclePriorities(), group), before.sportAdjusted(), props.bands()));
    }

    private static int sets(TemplatePlan.Row row) {
        Integer sets = row.exercise().getWorkingSets();
        return sets == null ? 0 : sets;
    }
}

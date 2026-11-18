package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLineDecision;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The decisions on a weekly (or tier-change) proposal (volume engine v2 S3, mezo-r36n9.78):
 * {@code POST …/week-proposals/{proposalId}/decisions}. Serialised per run like the weekly generation (the
 * run row is locked first), so a decision never races the week boundary's expiry.
 *
 * <ul>
 *   <li><b>accepted</b> — {@link WeekProposalService#applySetLine}: a set line writes its {@code to} only while
 *       the row still holds {@code from} (else it is recorded {@code kept} — his own edit stands); a weight /
 *       rep line is recorded, never written.</li>
 *   <li><b>kept</b> — recorded, nothing written.</li>
 *   <li>{@code acceptRest} / {@code keepRest} decide every line still undecided after the explicit ones.</li>
 *   <li>After any write: the ledger is re-synced and each changed group's ledger provenance gets a
 *       {@code pattern} adjustment ({@code "W<week>: +1 (11 → 12)"}). The run's {@code volume_recompute}
 *       audit is left as the week's generation stamped it.</li>
 *   <li>Every line decided → {@link WeekProposalService#close} as {@code applied}.</li>
 * </ul>
 *
 * <p>Idempotent: the same decision on an already decided line is a no-op — on a closed proposal too: a request
 * with no rest flag whose every decision equals the stored one (a retried closing submit) returns the proposal
 * unchanged. Refused (400 {@code TRAIN_WEEK_PROPOSAL_DECISION_INVALID}, nothing written): an empty request,
 * both rest flags, an unknown line id, one line id asked twice with different decisions, or a decided line
 * asked to change. Any other request on a proposal that is no longer pending — or any request on one whose
 * week the calendar has already left (it expires at the next generation) — is 409
 * {@code TRAIN_WEEK_PROPOSAL_CLOSED}.
 */
@Service
@RequiredArgsConstructor
public class WeekProposalDecisionService {

    private static final String REASON_DELOAD = "deload";

    private final MesocycleRepository mesocycleRepository;
    private final MesoWeekProposalRepository proposalRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WeekProposalService weekProposalService;
    private final VolumeLedger volumeLedger;
    private final WeekProposalQueryService queryService;

    @Transactional
    public WeekProposal decide(UUID createdBy, UUID mesoId, UUID proposalId, WeekProposalDecisionRequest request) {
        MesocycleEntity run = mesocycleRepository.findLockedByIdAndCreatedByAndDeletedFalse(mesoId, createdBy)
            .orElseThrow(WeekProposalDecisionService::notFound);
        MesoWeekProposalEntity proposal = proposalRepository
            .findByIdAndCreatedByAndMesocycleId(proposalId, createdBy, mesoId)
            .orElseThrow(WeekProposalDecisionService::notFound);
        if (!MesoWeekProposalEntity.STATUS_PENDING.equals(proposal.getStatus())) {
            if (isRepeat(request, proposal)) {
                return queryService.toDtos(List.of(proposal), run).get(0); // a retried submit: nothing to do
            }
            throw closed();
        }
        if (proposal.getWeek() < MesoWeeks.clampWeek(run.getStartDate(), run.getWeeks())) {
            throw closed();
        }

        boolean acceptRest = Boolean.TRUE.equals(request.getAcceptRest());
        boolean keepRest = Boolean.TRUE.equals(request.getKeepRest());
        Map<String, String> asked = asked(request, acceptRest, keepRest, proposal.getLines());

        List<WeekProposalLineJson> decided = new ArrayList<>();
        List<WeekProposalLineJson> written = new ArrayList<>();
        for (WeekProposalLineJson line : proposal.getLines()) {
            String want = line.decision() != null ? null
                : asked.containsKey(line.id()) ? asked.get(line.id())
                : acceptRest ? WeekProposalLineJson.DECISION_ACCEPTED
                : keepRest ? WeekProposalLineJson.DECISION_KEPT
                : null;
            if (want == null) {
                decided.add(line); // already decided (a repeat is a no-op) or left undecided
            } else if (WeekProposalLineJson.DECISION_ACCEPTED.equals(want)) {
                WeekProposalLineJson result = weekProposalService.applySetLine(proposal, line);
                if (WeekProposalLineJson.KIND_SETS.equals(line.kind())
                        && WeekProposalLineJson.DECISION_ACCEPTED.equals(result.decision())) {
                    written.add(result);
                }
                decided.add(result);
            } else {
                decided.add(line.withDecision(WeekProposalLineJson.DECISION_KEPT));
            }
        }
        proposal.setLines(decided);

        if (!written.isEmpty()) {
            volumeLedger.sync(createdBy, mesoId);
            appendAdjustments(createdBy, mesoId, proposal.getWeek(), written);
        }
        if (decided.stream().allMatch(l -> l.decision() != null)) {
            weekProposalService.close(proposal, MesoWeekProposalEntity.STATUS_APPLIED);
        } else {
            proposalRepository.save(proposal);
        }
        return queryService.toDtos(List.of(proposal), run).get(0);
    }

    /**
     * A request that only repeats what the closed proposal already records (no rest flag, at least one decision,
     * every one naming a line whose stored decision is the same) — e.g. the phone resending a closing submit
     * whose response was lost. Answered with the proposal unchanged instead of a 409.
     */
    private static boolean isRepeat(WeekProposalDecisionRequest request, MesoWeekProposalEntity proposal) {
        List<WeekProposalLineDecision> decisions = request.getDecisions();
        if (Boolean.TRUE.equals(request.getAcceptRest()) || Boolean.TRUE.equals(request.getKeepRest())
                || decisions == null || decisions.isEmpty()) {
            return false;
        }
        Map<String, String> stored = new HashMap<>();
        proposal.getLines().forEach(l -> stored.put(l.id(), l.decision()));
        return decisions.stream().allMatch(d -> d.getLineId() != null && d.getDecision() != null
            && d.getDecision().getValue().equals(stored.get(d.getLineId())));
    }

    /**
     * The explicit per-line decisions, validated against the proposal's lines.
     *
     * @return line id → {@code accepted|kept}
     */
    private static Map<String, String> asked(WeekProposalDecisionRequest request, boolean acceptRest,
                                             boolean keepRest, List<WeekProposalLineJson> lines) {
        List<WeekProposalLineDecision> decisions = request.getDecisions() == null ? List.of() : request.getDecisions();
        if (acceptRest && keepRest || decisions.isEmpty() && !acceptRest && !keepRest) {
            throw invalid();
        }
        Map<String, WeekProposalLineJson> byId = new HashMap<>();
        lines.forEach(l -> byId.put(l.id(), l));
        Map<String, String> asked = new LinkedHashMap<>();
        for (WeekProposalLineDecision d : decisions) {
            if (d.getLineId() == null || d.getDecision() == null) {
                throw invalid();
            }
            String want = d.getDecision().getValue();
            WeekProposalLineJson line = byId.get(d.getLineId());
            String before = asked.putIfAbsent(d.getLineId(), want);
            if (line == null || before != null && !before.equals(want)
                    || line.decision() != null && !line.decision().equals(want)) {
                throw invalid();
            }
        }
        return asked;
    }

    /**
     * Appends this decision's move to each changed group's (freshly synced) ledger row provenance — the
     * manual-mode counterpart of the generation's per-group adjustment, built from the written set lines.
     */
    private void appendAdjustments(UUID createdBy, UUID mesoId, int week, List<WeekProposalLineJson> written) {
        Map<String, Integer> deltaByGroup = new HashMap<>();
        Map<String, Boolean> deloadByGroup = new HashMap<>();
        for (WeekProposalLineJson l : written) {
            deltaByGroup.merge(l.muscleGroup(), l.to() - l.from(), Integer::sum);
            if (l.reasons() != null && l.reasons().contains(REASON_DELOAD)) {
                deloadByGroup.put(l.muscleGroup(), Boolean.TRUE);
            }
        }
        List<MuscleGroupVolumeLogEntity> touched = new ArrayList<>();
        for (MuscleGroupVolumeLogEntity row
                : volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesoId))) {
            int delta = deltaByGroup.getOrDefault(row.getMuscle(), 0);
            if (delta == 0 || row.getSource() == null || row.getCurrentSets() == null) {
                continue;
            }
            int after = row.getCurrentSets();
            String label = "W" + week + ": " + (delta > 0 ? "+" : "") + delta + " (" + (after - delta) + " → "
                + after + ")";
            ProvenanceEnvelope source = row.getSource();
            List<ProvenanceEnvelope.Adjustment> adjustments =
                new ArrayList<>(source.adjustments() != null ? source.adjustments() : List.of());
            // kind stays within the contract's VolumeAdjustment.kind enum — a weekly move is "pattern".
            adjustments.add(new ProvenanceEnvelope.Adjustment("pattern", label, Map.of(),
                deloadByGroup.get(row.getMuscle())));
            row.setSource(new ProvenanceEnvelope(
                source.baseline(), adjustments, source.confidence(), source.note(), source.userOverride()));
            touched.add(row);
        }
        volumeLogRepository.saveAll(touched);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_WEEK_PROPOSAL_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }

    private static SystemRuntimeErrorException closed() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_WEEK_PROPOSAL_CLOSED").build(), HttpStatus.CONFLICT);
    }

    private static SystemRuntimeErrorException invalid() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_WEEK_PROPOSAL_DECISION_INVALID").build(), HttpStatus.BAD_REQUEST);
    }
}

package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates the weekly konzílium end to end (Karakter spec §6, mezo-1gim.5): gathers the
 * week's not-yet-consumed observations — plus any still-unconsumed observations from the PRIOR
 * week, since {@code CharacterObservationJob} only writes a day's observations the following
 * 02:50 and the target week's own Sunday can never be ready in time for this run — runs the
 * proposal round then the verdict round, persists
 * the conference row FIRST so claims can reference its id, applies the rulings/chapter openings,
 * rewrites the portrait of every dimension an accepted ruling (or a chapter opened this run)
 * touched, and finally marks every gathered observation consumed. One {@code @Transactional}
 * method: any failure escaping steps 3–7 rolls the whole conference back — no partial row, no
 * orphaned claims.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterConferenceService {

    private static final String WEEKLY = "WEEKLY";
    private static final String ACTIVE = "ACTIVE";
    private static final String PORTRAIT_REWRITTEN = "PORTRAIT_REWRITTEN";

    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterObservationRepository observationRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final ClaimLifecycle claimLifecycle;
    private final PortraitWriter portraitWriter;
    private final CharacterRunLog runLog;

    /**
     * Runs (or returns the already-run) weekly konzílium for {@code owner}'s {@code weekStart}
     * (an ISO Monday). Idempotent: a live WEEKLY row for the week short-circuits to that row.
     * Returns {@code null} — no row, no LLM calls — when the week has no unconsumed observations
     * (the honest empty week).
     */
    @Transactional
    public CharacterConferenceEntity runWeekly(UUID owner, LocalDate weekStart) {
        Optional<CharacterConferenceEntity> existing =
                conferenceRepository.findByCreatedByAndKindAndWeekStart(owner, WEEKLY, weekStart);
        if (existing.isPresent()) {
            return existing.get();
        }

        // Lower bound reaches back a full week: CharacterObservationJob only writes day D's
        // observations at 02:50 on D+1, so the LAST day of the target week (Sunday) never has
        // its observations yet when this runs at Sunday 19:30 the same day it's harvesting — and
        // once this week's WEEKLY row exists, runWeekly short-circuits on it forever, so those
        // stragglers could never be picked up on a later run without this sweep. Already-consumed
        // rows are excluded by ConsumedByConferenceIdIsNull, so nothing is double-counted.
        LocalDate gatherStart = weekStart.minusDays(7);
        LocalDate weekEnd = weekStart.plusDays(6);
        List<CharacterObservationEntity> weekObservations = observationRepository
                .findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, gatherStart, weekEnd);
        if (weekObservations.isEmpty()) {
            return null;
        }

        KonziliumProposalRound.Result proposalResult = proposalRound.run(owner, weekStart, weekObservations);
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, weekStart, proposalResult.proposals());

        warnUnaddressedUserFeedback(owner, weekObservations, proposalResult.proposals());

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        CharacterConferenceEntity conference = persistConferenceAndApplyOutcome(owner, WEEKLY, weekStart,
                transcriptTurns, verdictResult.chapters(), verdictResult.rulings());

        for (CharacterObservationEntity observation : weekObservations) {
            observation.setConsumedByConferenceId(conference.getId());
        }
        observationRepository.saveAll(weekObservations);

        // WEEKLY run-row, ONLY on a newly created conference (Karakter S9 Gépterem, mezo-1gim.14)
        // — the idempotent short-circuit above (a live row already exists) and the empty-week
        // null return both skip this: neither one is a run that happened just now. call_count is
        // deliberately left 0 here: KonziliumProposalRound/KonziliumVerdictRound's Result records
        // don't expose a reliable "LLM calls actually made" count (a called expert can yield zero
        // proposals, the verdict round can skip a call when there are no proposals, and portrait
        // rewrites aren't counted here at all) — rather than fabricate an approximate number, this
        // leaves call_count honestly at 0 and points readers at the AI-napló (llm_log_history,
        // via LlmCallContext("character", ...)) as the actual call-count truth. Own try/catch
        // (defense in depth on top of record()'s internal one) so a run-log failure can never
        // break the konzílium.
        try {
            List<String> expertKeys = weekObservations.stream()
                    .map(CharacterObservationEntity::getExpertKey)
                    .distinct()
                    .toList();
            List<String> detectorKeys = weekObservations.stream()
                    .flatMap(o -> o.getSignals().signals().stream())
                    .map(ObservationSignalsEnvelope.Signal::detectorKey)
                    .distinct()
                    .toList();
            runLog.record(owner, WEEKLY, weekStart, weekObservations.size(), 0,
                    detectorKeys, expertKeys, conference.getId());
        } catch (Exception e) {
            log.warn("WEEKLY run-log record call failed for owner {} weekStart {}", owner, weekStart, e);
        }

        return conference;
    }

    /**
     * The honest minimum for the "correction is a mandatory next-konzílium input" claim (F3,
     * fix round 2, mezo-1gim.10): nothing upstream actually verifies a proposal addressed a
     * consumed user-feedback correction, and every gathered observation — including an ignored
     * one — is marked consumed unconditionally right after this method returns, so an ignored
     * correction is gone forever with no trace. This does not enforce anything; it only makes the
     * gap visible: for every consumed CORRECTION (NEM_IGAZ or PONTOSITOM — see
     * {@link CharacterFeedbackService#isCorrection}) whose claim id does not appear as the
     * {@code claimId} of any proposal this round produced, logs a WARN naming the claim id so the
     * gap shows up in logs instead of silently vanishing. A plain TALAL confirmation carries no
     * such obligation — it is deliberately EXCLUDED here (fix round 2, F1) so this WARN stays a
     * signal worth reading rather than routine noise that trains people to ignore it.
     */
    private void warnUnaddressedUserFeedback(UUID owner, List<CharacterObservationEntity> weekObservations,
                                              List<ClaimProposal> proposals) {
        Set<UUID> addressedClaimIds = new HashSet<>();
        for (ClaimProposal proposal : proposals) {
            if (proposal.claimId() != null) {
                addressedClaimIds.add(proposal.claimId());
            }
        }
        for (CharacterObservationEntity observation : weekObservations) {
            if (!CharacterFeedbackService.USER_EXPERT_KEY.equals(observation.getExpertKey())
                    || !CharacterFeedbackService.isCorrection(observation)) {
                continue;
            }
            UUID claimId = userFeedbackClaimId(observation);
            if (claimId != null && !addressedClaimIds.contains(claimId)) {
                log.warn("User feedback correction on claim {} (owner {}) was consumed by the weekly konzílium "
                        + "without any proposal referencing it — the correction went unaddressed", claimId, owner);
            }
        }
    }

    /** The claim id a user-feedback observation names, read back off its own
     *  {@link CharacterFeedbackService#SIGNAL_KEY} signal's {@code refIds} — {@code null} when the
     *  observation carries no such signal or an unparseable ref (never happens for observations
     *  {@link CharacterFeedbackService} itself writes, but this stays defensive rather than
     *  throwing on a malformed row). */
    private static UUID userFeedbackClaimId(CharacterObservationEntity observation) {
        if (observation.getSignals() == null) {
            return null;
        }
        for (ObservationSignalsEnvelope.Signal signal : observation.getSignals().signals()) {
            if (CharacterFeedbackService.SIGNAL_KEY.equals(signal.detectorKey()) && !signal.refIds().isEmpty()) {
                try {
                    return UUID.fromString(signal.refIds().get(0));
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * The shared konzílium tail (Karakter S4, mezo-1gim.6): persists the conference row FIRST
     * (so claims can reference its id), applies chapter openings then claim rulings, rewrites the
     * portrait of every dimension either touched, and sets the final outcome — the EXACT sequence
     * {@link #runWeekly} always used, now shared verbatim with {@code CharacterBootstrapService}
     * so the two entry points can never drift apart. Observation consumption is the CALLER's
     * concern (only {@link #runWeekly} has observations to consume); this method never touches
     * {@link CharacterObservationRepository}. Package-visible for {@code CharacterBootstrapService}.
     */
    @Transactional
    CharacterConferenceEntity persistConferenceAndApplyOutcome(UUID owner, String kind, LocalDate weekStart,
            List<ConferenceTranscriptEnvelope.Turn> transcriptTurns,
            List<KonziliumVerdictRound.ChapterProposal> chapters, List<ClaimRuling> rulings) {
        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind(kind);
        conference.setWeekStart(weekStart);
        conference.setGeneratedAt(Instant.now());
        conference.setTranscript(new ConferenceTranscriptEnvelope(transcriptTurns));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        conference = conferenceRepository.save(conference);

        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        List<ConferenceOutcomeEnvelope.Change> chapterChanges =
                claimLifecycle.openChapters(owner, conference.getId(), chapters);
        changes.addAll(chapterChanges);
        List<ConferenceOutcomeEnvelope.Change> claimChanges =
                claimLifecycle.apply(owner, conference.getId(), rulings);
        changes.addAll(claimChanges);

        Set<String> touchedDimensionKeys = new LinkedHashSet<>();
        for (ConferenceOutcomeEnvelope.Change change : chapterChanges) {
            if (change.dimensionKey() != null) {
                touchedDimensionKeys.add(change.dimensionKey());
            }
        }
        for (ConferenceOutcomeEnvelope.Change change : claimChanges) {
            if (change.dimensionKey() != null) {
                touchedDimensionKeys.add(change.dimensionKey());
            }
        }

        for (String dimensionKey : touchedDimensionKeys) {
            Optional<CharacterDimensionEntity> dimension = dimensionRepository.findByCreatedByAndKey(owner, dimensionKey);
            if (dimension.isEmpty()) {
                continue;
            }
            List<CharacterClaimEntity> activeClaims = claimRepository
                    .findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dimension.get().getId(), ACTIVE);
            boolean rewritten = portraitWriter.rewrite(owner, dimension.get(), activeClaims, conference.getId());
            if (rewritten) {
                changes.add(new ConferenceOutcomeEnvelope.Change(
                        PORTRAIT_REWRITTEN, dimensionKey, null, dimension.get().getTitle()));
            }
        }

        conference.setOutcome(new ConferenceOutcomeEnvelope(changes));
        return conferenceRepository.save(conference);
    }
}

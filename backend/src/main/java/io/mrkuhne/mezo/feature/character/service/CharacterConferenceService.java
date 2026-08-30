package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
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

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind(WEEKLY);
        conference.setWeekStart(weekStart);
        conference.setGeneratedAt(Instant.now());
        conference.setTranscript(new ConferenceTranscriptEnvelope(transcriptTurns));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        conference = conferenceRepository.save(conference);

        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        List<ConferenceOutcomeEnvelope.Change> chapterChanges =
                claimLifecycle.openChapters(owner, conference.getId(), verdictResult.chapters());
        changes.addAll(chapterChanges);
        List<ConferenceOutcomeEnvelope.Change> claimChanges =
                claimLifecycle.apply(owner, conference.getId(), verdictResult.rulings());
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
        conference = conferenceRepository.save(conference);

        for (CharacterObservationEntity observation : weekObservations) {
            observation.setConsumedByConferenceId(conference.getId());
        }
        observationRepository.saveAll(weekObservations);

        return conference;
    }
}

package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one-time monthly bootstrap konzílium (Karakter S4, mezo-1gim.6): a deep read over the
 * user's WHOLE existing history — daily-summary narratives, confirmed patterns, prompt-eligible
 * knowledge facts (via {@link CharacterHistoryReads#gatherHistory}) — run through the SAME
 * per-expert proposal round ({@link KonziliumProposalRound#runOnEvidence}) and verdict round
 * ({@link KonziliumVerdictRound#run}) the weekly konzílium uses, then persisted via
 * {@link CharacterConferenceService}'s shared tail so the two entry points can never drift apart.
 *
 * <p>Unlike the weekly konzílium, bootstrap is one-time-EVER per owner (not idempotent per
 * period): a second call is a hard {@code 409 CONFLICT}, never a silent re-run. It reads history,
 * never observations — {@code CharacterObservationJob}'s consumption bookkeeping is entirely
 * untouched by this class.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterBootstrapService {

    /** The bootstrap proposal prompt's first line — the fake LLM keys its deterministic answer on
     *  it, sharing {@link KonziliumProposalRound#PROPOSAL_MARKER}'s canned-answer shape. */
    public static final String BOOTSTRAP_MARKER = "KARAKTER-BOOTSTRAP-FELADAT";

    private static final String BOOTSTRAP = "BOOTSTRAP";
    private static final String PERIOD_LABEL = "Teljes eddigi történet";
    private static final String AUDIT_OP = "bootstrap";

    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterHistoryReads historyReads;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final CharacterConferenceService conferenceService;
    private final CharacterService characterService;

    /**
     * Runs the bootstrap konzílium for {@code owner}. A live BOOTSTRAP row already existing is a
     * hard conflict (bootstrap runs at most once, ever). Returns {@code null} — no row, no LLM
     * calls — when the user has no history yet (the honest empty state).
     */
    @Transactional
    public CharacterConferenceEntity run(UUID owner) {
        if (conferenceRepository.findFirstByCreatedByAndKindOrderByGeneratedAtDesc(owner, BOOTSTRAP).isPresent()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_BOOTSTRAP_ALREADY_RUN").build(), HttpStatus.CONFLICT);
        }

        // A user can POST here before ever GETting /api/character — without this, the proposal
        // round's NEW proposals validate fine (KonziliumProposalRound checks the STATIC CORE key
        // catalog, not the DB) and get accepted rulings, but ClaimLifecycle.applyNew then finds no
        // dimension row, logs a warning, and silently drops every claim — a 200 with a full
        // transcript but an empty dossier (fix-round-1 finding, mezo-1gim.6).
        characterService.ensureCoreDimensions(owner);

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);
        if (evidence.isEmpty()) {
            return null;
        }

        KonziliumProposalRound.Result proposalResult =
                proposalRound.runOnEvidence(owner, PERIOD_LABEL, BOOTSTRAP_MARKER, AUDIT_OP, evidence);
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, null, proposalResult.proposals());

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        return conferenceService.persistConferenceAndApplyOutcome(owner, BOOTSTRAP, null,
                transcriptTurns, verdictResult.chapters(), verdictResult.rulings());
    }
}

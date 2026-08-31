package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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
    /** The bootstrap transcript turn's honest evidence phrase (final-review Finding M4,
     *  mezo-1gim.6) — this konzílium reads the user's WHOLE history via
     *  {@link CharacterHistoryReads#gatherHistory} (daily-summary narratives, confirmed patterns,
     *  prompt-eligible facts), never "the week's observations", so the transcript must say so. */
    private static final String BOOTSTRAP_EVIDENCE_PHRASE = "a teljes előzmény %d bejegyzéséből";

    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterHistoryReads historyReads;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final CharacterConferenceService conferenceService;
    private final CharacterService characterService;
    private final CharacterRunLog runLog;

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

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);
        if (evidence.isEmpty()) {
            return null;
        }

        // A user can POST here before ever GETting /api/character — without this, the proposal
        // round's NEW proposals validate fine (KonziliumProposalRound checks the STATIC CORE key
        // catalog, not the DB) and get accepted rulings, but ClaimLifecycle.applyNew then finds no
        // dimension row, logs a warning, and silently drops every claim — a 200 with a full
        // transcript but an empty dossier (fix-round-1 finding, mezo-1gim.6). Seeded HERE — after
        // the no-history return (final-review Finding M5: no CORE rows written for a user this
        // bootstrap is about to no-op for) but still before the proposal round, so an accepted
        // claim always has somewhere to land.
        characterService.ensureCoreDimensions(owner);

        KonziliumProposalRound.Result proposalResult = proposalRound.runOnEvidence(
                owner, PERIOD_LABEL, BOOTSTRAP_MARKER, AUDIT_OP, evidence, BOOTSTRAP_EVIDENCE_PHRASE);
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, null, proposalResult.proposals());

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        CharacterConferenceEntity conference = conferenceService.persistConferenceAndApplyOutcome(owner, BOOTSTRAP,
                null, transcriptTurns, verdictResult.chapters(), verdictResult.rulings());

        // BOOTSTRAP run-row (Karakter S9 Gépterem, mezo-1gim.14) — day is the run date (bootstrap
        // is one-time-EVER per owner, not period-keyed like WEEKLY/MONTHLY, so there is no anchor
        // period to use instead). The empty-history null return above skips this — that path
        // never ran a konzílium. call_count is deliberately left 0, same reasoning as
        // CharacterConferenceService's WEEKLY row (see that class's javadoc) — the AI-napló
        // (llm_log_history) is the call-count truth.
        try {
            List<String> expertKeys = evidence.stream().map(ExpertEvidence::expertKey).distinct().toList();
            int observationCount = evidence.stream().mapToInt(e -> e.lines().size()).sum();
            runLog.record(owner, BOOTSTRAP, LocalDate.now(), observationCount, 0, List.of(), expertKeys,
                    conference.getId());
        } catch (Exception e) {
            log.warn("BOOTSTRAP run-log record call failed for owner {}", owner, e);
        }

        return conference;
    }
}

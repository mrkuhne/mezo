package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
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

    /** Memória mindenhol S10.2 (mezo-eq85.10): the memory-retrieval feature label {@link
     *  #memoryBlock} uses (via {@link LlmCallContext#feature()}) — the EXISTING {@code character}
     *  slug this surface's own top-level LLM calls already carry (they route through {@link
     *  KonziliumProposalRound}/{@link KonziliumVerdictRound}'s own {@code new
     *  LlmCallContext("character", auditOp, ...)} call sites), never a newly invented one. Not
     *  itself passed to {@code companionLlm} — held here only so the retrieval's label is read off
     *  the same literal, not retyped. */
    private static final LlmCallContext CONTEXT = new LlmCallContext("character", AUDIT_OP, null, null);

    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterHistoryReads historyReads;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final KonziliumChapterResolver chapterResolver;
    private final CharacterConferenceService conferenceService;
    private final CharacterService characterService;
    private final CharacterRunLog runLog;
    /** Memória mindenhol S10.2: the {@code [Hosszú távú memória]} block — absent unless the
     *  companion switch is on. */
    private final ObjectProvider<MemoryContextBlock> memoryContextBlock;
    // Self-injected proxy (the LifeEventExtractionService idiom): `run` carries no
    // @Transactional (the HAZARD in task-10-codebase-notes.md §4 — CharacterHistoryReads
    // .gatherHistory and this class's own persisting work are BOTH @Transactional, so a memory
    // retrieval fired while either is open needs 1 (outer) + 4 (retrievers) + the audit writer,
    // at or over the test pool's 5). The retrieval below runs with NO transaction open; the
    // actual persisting work is pulled into runKonzilium and invoked through this proxy — plain
    // `this.runKonzilium(...)` would bypass Spring AOP and get no transactional advice at all.
    private final ObjectProvider<CharacterBootstrapService> self;

    /**
     * Runs the bootstrap konzílium for {@code owner}. A live BOOTSTRAP row already existing is a
     * hard conflict (bootstrap runs at most once, ever). Returns {@code null} — no row, no LLM
     * calls — when the user has no history yet (the honest empty state).
     */
    public CharacterConferenceEntity run(UUID owner) {
        if (conferenceRepository.findFirstByCreatedByAndKindOrderByGeneratedAtDesc(owner, BOOTSTRAP).isPresent()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_BOOTSTRAP_ALREADY_RUN").build(), HttpStatus.CONFLICT);
        }

        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);
        if (evidence.isEmpty()) {
            return null;
        }

        // Memória mindenhol S10.2: the retrieval runs HERE, with NO transaction open — see the
        // `self` field javadoc for the HAZARD this avoids. The query is the SAME daily-summary
        // narratives `gatherHistory` routes to every expert (narrativeQueryText's own javadoc
        // explains why it re-reads rather than re-derives from the mixed evidence lines).
        String memoryQuery = historyReads.narrativeQueryText(owner);
        MemoryContextBlock.Rendered mem = memoryBlock(owner, LocalDate.now(), memoryQuery);
        List<ExpertEvidence> evidenceWithMemory = mem.block().isEmpty()
                ? evidence
                : evidence.stream().map(e -> e.withLine(mem.block(), "memory")).toList();

        return self.getObject().runKonzilium(owner, evidence, evidenceWithMemory);
    }

    /** The proposal/verdict rounds + persistence, in ONE transaction — called only through
     *  {@link #self} (see its javadoc). {@code evidence} (WITHOUT the memory line) feeds the
     *  run-log's expert-key/observation-count bookkeeping, unchanged from before this slice;
     *  {@code evidenceWithMemory} is what the proposal round actually sees. */
    // Package-private, unlike the house precedent LifeEventExtractionService.persistCandidates
    // (public): that is safe ONLY because Spring proxies this bean with CGLIB (class-based),
    // which can override a package-private method in the same package. Were proxyTargetClass
    // ever turned off, or this class given an interface, @Transactional here would silently
    // stop applying — the retrieval above would then run inside the caller's transaction and
    // hit the pool-exhaustion hazard. Widen to public if that ever changes (mezo-eq85.10).
    @Transactional
    CharacterConferenceEntity runKonzilium(
            UUID owner, List<ExpertEvidence> evidence, List<ExpertEvidence> evidenceWithMemory) {
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
                owner, PERIOD_LABEL, BOOTSTRAP_MARKER, AUDIT_OP, evidenceWithMemory, BOOTSTRAP_EVIDENCE_PHRASE);
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, null, proposalResult.proposals(), List.of());

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        // The structure is assembled and STORED here too (mezo-xlvr final review, I4): without
        // it a brand-new row would be re-derived from its own prose on every read, throwing away
        // chapter membership, kind and claim id. This konzílium has no cross-talk round, so the
        // reaction list is honestly empty.
        ConferenceDeliberationEnvelope deliberation = DeliberationAssembler.assemble(
                proposalResult.proposals(), List.of(), verdictResult.verdicts(),
                verdictResult.shownRulings(), chapterResolver.resolve(owner, proposalResult.proposals()));

        CharacterConferenceEntity conference = conferenceService.persistConferenceAndApplyOutcome(owner, BOOTSTRAP,
                null, transcriptTurns, verdictResult.chapters(), verdictResult.rulings(), deliberation);

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

    /** The {@code [Hosszú távú memória]} block for this bootstrap run, or {@link
     *  MemoryContextBlock.Rendered#EMPTY} when the bean is absent, the {@code CHARACTER_EVIDENCE}
     *  policy is disabled, or retrieval fails — {@link MemoryContextBlock#render} is itself
     *  fail-open. {@code deep = true}: bootstrap is a one-time deep read, not a chat turn. */
    private MemoryContextBlock.Rendered memoryBlock(UUID userId, LocalDate asOf, String query) {
        MemoryContextBlock block = memoryContextBlock.getIfAvailable();
        if (block == null) {
            return MemoryContextBlock.Rendered.EMPTY;
        }
        return block.render(userId, ConsumerPolicy.CHARACTER_EVIDENCE, query, asOf, true,
                CONTEXT.feature(), AUDIT_OP, null);
    }
}

package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The monthly deep-read konzílium (Karakter S4, mezo-1gim.6): once a month — on the month's
 * FIRST Sunday, gated in {@link CharacterMonthlyJob#isDeepReadDay} — re-reads EVERY owner
 * dimension's own ACTIVE claims (not fresh observations) through the SAME per-expert proposal
 * round ({@link KonziliumProposalRound#runOnEvidence}) and verdict round
 * ({@link KonziliumVerdictRound#run}) the weekly/bootstrap konzíliums use, then persists via
 * {@link CharacterConferenceService}'s shared tail so all three entry points can never drift
 * apart. The monthly prompt contract — steering every expert toward SLOW DRIFT and stale claims,
 * UP/DOWN/RETIRE preferred over NEW — is baked into {@link #MONTHLY_MARKER}'s own text, which the
 * caller supplies as the marker argument: {@link KonziliumProposalRound#runExpert} composes the
 * expert's system prompt as {@code marker + "\n" + persona + "\n" + outputContract}, so anything
 * beyond the marker's own first line rides along as the opening block of that system prompt.
 *
 * <p>After the shared tail, this class ALSO retires stale {@code CHAPTER} dimensions (never
 * {@code CORE}, Karakter spec §2): any chapter with no ACTIVE claim left AND an {@code updatedAt}
 * older than {@code staleChapterDays} is soft-deleted and recorded as a {@code CHAPTER_RETIRED}
 * change appended onto the SAME conference row's outcome.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterMonthlyService {

    /** The monthly proposal prompt's opening block — the fake LLM keys its deterministic answer
     *  on the FIRST LINE (shared shape with {@link KonziliumProposalRound#PROPOSAL_MARKER}), while
     *  the rest of the block is the monthly-specific drift/staleness contract this class hands to
     *  {@link KonziliumProposalRound#runOnEvidence} as the marker itself. */
    public static final String MONTHLY_MARKER = "KARAKTER-HAVI-FELADAT\n"
            + "Ez egy HAVI mélyolvasás: ne friss mintát keress, hanem a hónapok óta lassan alakuló "
            + "ELMOZDULÁST és az adatok által már nem alátámasztott, elavult állításokat figyeld. "
            + "UP/DOWN/RETIRE javaslatot részesíts előnyben NEW helyett, és javasolj RETIRE-t "
            + "mindenre, amit a jelenlegi adatok már nem támasztanak alá.";

    private static final String MONTHLY = "MONTHLY";
    /** The monthly transcript turn's honest evidence phrase (final-review Finding M4,
     *  mezo-1gim.6) — this konzílium re-reads the owner's own EXISTING ACTIVE claims, never fresh
     *  observations, so the transcript must say so. */
    private static final String MONTHLY_EVIDENCE_PHRASE = "a %d aktív állításból";
    private static final String CHAPTER = "CHAPTER";
    private static final String ACTIVE = "ACTIVE";
    private static final String CHAPTER_RETIRED = "CHAPTER_RETIRED";
    private static final String AUDIT_OP = "monthly";
    /** CHAPTER dimensions have no owning expert (Karakter spec §4) — their claims fold into
     *  Drill's evidence block, since the fegyelem/discipline persona is the closest thing this
     *  catalog has to a "no owner" catch-all for the monthly deep read. */
    private static final String CHAPTER_CLAIMS_EXPERT_KEY = "drill";

    /** Memória mindenhol S10.2 (mezo-eq85.10): the memory-retrieval feature label {@link
     *  #memoryBlock} uses (via {@link LlmCallContext#feature()}) — the EXISTING {@code character}
     *  slug this surface's own top-level LLM calls already carry (via {@link
     *  KonziliumProposalRound}/{@link KonziliumVerdictRound}), never a newly invented one. */
    private static final LlmCallContext CONTEXT = new LlmCallContext("character", AUDIT_OP, null, null);

    /** First N chars of the query text handed to memory retrieval — the {@code MemoirGenerator}
     *  precedent ({@code firstChars}). */
    private static final int MEMORY_QUERY_MAX_CHARS = 800;

    // Mindig létező emit-fasád: kikapcsolt feed mellett néma no-op (mezo-0cbh).
    private final CharacterCouncilBudget budget;
    private final CharacterMutationLock mutationLock;
    private final AppNotificationEmitter notificationEmitter;
    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final KonziliumCrossTalkRound crossTalkRound;
    private final CharacterCouncilEvidenceTools evidenceTools;
    private final KonziliumChapterResolver chapterResolver;
    private final CharacterConferenceService conferenceService;
    private final CharacterService characterService;
    private final CharacterProperties properties;
    private final CharacterRunLog runLog;
    /** Memória mindenhol S10.2: the {@code [Hosszú távú memória]} block — absent unless the
     *  companion switch is on. */
    private final ObjectProvider<MemoryContextBlock> memoryContextBlock;
    // Self-injected proxy (the CharacterBootstrapService/LifeEventExtractionService idiom): `run`
    // carries no @Transactional (the HAZARD in task-10-codebase-notes.md §4). The retrieval below
    // runs with no transaction open; the actual persisting work is pulled into runKonzilium and
    // invoked through this proxy — plain `this.runKonzilium(...)` would bypass Spring AOP.
    private final ObjectProvider<CharacterMonthlyService> self;

    /**
     * Runs (or returns the already-run) monthly deep read for {@code owner}'s {@code monthStart}
     * (the month's first day, stored in the conference row's {@code weekStart}). Idempotent: a
     * live MONTHLY row for the month short-circuits to that row. Returns {@code null} — no row,
     * no LLM calls — when the owner has no ACTIVE claims yet (the honest empty dossier).
     */
    public CharacterConferenceEntity run(UUID owner, LocalDate monthStart) {
        return budget.run(owner, false, () -> runWithinBudget(owner, monthStart));
    }

    private CharacterConferenceEntity runWithinBudget(UUID owner, LocalDate monthStart) {
        Optional<CharacterConferenceEntity> existing =
                conferenceRepository.findByCreatedByAndKindAndWeekStart(owner, MONTHLY, monthStart);
        if (existing.isPresent()) {
            return existing.get();
        }

        List<CharacterClaimEntity> activeClaims =
                claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, ACTIVE);
        if (activeClaims.isEmpty()) {
            return null;
        }

        Map<UUID, CharacterDimensionEntity> dimensionsById = new HashMap<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            dimensionsById.put(dimension.getId(), dimension);
        }
        List<ExpertEvidence> evidence = buildEvidence(activeClaims, dimensionsById);

        // Memória mindenhol S10.2: the retrieval runs HERE, with NO transaction open (the HAZARD
        // in task-10-codebase-notes.md §4 — `run` used to be @Transactional itself). The query is
        // the dimension's own claims text — reused from `activeClaims`, no extra table read.
        String memoryQuery = firstChars(activeClaims.stream().map(CharacterClaimEntity::getText)
                .collect(Collectors.joining(" ")), MEMORY_QUERY_MAX_CHARS);
        MemoryContextBlock.Rendered mem = memoryBlock(owner, monthStart, memoryQuery);
        List<ExpertEvidence> evidenceWithMemory = mem.block().isEmpty()
                ? evidence
                : evidence.stream().map(e -> e.withLine(mem.block(), "memory")).toList();

        return self.getObject().runKonzilium(owner, monthStart, activeClaims, evidence, evidenceWithMemory);
    }

    /** The proposal/verdict rounds + persistence, in ONE transaction — called only through
     *  {@link #self} (see its javadoc). {@code evidence} (WITHOUT the memory line) feeds the
     *  run-log's expert-key bookkeeping; {@code evidenceWithMemory} is what the proposal round
     *  actually sees. */
    // Package-private, unlike the house precedent LifeEventExtractionService.persistCandidates
    // (public): that is safe ONLY because Spring proxies this bean with CGLIB (class-based),
    // which can override a package-private method in the same package. Were proxyTargetClass
    // ever turned off, or this class given an interface, @Transactional here would silently
    // stop applying — the retrieval above would then run inside the caller's transaction and
    // hit the pool-exhaustion hazard. Widen to public if that ever changes (mezo-eq85.10).
    @Transactional
    CharacterConferenceEntity runKonzilium(UUID owner, LocalDate monthStart,
            List<CharacterClaimEntity> activeClaims, List<ExpertEvidence> evidence,
            List<ExpertEvidence> evidenceWithMemory) {
        mutationLock.lock(owner);
        // Mirrors CharacterBootstrapService's fix-round-1 guard: a user whose dossier is otherwise
        // still empty (no dimension rows at all) must not silently drop an accepted NEW claim.
        // Seeded HERE — after the no-ACTIVE-claims return (final-review Finding M5: no CORE rows
        // written for a user this monthly run is about to no-op for) but still before the
        // proposal round, so an accepted claim always has somewhere to land.
        characterService.ensureCoreDimensions(owner);

        String periodLabel = "Havi mélyolvasás: " + monthStart;
        // includeActiveClaimsTrailer=false (fix round 1, mezo-1gim.6): this evidence is built
        // DIRECTLY from ACTIVE claims (buildEvidence, with age/last-movement metadata), so the
        // proposal round's own "Meglévő aktív állítások" trailer would otherwise re-render the
        // SAME claims a second time in one user message for any CORE-owning expert.
        KonziliumProposalRound.Result proposalResult = proposalRound.runOnEvidence(
                owner, periodLabel, MONTHLY_MARKER, AUDIT_OP, evidenceWithMemory, false, MONTHLY_EVIDENCE_PHRASE);
        // weekStart=null here (not monthStart): KonziliumVerdictRound only uses it to render a
        // "Hét: …" period label for the szkeptikus/integrátor prompts — a real week range would be
        // misleading for a whole-dossier monthly pass, so this rides the SAME null-weekStart path
        // CharacterBootstrapService uses ("Teljes eddigi történet"). The conference row's OWN
        // weekStart (monthStart) is set below, independently, by persistConferenceAndApplyOutcome.
        var evidenceSession = evidenceTools.open(owner);
        var discussion = crossTalkRound.run(owner, null, proposalResult.proposals(), evidenceSession);
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, null, proposalResult.proposals(),
                discussion.reactions(), evidenceSession);

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        // The structure is assembled and STORED here too (mezo-xlvr final review, I4): without
        // it a brand-new row would be re-derived from its own prose on every read, throwing away
        // chapter membership, kind and claim id. The same bounded debate is stored for every run kind.
        ConferenceDeliberationEnvelope deliberation = DeliberationAssembler.assemble(
                proposalResult.proposals(), discussion.reactions(), verdictResult.verdicts(),
                verdictResult.shownRulings(), chapterResolver.resolve(owner, proposalResult.proposals()));

        CharacterConferenceEntity conference = conferenceService.persistConferenceAndApplyOutcome(owner, MONTHLY,
                monthStart, transcriptTurns, verdictResult.chapters(), verdictResult.rulings(), deliberation);
        conference.setFollowups(verdictResult.followups());

        List<ConferenceOutcomeEnvelope.Change> retirementChanges = retireStaleChapters(owner);
        if (!retirementChanges.isEmpty()) {
            List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>(conference.getOutcome().changes());
            changes.addAll(retirementChanges);
            conference.setOutcome(new ConferenceOutcomeEnvelope(changes));
            conference = conferenceRepository.save(conference);
        }

        // MONTHLY run-row, ONLY on a newly created conference (Karakter S9 Gépterem,
        // mezo-1gim.14) — the idempotent short-circuit above (a live row already exists) and the
        // no-ACTIVE-claims null return both skip this. detector_keys is deliberately empty: the
        // monthly deep read re-reads EXISTING active claims, not fresh detector signals, so there
        // are none to name. call_count is deliberately left 0, same as CharacterConferenceService's
        // WEEKLY row — see that class's javadoc for why an approximate LLM-call count isn't worth
        // fabricating; the AI-napló (llm_log_history) is the call-count truth.
        try {
            List<String> expertKeys = evidence.stream().map(ExpertEvidence::expertKey).distinct().toList();
            runLog.record(owner, MONTHLY, monthStart, activeClaims.size(), 0, List.of(), expertKeys, conference.getId());
        } catch (Exception e) {
            log.warn("MONTHLY run-log record call failed for owner {} monthStart {}", owner, monthStart, e);
        }

        emitPortraitNotification(owner, monthStart, conference);
        return conference;
    }

    /** The {@code [Hosszú távú memória]} block for this monthly run, or {@link
     *  MemoryContextBlock.Rendered#EMPTY} when the bean is absent, the {@code CHARACTER_EVIDENCE}
     *  policy is disabled, or retrieval fails — {@link MemoryContextBlock#render} is itself
     *  fail-open. {@code deep = true}: the monthly deep read is offline-shaped, not a chat turn. */
    private MemoryContextBlock.Rendered memoryBlock(UUID userId, LocalDate asOf, String query) {
        MemoryContextBlock block = memoryContextBlock.getIfAvailable();
        if (block == null) {
            return MemoryContextBlock.Rendered.EMPTY;
        }
        return block.render(userId, ConsumerPolicy.CHARACTER_EVIDENCE, query, asOf, true,
                CONTEXT.feature(), AUDIT_OP, null);
    }

    /** First {@code maxChars} characters of {@code text} — the memory-query truncation every
     *  Part-B surface uses ({@code MemoirGenerator.firstChars} precedent). */
    private static String firstChars(String text, int maxChars) {
        if (text == null) {
            return "";
        }
        return text.length() <= maxChars ? text : text.substring(0, maxChars);
    }

    /**
     * Groups every ACTIVE claim by its dimension's owning expert into one {@link ExpertEvidence}
     * block each — a CORE dimension's claims go to its {@code expertKey}; a CHAPTER dimension's
     * claims (no owning expert) go to {@link #CHAPTER_CLAIMS_EXPERT_KEY}. Each line renders
     * {@code "<claimId> (biztonság <confidence>, kora <days> nap, utolsó mozgás <days> nap):
     * <text>"} — age from {@code createdAt}, last movement from {@code updatedAt} — so the SLOW
     * DRIFT the monthly prompt asks experts to look for is visible directly in the evidence.
     */
    private static List<ExpertEvidence> buildEvidence(List<CharacterClaimEntity> activeClaims,
                                                        Map<UUID, CharacterDimensionEntity> dimensionsById) {
        Instant now = Instant.now();
        Map<String, List<String>> linesByExpert = new LinkedHashMap<>();
        Map<String, List<String>> refIdsByExpert = new LinkedHashMap<>();
        for (CharacterClaimEntity claim : activeClaims) {
            CharacterDimensionEntity dimension = dimensionsById.get(claim.getDimensionId());
            if (dimension == null) {
                continue;
            }
            String expertKey = CHAPTER.equals(dimension.getKind())
                    ? CHAPTER_CLAIMS_EXPERT_KEY : dimension.getExpertKey();
            if (expertKey == null) {
                continue;
            }
            long ageDays = Duration.between(claim.getCreatedAt(), now).toDays();
            long lastMoveDays = Duration.between(claim.getUpdatedAt(), now).toDays();
            String line = claim.getId() + " (biztonság " + claim.getConfidence() + ", kora " + ageDays
                    + " nap, utolsó mozgás " + lastMoveDays + " nap): " + claim.getText();
            linesByExpert.computeIfAbsent(expertKey, k -> new ArrayList<>()).add(line);
            refIdsByExpert.computeIfAbsent(expertKey, k -> new ArrayList<>()).add(claim.getId().toString());
        }

        List<ExpertEvidence> evidence = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : linesByExpert.entrySet()) {
            evidence.add(new ExpertEvidence(entry.getKey(), entry.getValue(), refIdsByExpert.get(entry.getKey())));
        }
        return evidence;
    }

    /** Soft-deletes every CHAPTER dimension with no ACTIVE claim left AND an {@code updatedAt}
     *  older than {@code staleChapterDays} (Karakter S4, mezo-1gim.6) — CORE dimensions are never
     *  even considered here (spec §2: seeded lazily, never deleted). */
    private List<ConferenceOutcomeEnvelope.Change> retireStaleChapters(UUID owner) {
        Instant cutoff = Instant.now().minus(Duration.ofDays(properties.monthly().staleChapterDays()));
        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            if (!CHAPTER.equals(dimension.getKind())) {
                continue;
            }
            if (dimension.getUpdatedAt().isAfter(cutoff)) {
                continue;
            }
            boolean hasActiveClaims = !claimRepository
                    .findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dimension.getId(), ACTIVE)
                    .isEmpty();
            if (hasActiveClaims) {
                continue;
            }
            dimensionRepository.delete(dimension);
            changes.add(new ConferenceOutcomeEnvelope.Change(
                    CHAPTER_RETIRED, dimension.getKey(), null, dimension.getTitle()));
        }
        return changes;
    }

    /**
     * mezo-0cbh — a {@code memoir_ready} / {@code weekly_review_ready} alakja: „elkészült
     * valami, ami rólad szól". A havi mélyolvasás eddig csak akkor derült ki, ha magadtól
     * benyitottál a Karakter dosszié Konzílium oldalára.
     *
     * <p>A dedup-kulcs a HÓNAP, nem a konferencia id-je: a metódus eleji idempotencia-ág egy
     * újrafutásnál a MEGLÉVŐ sort adja vissza (nem null-t), tehát id-alapú kulccsal minden
     * catch-up futás új értesítést írna ugyanarra a hónapra.
     */
    private void emitPortraitNotification(UUID owner, LocalDate monthStart,
                                          CharacterConferenceEntity conference) {
        if (conference == null) {
            return;   // üres hónap (nincs ACTIVE állítás) — nincs mit bejelenteni
        }
        notificationEmitter.emit(owner, AppNotificationKind.CHARACTER_PORTRAIT,
            "\u00DAj portr\u00E9 k\u00E9sz\u00FClt r\u00F3lad",
            "A havi m\u00E9lyolvas\u00E1s v\u00E9gigment a doszi\u00E9don \u2014 n\u00E9zd meg, mi v\u00E1ltozott.",
            AppNotificationKind.CHARACTER_PORTRAIT.deeplink(), conference.getId(),
            "character_portrait:" + monthStart);
    }

}

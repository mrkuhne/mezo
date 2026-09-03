package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * The weekly konzílium's expert proposal round (Karakter spec §6 step 1, mezo-1gim.5): groups the
 * week's not-yet-consumed observations by expert and asks each affected expert (one cheap-tier
 * {@link CompanionLlm} call each, in its own persona) to propose 0..3 claim changes grounded in
 * ITS OWN observations for the week. Per-expert isolation mirrors {@link CharacterObservationService}
 * — an unknown expert key or a failed/unparseable LLM answer skips only that expert, never the
 * whole round.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class KonziliumProposalRound {

    /** The proposal prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String PROPOSAL_MARKER = "KARAKTER-JAVASLAT-FELADAT";

    /**
     * The weekly transcript turn's evidence phrase (final-review Finding M4, mezo-1gim.6):
     * {@code String.format}-ed with the evidence-line count into "{@code javaslat a hét N
     * megfigyeléséből}" — byte-identical to the pre-fix hardcoded text. Bootstrap/monthly supply
     * their OWN phrase (see {@code CharacterBootstrapService}/{@code CharacterMonthlyService}) so
     * a transcript actually says what that konzílium read: bootstrap reads whole-history entries,
     * not a week's observations; monthly re-reads existing active claims, not fresh ones.
     */
    private static final String WEEKLY_EVIDENCE_PHRASE = "a hét %d megfigyeléséből";

    private static final int MAX_PROPOSALS_PER_EXPERT = 3;
    private static final BigDecimal MIN_CONFIDENCE = BigDecimal.ZERO;
    private static final BigDecimal MAX_CONFIDENCE = BigDecimal.ONE;
    private static final BigDecimal DEFAULT_CONFIDENCE = new BigDecimal("0.50");
    private static final String ACTIVE = "ACTIVE";
    private static final Set<String> VALID_KINDS = Set.of("NEW", "UP", "DOWN", "RETIRE");

    /** CORE + META (round-4 spec §4.2) — the self-audit dimension routes and validates exactly
     *  like a CORE dimension, just owned by the Szkeptikus instead of a domain expert. */
    private static final Set<String> CORE_DIMENSION_KEYS = CharacterCoreCatalog.SEEDED.stream()
            .map(CharacterCoreCatalog.CoreDimension::key)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

    /**
     * CORE + META dimension key -> owning expert key (mezo-1gim.10), reused rather than
     * re-derived, so a user-feedback observation naming a CORE or META dimension routes to
     * exactly the same expert {@link CharacterCoreCatalog} already says owns it.
     */
    private static final Map<String, String> CORE_DIMENSION_TO_EXPERT = CharacterCoreCatalog.SEEDED.stream()
            .collect(java.util.stream.Collectors.toUnmodifiableMap(
                    CharacterCoreCatalog.CoreDimension::key, CharacterCoreCatalog.CoreDimension::expertKey));

    /** A user-feedback observation naming a CHAPTER dimension (or an unknown/missing dimension
     *  key) routes here — the cross-cutting behaviour expert, mirroring {@code CharacterHistoryReads}'
     *  own fallback for its unmatched pattern/fact routing. */
    private static final String USER_FEEDBACK_FALLBACK_EXPERT = "drill";

    /** Prefix a routed user-feedback observation's evidence line gets (Karakter S6 spec §6,
     *  mezo-1gim.10) — makes its authorship unmistakable so the expert cannot mistake Daniel's own
     *  words for a detector signal. */
    static final String USER_FEEDBACK_PREFIX = "DANIEL VÁLASZA — ";

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** One drafted proposal as the LLM returns it, before validation/clamping. */
    record Draft(String kind, String dimensionKey, String claimId, String text, BigDecimal confidence,
                 Boolean sensitive, String rationale) {}

    /** The round's output: every surviving proposal, one transcript turn per expert that answered,
     *  and every input observation's id (the conference consumes them all — including a failed
     *  expert's — so a broken expert never replays forever). */
    public record Result(List<ClaimProposal> proposals, List<ConferenceTranscriptEnvelope.Turn> turns,
                         List<UUID> observationIds) {}

    @Transactional
    public Result run(UUID owner, LocalDate weekStart, List<CharacterObservationEntity> weekObservations) {
        Map<String, List<CharacterObservationEntity>> byExpert = new LinkedHashMap<>();
        for (CharacterObservationEntity observation : weekObservations) {
            for (String expertKey : routeToExperts(observation)) {
                byExpert.computeIfAbsent(expertKey, k -> new ArrayList<>()).add(observation);
            }
        }

        List<ExpertEvidence> evidence = new ArrayList<>();
        for (Map.Entry<String, List<CharacterObservationEntity>> entry : byExpert.entrySet()) {
            List<String> lines = new ArrayList<>();
            List<String> refIds = new ArrayList<>();
            for (CharacterObservationEntity observation : entry.getValue()) {
                String text = CharacterFeedbackService.USER_EXPERT_KEY.equals(observation.getExpertKey())
                        ? USER_FEEDBACK_PREFIX + observation.getText()
                        : observation.getText();
                lines.add(observation.getDay() + " (súly " + observation.getSalience() + "): " + text);
                refIds.add(observation.getId().toString());
            }
            evidence.add(new ExpertEvidence(entry.getKey(), lines, refIds));
        }

        String periodLabel = "Hét: " + weekStart + " – " + weekStart.plusDays(6);
        Result evidenceResult =
                runOnEvidence(owner, periodLabel, PROPOSAL_MARKER, "propose", evidence, true, WEEKLY_EVIDENCE_PHRASE);

        List<UUID> observationIds = weekObservations.stream().map(CharacterObservationEntity::getId).toList();
        return new Result(evidenceResult.proposals(), evidenceResult.turns(), observationIds);
    }

    /**
     * The evidence-block seam (Karakter S4, mezo-1gim.6): runs the SAME per-expert propose/parse/
     * validate/turn pipeline {@link #run} uses, but over caller-supplied {@link ExpertEvidence}
     * blocks instead of a week's observations — the monthly bootstrap konzílium's entry point via
     * {@link CharacterHistoryReads#gatherHistory}. {@code observationIds} is always empty here:
     * this method has no notion of weekly observations to mark consumed — only {@link #run} sets it.
     * Includes the "Meglévő aktív állítások" trailer (see the 7-arg overload's javadoc for why
     * that is the byte-identical behavior weekly/bootstrap callers need). Bootstrap's own honest
     * evidence phrase (final-review Finding M4) is required here, not defaulted — a caller must
     * always say what it actually read.
     */
    @Transactional
    public Result runOnEvidence(UUID owner, String periodLabel, String marker, String auditOp,
                                 List<ExpertEvidence> evidence, String evidencePhraseTemplate) {
        return runOnEvidence(owner, periodLabel, marker, auditOp, evidence, true, evidencePhraseTemplate);
    }

    /**
     * The evidence-block seam with control over the "Meglévő aktív állítások" (existing active
     * claims) trailer {@link #userMessage} normally appends after the evidence lines. Weekly
     * ({@link #run}) and bootstrap ({@code CharacterBootstrapService}) evidence is built from
     * OBSERVATIONS, so that trailer is the only place a claim's current text/confidence appears —
     * {@code includeActiveClaimsTrailer=true} keeps their prompt byte-identical.
     *
     * <p>The monthly deep read ({@code CharacterMonthlyService}) is different: its evidence IS
     * built directly from ACTIVE claims (with age/last-movement metadata the trailer lacks), so
     * for any expert owning a CORE dimension the SAME claim would otherwise be rendered TWICE in
     * one user message — once as a numbered evidence line, once again in the trailer, independently
     * re-queried. Beyond the prompt bloat, that risks the model treating the two renderings as
     * distinct reference points (double-weighted staleness; ambiguity about which rendering a
     * RETIRE targets). {@code includeActiveClaimsTrailer=false} omits the trailer entirely for
     * that caller — fix round 1, mezo-1gim.6.
     */
    @Transactional
    public Result runOnEvidence(UUID owner, String periodLabel, String marker, String auditOp,
                                 List<ExpertEvidence> evidence, boolean includeActiveClaimsTrailer,
                                 String evidencePhraseTemplate) {
        List<CharacterDimensionEntity> ownerDimensions = dimensionRepository.findByCreatedBy(owner);
        Set<String> knownDimensionKeys = knownDimensionKeys(ownerDimensions);
        Map<UUID, CharacterDimensionEntity> dimensionsById = new java.util.HashMap<>();
        for (CharacterDimensionEntity dimension : ownerDimensions) {
            dimensionsById.put(dimension.getId(), dimension);
        }
        List<CharacterClaimEntity> activeClaims = claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, ACTIVE);
        Set<UUID> activeClaimIds = new HashSet<>();
        for (CharacterClaimEntity claim : activeClaims) {
            activeClaimIds.add(claim.getId());
        }

        List<ClaimProposal> proposals = new ArrayList<>();
        List<ConferenceTranscriptEnvelope.Turn> turns = new ArrayList<>();

        for (ExpertEvidence block : evidence) {
            ExpertOutcome outcome = runExpert(owner, periodLabel, marker, auditOp, block, knownDimensionKeys,
                    activeClaims, dimensionsById, activeClaimIds, includeActiveClaimsTrailer, evidencePhraseTemplate);
            if (outcome == null) {
                continue;
            }
            proposals.addAll(outcome.proposals());
            turns.add(outcome.turn());
        }

        return new Result(proposals, turns, List.of());
    }

    /** One expert's outcome from {@link #runExpert} — null-returned (not this record) on skip. */
    private record ExpertOutcome(List<ClaimProposal> proposals, ConferenceTranscriptEnvelope.Turn turn) {}

    /** The per-expert body {@link #run} and {@link #runOnEvidence} both drive: one LLM call in the
     *  expert's persona, parsed/validated against the owner's known dimensions and active claims.
     *  Per-expert isolation: any failure here (unknown expert key, LLM error, blank/unparseable
     *  answer) returns null and skips only this expert — never the whole round. */
    private ExpertOutcome runExpert(UUID owner, String periodLabel, String marker, String auditOp,
                                     ExpertEvidence evidence, Set<String> knownDimensionKeys,
                                     List<CharacterClaimEntity> activeClaims,
                                     Map<UUID, CharacterDimensionEntity> dimensionsById, Set<UUID> activeClaimIds,
                                     boolean includeActiveClaimsTrailer, String evidencePhraseTemplate) {
        String expertKey = evidence.expertKey();
        CharacterExpertCatalog.Expert expert;
        String raw;
        try {
            // byKey lives inside the try too — an unknown expertKey must skip only THIS
            // expert, never abort the whole round (same isolation contract as the LLM call).
            expert = CharacterExpertCatalog.byKey(expertKey);
            List<CharacterClaimEntity> expertActiveClaims = includeActiveClaimsTrailer
                    ? activeClaims.stream()
                            .filter(claim -> {
                                CharacterDimensionEntity dimension = dimensionsById.get(claim.getDimensionId());
                                return dimension != null && expertKey.equals(dimension.getExpertKey());
                            })
                            .toList()
                    : null;
            String systemPrompt = marker + "\n" + expert.systemPersona() + "\n" + outputContract();
            String userMessage = userMessage(periodLabel, evidence.lines(), expertActiveClaims, expert);
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("character", auditOp, "expert", null),
                    () -> companionLlm.complete(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("Proposal generation failed for owner {} expert {} period {}", owner, expertKey, periodLabel, e);
            return null;
        }

        if (raw == null || raw.isBlank()) {
            log.warn("Proposal answer was blank for owner {} expert {} period {}", owner, expertKey, periodLabel);
            return null;
        }

        List<Draft> drafts = parse(raw, owner, expertKey, periodLabel);
        List<ClaimProposal> expertProposals = new ArrayList<>();
        for (Draft draft : drafts) {
            if (expertProposals.size() >= MAX_PROPOSALS_PER_EXPERT) {
                break;
            }
            ClaimProposal proposal = validate(draft, expertKey, knownDimensionKeys, activeClaimIds);
            if (proposal != null) {
                expertProposals.add(proposal);
            }
        }

        ConferenceTranscriptEnvelope.Turn turn = buildTurn(
                expert, evidence.lines().size(), evidence.refIds(), expertProposals, evidencePhraseTemplate);
        return new ExpertOutcome(expertProposals, turn);
    }

    /**
     * Routes one observation to the expert(s) whose evidence it should join (Karakter S6 spec §6,
     * mezo-1gim.10, fixing the bug where {@code expertKey = "user"} had no matching
     * {@link CharacterExpertCatalog} persona and so was silently skipped every week). A normal
     * expert-authored observation stays with its own {@code expertKey} — the nightly pass already
     * picked the right persona, nothing to route. A user-feedback observation (
     * {@link CharacterFeedbackService#USER_EXPERT_KEY}) has no persona of its own, so it is routed
     * by the dimension(s) it names instead: a CORE dimension key routes to that dimension's owning
     * expert ({@link #CORE_DIMENSION_TO_EXPERT}); a CHAPTER dimension key or an unknown/missing
     * dimension key falls back to {@link #USER_FEEDBACK_FALLBACK_EXPERT} — the same fallback shape
     * {@link CharacterHistoryReads} uses for its own unmatched pattern/fact routing. One
     * observation naming two dimensions can join two experts' evidence (a {@link Set} — never
     * doubles up the same observation into the same expert's evidence twice).
     */
    private static Set<String> routeToExperts(CharacterObservationEntity observation) {
        if (!CharacterFeedbackService.USER_EXPERT_KEY.equals(observation.getExpertKey())) {
            return Set.of(observation.getExpertKey());
        }
        List<String> dimensionKeys = observation.getDimensionKeys() == null
                ? List.of() : observation.getDimensionKeys().keys();
        if (dimensionKeys.isEmpty()) {
            return Set.of(USER_FEEDBACK_FALLBACK_EXPERT);
        }
        Set<String> experts = new LinkedHashSet<>();
        for (String dimensionKey : dimensionKeys) {
            experts.add(CORE_DIMENSION_TO_EXPERT.getOrDefault(dimensionKey, USER_FEEDBACK_FALLBACK_EXPERT));
        }
        return experts;
    }

    private static Set<String> knownDimensionKeys(List<CharacterDimensionEntity> ownerDimensions) {
        Set<String> keys = new HashSet<>(CORE_DIMENSION_KEYS);
        for (CharacterDimensionEntity dimension : ownerDimensions) {
            if ("CHAPTER".equals(dimension.getKind())) {
                keys.add(dimension.getKey());
            }
        }
        return keys;
    }

    private static ClaimProposal validate(Draft draft, String expertKey, Set<String> knownDimensionKeys,
                                           Set<UUID> activeClaimIds) {
        if (draft.text() == null || draft.text().isBlank()) {
            return null;
        }
        if (draft.kind() == null || !VALID_KINDS.contains(draft.kind())) {
            return null;
        }
        BigDecimal confidence = clampConfidence(draft.confidence());
        boolean sensitive = draft.sensitive() != null && draft.sensitive();
        if ("NEW".equals(draft.kind())) {
            if (draft.dimensionKey() == null || !knownDimensionKeys.contains(draft.dimensionKey())) {
                return null;
            }
            return new ClaimProposal(expertKey, draft.kind(), draft.dimensionKey(), null, draft.text(),
                    confidence, sensitive, draft.rationale());
        }
        UUID claimId = parseUuid(draft.claimId());
        if (claimId == null || !activeClaimIds.contains(claimId)) {
            return null;
        }
        return new ClaimProposal(expertKey, draft.kind(), null, claimId, draft.text(), confidence, sensitive,
                draft.rationale());
    }

    private static UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static BigDecimal clampConfidence(BigDecimal confidence) {
        BigDecimal value = confidence == null ? DEFAULT_CONFIDENCE : confidence;
        if (value.compareTo(MIN_CONFIDENCE) < 0) {
            return MIN_CONFIDENCE;
        }
        if (value.compareTo(MAX_CONFIDENCE) > 0) {
            return MAX_CONFIDENCE;
        }
        return value;
    }

    private static ConferenceTranscriptEnvelope.Turn buildTurn(CharacterExpertCatalog.Expert expert,
                                                                 int evidenceCount, List<String> refIds,
                                                                 List<ClaimProposal> proposals,
                                                                 String evidencePhraseTemplate) {
        StringBuilder sb = new StringBuilder(expert.displayName()).append(": ").append(proposals.size())
                .append(" javaslat ").append(String.format(evidencePhraseTemplate, evidenceCount)).append('.');
        for (ClaimProposal proposal : proposals) {
            sb.append('\n').append(proposal.text());
        }
        return new ConferenceTranscriptEnvelope.Turn(expert.key(), sb.toString(), refIds);
    }

    private static String outputContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"kind":"NEW|UP|DOWN|RETIRE","dimensionKey":"...","claimId":"...",\
                "text":"...","confidence":0.0-1.0,"sensitive":true|false,"rationale":"..."}]. 0–3 \
                javaslatot adj. NEW típushoz dimensionKey kötelező; UP/DOWN/RETIRE típushoz a \
                felsorolt aktív állítások egyikének claimId-ja kötelező. Minden javaslatot KIZÁRÓLAG \
                a felsorolt megfigyelésekre alapozz — ne találj ki számot vagy tényt. Jelöld \
                sensitive=true-val az önértékelési, elutasítás-mintázati vagy gyógyszerciklus \
                jellegű állításokat. A "DANIEL VÁLASZA —" jelöléssel kezdődő sorok Daniel saját \
                válaszai — ezek FELÜLÍRJÁK az érzékelt jeleket, és a sor elején álló [claimId] \
                jelöli, melyik állításra vonatkoznak — ezt az azonosítót használd a claimId \
                mezőben, ha UP/DOWN/RETIRE javaslatot teszel rá. Egy önmagában álló "talál" \
                megerősítés NEM számít új bizonyítéknak UP javaslathoz — a bizalom emelése már \
                megtörtént a visszajelzés pillanatában (lásd "a bizalom már beszámítva"), a \
                konzíliumnak nem kell rátennie. Egy "nem igaz" cáfolattal érintett állítás MÁR \
                nyugdíjazott (nem szerepel az aktív állítások közt) — itt a feladat eldönteni, \
                szükséges-e egy azt felváltó, javított NEW állítás; RETIRE rá nem javasolható. Egy \
                pontosítást ("pontosítom") viszont még AKTÍV állításra kell címezni: kötelező \
                kezelni (DOWN vagy RETIRE javaslattal a megadott claimId-ra, vagy azt felváltó NEW \
                javaslattal), sosem szabad figyelmen kívül hagyni.""";
    }

    /**
     * {@code expertActiveClaims == null} omits the "Meglévő aktív állítások" trailer entirely
     * (mezo-1gim.6 fix round 1) — the monthly deep read's evidence already carries every ACTIVE
     * claim directly (with age/last-movement metadata this trailer lacks), so re-rendering the
     * SAME claims here would double them up in one user message. An EMPTY (non-null) list still
     * renders the trailer with its honest "nincs" — that is the weekly/bootstrap "no active claims
     * yet" case, unchanged.
     */
    private static String userMessage(String periodLabel, List<String> lines,
                                       List<CharacterClaimEntity> expertActiveClaims,
                                       CharacterExpertCatalog.Expert expert) {
        StringBuilder sb = new StringBuilder(periodLabel)
                .append(" (korábbi, még fel nem dolgozott megfigyelések is szerepelhetnek — lásd az egyes ")
                .append("tételek dátumát)");
        int i = 1;
        for (String line : lines) {
            sb.append('\n').append(i++).append(". ").append(line);
        }
        if (expertActiveClaims != null) {
            sb.append('\n').append("Meglévő aktív állítások:");
            if (expertActiveClaims.isEmpty()) {
                sb.append('\n').append("nincs");
            } else {
                for (CharacterClaimEntity claim : expertActiveClaims) {
                    sb.append('\n').append(claim.getId()).append(" (biztonság ").append(claim.getConfidence())
                            .append("): ").append(claim.getText());
                }
            }
        }
        sb.append('\n').append("Alapértelmezett dimenzió: ").append(expert.primaryDimensionKey());
        return sb.toString();
    }

    private List<Draft> parse(String raw, UUID owner, String expertKey, String periodLabel) {
        String cleaned = stripFences(raw);
        try {
            return objectMapper.readValue(cleaned, new TypeReference<List<Draft>>() {});
        } catch (Exception e) {
            log.warn("Proposal answer was not parseable JSON for owner {} expert {} period {} — dropping: {}",
                    owner, expertKey, periodLabel, raw, e);
            return List.of();
        }
    }

    /** Strips optional ```json fences (and surrounding prose) — mirrors CharacterObservationService's idiom. */
    private static String stripFences(String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            trimmed = firstNewline >= 0 ? trimmed.substring(firstNewline + 1) : trimmed;
            int fenceEnd = trimmed.lastIndexOf("```");
            if (fenceEnd >= 0) {
                trimmed = trimmed.substring(0, fenceEnd);
            }
        }
        int start = trimmed.indexOf('[');
        int end = trimmed.lastIndexOf(']');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }
}

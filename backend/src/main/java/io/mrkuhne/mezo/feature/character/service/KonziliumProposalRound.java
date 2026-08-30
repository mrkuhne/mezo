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

    private static final int MAX_PROPOSALS_PER_EXPERT = 3;
    private static final BigDecimal MIN_CONFIDENCE = BigDecimal.ZERO;
    private static final BigDecimal MAX_CONFIDENCE = BigDecimal.ONE;
    private static final BigDecimal DEFAULT_CONFIDENCE = new BigDecimal("0.50");
    private static final String ACTIVE = "ACTIVE";
    private static final Set<String> VALID_KINDS = Set.of("NEW", "UP", "DOWN", "RETIRE");

    private static final Set<String> CORE_DIMENSION_KEYS = CharacterCoreCatalog.CORE.stream()
            .map(CharacterCoreCatalog.CoreDimension::key)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

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
            byExpert.computeIfAbsent(observation.getExpertKey(), k -> new ArrayList<>()).add(observation);
        }

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

        for (Map.Entry<String, List<CharacterObservationEntity>> entry : byExpert.entrySet()) {
            String expertKey = entry.getKey();
            List<CharacterObservationEntity> observations = entry.getValue();
            CharacterExpertCatalog.Expert expert;
            String raw;
            try {
                // byKey lives inside the try too — an unknown expertKey must skip only THIS
                // expert, never abort the whole round (same isolation contract as the LLM call).
                expert = CharacterExpertCatalog.byKey(expertKey);
                List<CharacterClaimEntity> expertActiveClaims = activeClaims.stream()
                        .filter(claim -> {
                            CharacterDimensionEntity dimension = dimensionsById.get(claim.getDimensionId());
                            return dimension != null && expertKey.equals(dimension.getExpertKey());
                        })
                        .toList();
                String systemPrompt = PROPOSAL_MARKER + "\n" + expert.systemPersona() + "\n" + outputContract();
                String userMessage = userMessage(weekStart, observations, expertActiveClaims, expert);
                raw = llmCallContextHolder.runWith(
                        new LlmCallContext("character", "propose", "expert", null),
                        () -> companionLlm.complete(systemPrompt, userMessage));
            } catch (Exception e) {
                log.warn("Proposal generation failed for owner {} expert {} week {}", owner, expertKey, weekStart, e);
                continue;
            }

            if (raw == null || raw.isBlank()) {
                log.warn("Proposal answer was blank for owner {} expert {} week {}", owner, expertKey, weekStart);
                continue;
            }

            List<Draft> drafts = parse(raw, owner, expertKey, weekStart);
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

            proposals.addAll(expertProposals);
            turns.add(buildTurn(expert, observations, expertProposals));
        }

        List<UUID> observationIds = weekObservations.stream().map(CharacterObservationEntity::getId).toList();
        return new Result(proposals, turns, observationIds);
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
                                                                 List<CharacterObservationEntity> observations,
                                                                 List<ClaimProposal> proposals) {
        StringBuilder sb = new StringBuilder(expert.displayName()).append(": ").append(proposals.size())
                .append(" javaslat a hét ").append(observations.size()).append(" megfigyeléséből.");
        for (ClaimProposal proposal : proposals) {
            sb.append('\n').append(proposal.text());
        }
        List<String> refIds = observations.stream().map(o -> o.getId().toString()).toList();
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
                jellegű állításokat.""";
    }

    private static String userMessage(LocalDate weekStart, List<CharacterObservationEntity> observations,
                                       List<CharacterClaimEntity> expertActiveClaims,
                                       CharacterExpertCatalog.Expert expert) {
        StringBuilder sb = new StringBuilder("Hét: ").append(weekStart).append(" – ").append(weekStart.plusDays(6));
        int i = 1;
        for (CharacterObservationEntity observation : observations) {
            sb.append('\n').append(i++).append(". ").append(observation.getDay())
                    .append(" (súly ").append(observation.getSalience()).append("): ").append(observation.getText());
        }
        sb.append('\n').append("Meglévő aktív állítások:");
        if (expertActiveClaims.isEmpty()) {
            sb.append('\n').append("nincs");
        } else {
            for (CharacterClaimEntity claim : expertActiveClaims) {
                sb.append('\n').append(claim.getId()).append(" (biztonság ").append(claim.getConfidence())
                        .append("): ").append(claim.getText());
            }
        }
        sb.append('\n').append("Alapértelmezett dimenzió: ").append(expert.primaryDimensionKey());
        return sb.toString();
    }

    private List<Draft> parse(String raw, UUID owner, String expertKey, LocalDate weekStart) {
        String cleaned = stripFences(raw);
        try {
            return objectMapper.readValue(cleaned, new TypeReference<List<Draft>>() {});
        } catch (Exception e) {
            log.warn("Proposal answer was not parseable JSON for owner {} expert {} week {} — dropping: {}",
                    owner, expertKey, weekStart, raw, e);
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

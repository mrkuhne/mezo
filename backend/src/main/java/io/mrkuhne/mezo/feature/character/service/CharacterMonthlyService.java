package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    private final CharacterConferenceRepository conferenceRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;
    private final KonziliumProposalRound proposalRound;
    private final KonziliumVerdictRound verdictRound;
    private final CharacterConferenceService conferenceService;
    private final CharacterService characterService;
    private final CharacterProperties properties;
    private final CharacterRunLog runLog;

    /**
     * Runs (or returns the already-run) monthly deep read for {@code owner}'s {@code monthStart}
     * (the month's first day, stored in the conference row's {@code weekStart}). Idempotent: a
     * live MONTHLY row for the month short-circuits to that row. Returns {@code null} — no row,
     * no LLM calls — when the owner has no ACTIVE claims yet (the honest empty dossier).
     */
    @Transactional
    public CharacterConferenceEntity run(UUID owner, LocalDate monthStart) {
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

        // Mirrors CharacterBootstrapService's fix-round-1 guard: a user whose dossier is otherwise
        // still empty (no dimension rows at all) must not silently drop an accepted NEW claim.
        // Seeded HERE — after the no-ACTIVE-claims return (final-review Finding M5: no CORE rows
        // written for a user this monthly run is about to no-op for) but still before the
        // proposal round, so an accepted claim always has somewhere to land.
        characterService.ensureCoreDimensions(owner);

        Map<UUID, CharacterDimensionEntity> dimensionsById = new HashMap<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            dimensionsById.put(dimension.getId(), dimension);
        }
        List<ExpertEvidence> evidence = buildEvidence(activeClaims, dimensionsById);

        String periodLabel = "Havi mélyolvasás: " + monthStart;
        // includeActiveClaimsTrailer=false (fix round 1, mezo-1gim.6): this evidence is built
        // DIRECTLY from ACTIVE claims (buildEvidence, with age/last-movement metadata), so the
        // proposal round's own "Meglévő aktív állítások" trailer would otherwise re-render the
        // SAME claims a second time in one user message for any CORE-owning expert.
        KonziliumProposalRound.Result proposalResult = proposalRound.runOnEvidence(
                owner, periodLabel, MONTHLY_MARKER, AUDIT_OP, evidence, false, MONTHLY_EVIDENCE_PHRASE);
        // weekStart=null here (not monthStart): KonziliumVerdictRound only uses it to render a
        // "Hét: …" period label for the szkeptikus/integrátor prompts — a real week range would be
        // misleading for a whole-dossier monthly pass, so this rides the SAME null-weekStart path
        // CharacterBootstrapService uses ("Teljes eddigi történet"). The conference row's OWN
        // weekStart (monthStart) is set below, independently, by persistConferenceAndApplyOutcome.
        KonziliumVerdictRound.Result verdictResult = verdictRound.run(owner, null, proposalResult.proposals());

        List<ConferenceTranscriptEnvelope.Turn> transcriptTurns = new ArrayList<>(proposalResult.turns());
        transcriptTurns.addAll(verdictResult.turns());

        CharacterConferenceEntity conference = conferenceService.persistConferenceAndApplyOutcome(owner, MONTHLY,
                monthStart, transcriptTurns, verdictResult.chapters(), verdictResult.rulings());

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

        return conference;
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
}

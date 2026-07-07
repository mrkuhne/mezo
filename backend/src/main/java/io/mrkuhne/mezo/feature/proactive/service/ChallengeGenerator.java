package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeRefsEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Workout micro-challenge proposal (proactive, bd mezo-hbwi): the prediction-generator idiom —
 * PURE-CODE gather (V0.3 snapshot + facts + per-exercise history with logged-set PR + numbered
 * CONFIRMED-pattern candidates) → ONE SMART-tier call answering strict-JSON
 * {@code {challenges:[{exerciseIndex, type, targetWeightKg, targetReps, targetSets, targetRir,
 * risk, why, glory, refIndexes, patternIndex}]}}. Each proposal binds ONE template exercise to ONE
 * type; the code drops any proposal missing its type's required target field (unevaluatable = drop),
 * copies confidence from the selected pattern (never fabricated) and resolves refs by index
 * (bounds-checked). Idempotent per (user, template session, date); [] on a past/future date, no
 * exercise history (the grounding gate), or an unusable answer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ChallengeGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT";

    private static final Set<String> VALID_TYPES = Set.of(
            ChallengeEntity.TYPE_PR, ChallengeEntity.TYPE_DEPTH, ChallengeEntity.TYPE_VOLUME);

    private static final String PROMPT = CHALLENGE_MARKER + "\n"
            + "Javasolj 1-3 magyar MIKRO-KIHÍVÁST Daniel mai edzésére, KIZÁRÓLAG a megadott GYAKORLATOK "
            + "és kontextus alapján. Minden kihívás EGY gyakorlathoz kötődik (exerciseIndex) és EGY "
            + "típushoz: PR (targetWeightKg + targetReps kell), Depth (targetRir kell), Volume "
            + "(targetSets kell). Adatot kitalálni tilos; gyógyszer-adagolást SOHA ne javasolj. "
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal: {\"challenges\":[{\"exerciseIndex\":szám,"
            + "\"type\":\"PR|Depth|Volume\",\"targetWeightKg\":szám|null,\"targetReps\":szám|null,"
            + "\"targetSets\":szám|null,\"targetRir\":szám|null,\"risk\":\"low|mid\",\"why\":\"indok\","
            + "\"glory\":\"jutalom\",\"refIndexes\":[a HIVATKOZÁS-JELÖLTEK sorszámai],"
            + "\"patternIndex\":a MINTA-JELÖLT sorszáma vagy null}]}";

    private final ChallengeRepository challengeRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ProactiveProperties properties;

    record ExerciseCandidate(ExerciseEntity exercise, int maxWeightPr, int loggedSetCount) {
    }

    record Gather(String payload, List<ExerciseCandidate> exercises,
                  List<PatternEntity> patterns, List<ChallengeRefsEnvelope.Ref> refCandidates) {
    }

    record ParsedChallenge(Integer exerciseIndex, String type, BigDecimal targetWeightKg,
                           Integer targetReps, Integer targetSets, Integer targetRir, String risk,
                           String why, String glory, List<Integer> refIndexes, Integer patternIndex) {
    }

    record ParsedChallenges(List<ParsedChallenge> challenges) {
    }

    @Transactional
    public List<ChallengeEntity> generate(UUID userId, UUID templateSessionId, LocalDate date) {
        if (!date.equals(LocalDate.now())) {
            return List.of();   // past/future never generate
        }
        List<ChallengeEntity> existing = challengeRepository
                .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(
                        userId, templateSessionId, date);
        if (!existing.isEmpty()) {
            return existing;    // idempotent, NO LLM call
        }
        Gather gather = gather(userId, templateSessionId);
        if (gather == null) {
            log.debug("No exercise history for {} / {} — no challenges", userId, templateSessionId);
            return List.of();   // grounding gate
        }
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedChallenges parsed = parse(answer);
        if (parsed == null || parsed.challenges() == null) {
            log.warn("Unusable challenge answer for {} / {} — no rows", userId, templateSessionId);
            return List.of();
        }
        List<ChallengeEntity> saved = new ArrayList<>();
        for (ParsedChallenge p : parsed.challenges()) {
            if (saved.size() >= properties.challenge().maxPerWorkout()) {
                break;
            }
            ChallengeEntity e = build(userId, templateSessionId, date, p, gather);
            if (e != null) {
                saved.add(challengeRepository.saveAndFlush(e));
            }
        }
        return saved;
    }

    /** null when no template exercise has logged-set history (the grounding gate). */
    Gather gather(UUID userId, UUID templateSessionId) {
        List<ExerciseEntity> exercises = exerciseRepository
                .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(templateSessionId));
        List<ExerciseCandidate> candidates = new ArrayList<>();
        for (ExerciseEntity ex : exercises) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                    .findByCreatedByAndExerciseIdOrderBySetIndexAsc(userId, ex.getId());
            List<ExerciseSetEntity> logged = sets.stream()
                    .filter(s -> !s.isSkipped() && s.getReps() != null).toList();
            if (logged.isEmpty()) {
                continue;   // no history — drop
            }
            int maxPr = logged.stream().map(ExerciseSetEntity::getWeightKg)
                    .filter(w -> w != null).map(BigDecimal::intValue).reduce(0, Integer::max);
            candidates.add(new ExerciseCandidate(ex, maxPr, logged.size()));
        }
        if (candidates.isEmpty()) {
            return null;
        }
        List<PatternEntity> patterns = patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_CONFIRMED);
        List<ChallengeRefsEnvelope.Ref> refCandidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder(contextSnapshotAssembler.render(userId, LocalDate.now()));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nGYAKORLATOK (az exerciseIndex ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            ExerciseCandidate c = candidates.get(i);
            payload.append(i).append(": ").append(c.exercise().getName())
                    .append(" (PR≈").append(c.maxWeightPr()).append(" kg, logolt szettek=")
                    .append(c.loggedSetCount()).append(")\n");
            refCandidates.add(new ChallengeRefsEnvelope.Ref("PR",
                    c.exercise().getName() + " PR ≈ " + c.maxWeightPr() + " kg"));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < refCandidates.size(); i++) {
            payload.append(i).append(": [").append(refCandidates.get(i).kind()).append("] ")
                    .append(refCandidates.get(i).label()).append("\n");
        }
        payload.append("\nMINTA-JELÖLTEK (a patternIndex ezekre mutat):\n");
        for (int i = 0; i < patterns.size(); i++) {
            payload.append(i).append(": ").append(patterns.get(i).getTitle())
                    .append(" (konfidencia=").append(patterns.get(i).getConfidence()).append(")\n");
        }
        payload.append("\nKIHÍVÁS-TÍPUSOK: PR | Depth | Volume");
        return new Gather(payload.toString(), candidates, patterns, refCandidates);
    }

    private ChallengeEntity build(UUID userId, UUID templateSessionId, LocalDate date,
                                  ParsedChallenge p, Gather gather) {
        if (p == null || p.exerciseIndex() == null
                || p.exerciseIndex() < 0 || p.exerciseIndex() >= gather.exercises().size()) {
            return null;
        }
        if (!VALID_TYPES.contains(p.type())) {
            return null;
        }
        if (isBlank(p.why()) || isBlank(p.glory())) {
            return null;
        }
        // required target fields per type — else unevaluatable (drop)
        boolean ok = switch (p.type()) {
            case ChallengeEntity.TYPE_PR -> p.targetWeightKg() != null && p.targetReps() != null;
            case ChallengeEntity.TYPE_DEPTH -> p.targetRir() != null;
            case ChallengeEntity.TYPE_VOLUME -> p.targetSets() != null;
            default -> false;
        };
        if (!ok) {
            return null;
        }
        ExerciseEntity ex = gather.exercises().get(p.exerciseIndex()).exercise();
        ChallengeEntity e = new ChallengeEntity();
        e.setCreatedBy(userId);
        e.setTemplateSessionId(templateSessionId);
        e.setWorkoutDate(date);
        e.setExerciseId(ex.getId());
        e.setExerciseName(ex.getName());
        e.setType(p.type());
        e.setStatus(ChallengeEntity.STATUS_PROPOSED);
        e.setRisk(ChallengeEntity.RISK_MID.equals(p.risk()) ? ChallengeEntity.RISK_MID : ChallengeEntity.RISK_LOW);
        e.setTargetWeightKg(p.targetWeightKg());
        e.setTargetReps(p.targetReps());
        e.setTargetSets(p.targetSets());
        e.setTargetRir(p.targetRir());
        e.setTitle(deriveTitle(p, ex));
        e.setWhy(p.why().strip());
        e.setGlory(p.glory().strip());
        e.setConfidence(resolveConfidence(p.patternIndex(), gather.patterns()));
        e.setRefs(resolveRefs(p.refIndexes(), gather.refCandidates()));
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }

    private String deriveTitle(ParsedChallenge p, ExerciseEntity ex) {
        return ex.getName();
    }

    private BigDecimal resolveConfidence(Integer index, List<PatternEntity> patterns) {
        if (index == null || index < 0 || index >= patterns.size()) {
            return null;
        }
        return patterns.get(index).getConfidence();
    }

    private ChallengeRefsEnvelope resolveRefs(List<Integer> indexes, List<ChallengeRefsEnvelope.Ref> candidates) {
        List<ChallengeRefsEnvelope.Ref> out = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        if (indexes != null) {
            for (Integer i : indexes) {
                if (i != null && i >= 0 && i < candidates.size() && seen.add(i)) {
                    out.add(candidates.get(i));
                }
            }
        }
        return new ChallengeRefsEnvelope(out);
    }

    private ParsedChallenges parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedChallenges.class);
        } catch (Exception e) {
            log.warn("Challenge answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}

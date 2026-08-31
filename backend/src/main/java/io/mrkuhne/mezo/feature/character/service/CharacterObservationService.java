package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.detector.DetectorRegistry;
import io.mrkuhne.mezo.feature.character.detector.DetectorSignal;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
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
 * Nightly expert observation pass (Karakter spec §5/§6, mezo-1gim.3): runs the detector
 * registry over one day, groups the fired signals by expert, and asks each affected expert
 * (one cheap-tier {@link CompanionLlm} call each, in its own persona) for 0..3 grounded
 * observations. Per-expert isolation — a broken/unparseable answer for one expert never blocks
 * the others, and the quiet day (no signals at all) never calls the LLM.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterObservationService {

    /** The observation prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String OBSERVATION_MARKER = "KARAKTER-MEGFIGYELÉS-FELADAT";

    private static final int MAX_DRAFTS_PER_EXPERT = 3;
    private static final short MIN_SALIENCE = 1;
    private static final short MAX_SALIENCE = 5;
    private static final short DEFAULT_SALIENCE = 3;

    private static final Set<String> KNOWN_DIMENSION_KEYS = CharacterCoreCatalog.CORE.stream()
            .map(CharacterCoreCatalog.CoreDimension::key)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

    private final DetectorRegistry detectorRegistry;
    private final CharacterSignalReads signalReads;
    private final CharacterObservationRepository observationRepository;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final CharacterRunLog runLog;

    /** One drafted observation as the LLM returns it, before validation/clamping. */
    record Draft(String text, Integer salience, List<String> dimensionKeys) {}

    /** Runs the nightly pass for one owner/day; returns the number of observation rows written. */
    @Transactional
    public int generateForDay(UUID owner, LocalDate day) {
        List<DetectorSignal> signals = detectorRegistry.runAll(signalReads.gather(owner, day));

        int written = 0;
        List<String> detectorKeys = List.of();
        List<String> calledExpertKeys = List.of();
        if (!signals.isEmpty()) {
            detectorKeys = signals.stream().map(DetectorSignal::detectorKey).distinct().toList();

            Map<String, List<DetectorSignal>> byExpert = new LinkedHashMap<>();
            for (DetectorSignal signal : signals) {
                byExpert.computeIfAbsent(signal.expertKey(), k -> new ArrayList<>()).add(signal);
            }

            List<String> called = new ArrayList<>();
            for (Map.Entry<String, List<DetectorSignal>> entry : byExpert.entrySet()) {
                String expertKey = entry.getKey();
                if (observationRepository.existsByCreatedByAndExpertKeyAndDay(owner, expertKey, day)) {
                    continue; // idempotent catch-up re-run
                }
                called.add(expertKey);
                written += generateForExpert(owner, day, expertKey, entry.getValue());
            }
            calledExpertKeys = called;
        }

        // NIGHTLY run-row, recorded BEFORE the (now removed) quiet-day early return used to sit
        // (Karakter S9 Gépterem, mezo-1gim.14): a zero-signal day is a REAL run that found
        // nothing, and recording (0, 0, [], []) IS the "csendes éjszaka" the Gépterem view
        // celebrates — distinct from a day this pipeline never ran at all (no row at all).
        // record() is itself idempotent per (created_by, kind, day), so a catch-up re-run of an
        // already-logged day is a no-op here regardless of what the per-expert exists-checks above
        // decided at the observation level. Own try/catch (defense in depth on top of record()'s
        // internal one — the DailySummaryJob isolation idiom) so a run-log failure can never break
        // this pipeline.
        try {
            runLog.record(owner, "NIGHTLY", day, written, calledExpertKeys.size(),
                    detectorKeys, calledExpertKeys, null);
        } catch (Exception e) {
            log.warn("NIGHTLY run-log record call failed for owner {} day {}", owner, day, e);
        }

        return written;
    }

    private int generateForExpert(UUID owner, LocalDate day, String expertKey, List<DetectorSignal> expertSignals) {
        CharacterExpertCatalog.Expert expert;
        String raw;
        try {
            // byKey lives inside the try too: an unknown expertKey must skip only THIS expert,
            // never abort the whole per-day pass — same per-expert isolation contract as the LLM
            // call below.
            expert = CharacterExpertCatalog.byKey(expertKey);
            String systemPrompt = OBSERVATION_MARKER + "\n" + expert.systemPersona() + "\n" + outputContract();
            String userMessage = userMessage(day, expertSignals);
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("character", "observe", "expert", null),
                    () -> companionLlm.complete(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("Observation generation failed for owner {} expert {} day {}", owner, expertKey, day, e);
            return 0;
        }

        List<Draft> drafts = parse(raw, owner, expertKey, day);
        if (drafts.isEmpty()) {
            return 0;
        }

        ObservationSignalsEnvelope signalsEnvelope = new ObservationSignalsEnvelope(expertSignals.stream()
                .map(s -> new ObservationSignalsEnvelope.Signal(s.detectorKey(), s.summary(), List.of()))
                .toList());

        int written = 0;
        for (Draft draft : drafts) {
            if (written >= MAX_DRAFTS_PER_EXPERT) {
                break;
            }
            if (draft.text() == null || draft.text().isBlank()) {
                continue;
            }
            CharacterObservationEntity entity = new CharacterObservationEntity();
            entity.setCreatedBy(owner);
            entity.setExpertKey(expertKey);
            entity.setDay(day);
            entity.setText(draft.text());
            entity.setSalience(clampSalience(draft.salience()));
            entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(resolveDimensionKeys(draft, expert)));
            entity.setSignals(signalsEnvelope);
            entity.setConsumedByConferenceId(null);
            observationRepository.save(entity);
            written++;
        }
        return written;
    }

    private static String outputContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"text":"...","salience":1-5,"dimensionKeys":["..."]}]. 0–3 megfigyelést \
                adj, mindegyiket a saját hangodon fogalmazd meg, KIZÁRÓLAG a felsorolt jelek alapján — \
                ne találj ki számot vagy tényt, amit a jelek nem tartalmaznak.""";
    }

    private static String userMessage(LocalDate day, List<DetectorSignal> signals) {
        StringBuilder sb = new StringBuilder("Nap: ").append(day);
        int i = 1;
        for (DetectorSignal signal : signals) {
            sb.append('\n').append(i++).append(". ").append(signal.detectorKey())
                    .append(": ").append(signal.summary());
        }
        return sb.toString();
    }

    private List<Draft> parse(String raw, UUID owner, String expertKey, LocalDate day) {
        if (raw == null || raw.isBlank()) {
            log.warn("Observation answer was blank for owner {} expert {} day {}", owner, expertKey, day);
            return List.of();
        }
        String cleaned = stripFences(raw);
        try {
            return objectMapper.readValue(cleaned, new TypeReference<List<Draft>>() {});
        } catch (Exception e) {
            log.warn("Observation answer was not parseable JSON for owner {} expert {} day {} — dropping: {}",
                    owner, expertKey, day, raw, e);
            return List.of();
        }
    }

    /** Strips optional ```json fences (and surrounding prose) — mirrors FactExtractionService's idiom. */
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

    private static Short clampSalience(Integer salience) {
        int value = salience == null ? DEFAULT_SALIENCE : salience;
        return (short) Math.max(MIN_SALIENCE, Math.min(MAX_SALIENCE, value));
    }

    private static List<String> resolveDimensionKeys(Draft draft, CharacterExpertCatalog.Expert expert) {
        List<String> filtered = draft.dimensionKeys() == null ? List.of() : draft.dimensionKeys().stream()
                .filter(KNOWN_DIMENSION_KEYS::contains)
                .toList();
        return filtered.isEmpty() ? List.of(expert.primaryDimensionKey()) : filtered;
    }
}

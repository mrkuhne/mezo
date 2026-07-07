package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Heartbeat note generation (proactive H1): pure-code gather (snapshot + facts + latest daily
 * summary + today's briefing dedupe block + window instruction) → ONE CHEAP-tier CompanionLlm
 * call → flat HU prose. Honest-null on empty narrative memory or a blank answer; idempotent per
 * user+day+window (no regeneration path — proactive.md §9 decision r). Gather = pure code,
 * prose = pure LLM (NFR-M-4).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class HeartbeatGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String HEARTBEAT_MARKER = "NAPKOZBENI-JEGYZET-FELADAT";

    private static final String PROMPT = HEARTBEAT_MARKER + "\n"
            + "Írj rövid (2-3 mondatos), magyar napközbeni jegyzetet Danielnek társ-szemszögből, "
            + "kizárólag a megadott mai állapotból. Az ABLAK blokk mondja meg a jegyzet fajtáját: "
            + "déli (nudge) esetén a nap hátralévő részére adj egy konkrét, gyengéd fókuszt; esti "
            + "(closing) esetén zárd a napot egy konkrét megfigyeléssel. Ha van MAI BRIEFING blokk, "
            + "annak tartalmát NE ismételd. Számot vagy adatot kitalálni tilos; gyógyszer "
            + "adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi "
            + "döntés. Sima folyószöveggel válaszolj, markdown és felsorolás nélkül.";

    private final HeartbeatNoteRepository heartbeatNoteRepository;
    private final BriefingRepository briefingRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ProactiveProperties properties;

    @Transactional
    public HeartbeatNoteEntity generate(UUID userId, LocalDate day, String windowKey) {
        HeartbeatNoteEntity existing = heartbeatNoteRepository
                .findByCreatedByAndNoteDateAndWindowKey(userId, day, windowKey)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        String payload = gather(userId, day, windowKey);
        if (payload == null) {
            log.debug("No narrative memory for user {} — no heartbeat for {}", userId, day);
            return null;
        }
        String prose = companionLlm.complete(PROMPT, payload);
        if (prose == null || prose.isBlank()) {
            log.warn("Unusable heartbeat answer for user {} day {} window {}", userId, day, windowKey);
            return null;
        }
        HeartbeatNoteEntity note = new HeartbeatNoteEntity();
        note.setCreatedBy(userId);
        note.setNoteDate(day);
        note.setWindowKey(windowKey);
        note.setKind(HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? HeartbeatNoteEntity.KIND_CLOSING
                : HeartbeatNoteEntity.KIND_NUDGE);
        note.setContent(prose.strip());
        note.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return heartbeatNoteRepository.saveAndFlush(note);
    }

    /**
     * Pure-code gather; null = the emptiness gate (no daily_summary in the shared past-days
     * window — one knob for "does the companion know Daniel yet", §9 decision s).
     */
    public String gather(UUID userId, LocalDate day, String windowKey) {
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, day.minusDays(properties.briefing().pastDays()));
        if (past.isEmpty()) {
            return null;
        }
        DailySummaryEntity latest = past.getFirst();
        String briefingBlock = briefingRepository.findByCreatedByAndBriefingDate(userId, day)
                .map(b -> "\n\nMAI BRIEFING (ne ismételd):\n" + String.join(" ", b.getContent().body()))
                .orElse("");
        String window = HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? "este (closing)"
                : "dél (nudge)";
        return contextSnapshotAssembler.render(userId, day)
                + knowledgeFactService.renderPromptBlock(userId)
                + "\n\nUTOLSÓ NAPI ÖSSZEFOGLALÓ:\n- " + latest.getSummaryDate() + ": " + latest.getNarrative()
                + briefingBlock
                + "\n\nABLAK: " + window;
    }
}

package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * W2 memoir generator (spec §5, old journey 5.8; prompt v2: mezo-uajy,
 * docs/superpowers/specs/2026-08-31-memoir-prompt-v2-design.md): PURE-CODE gather (the week's
 * daily summaries [weekStart, weekStart+6] + relevant patterns + life events + week PRs +
 * predictions + the {@link WeeklyReviewContextSources} wider context + facts/character/growth
 * blocks + numbered anchor candidates) → ONE SMART-tier call with a strict-JSON contract
 * {title, body, anchors:[{index, note}]} — anchors are model-SELECTED from code-collected
 * candidates (the briefing ref rule), never invented; the legacy {@code anchorIndexes} array is
 * still accepted as a fallback. Memory anchor labels are composed server-side into human
 * Hungarian day labels ({@link #memoryLabel}). Empty week or unusable answer ⇒ NO row.
 * Existing row ⇒ returned untouched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class MemoirGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String MEMOIR_MARKER = "HETI-MEMOIR-FELADAT";

    /** Prompt v2 (mezo-uajy) — krónikás-társ hang: blokkosított, viselkedést ír, nem jelzőt
     *  (a mezo-q71s tanulság); package-visible so {@code MemoirPromptTest} can pin the
     *  load-bearing lines without freezing the tunable prose. */
    static final String PROMPT = MEMOIR_MARKER + "\n"
            + "[Ki vagy]\n"
            + "Te vagy a mezo, {{NÉV}} egészség- és teljesítmény-társa. A közös hetetek "
            + "emlékkönyvét írod — egy fejezetet hetente. Társ vagy, nem bíró: megfigyelsz és "
            + "megőrzöl, sosem osztályozol, sosem moralizálsz, és nem adsz tanácsot — a tanács a "
            + "beszélgetés dolga, a memoár emlék.\n\n"
            + "[Mit írsz]\n"
            + "Heti memoár-fejezetet magyarul: rövid, felidéző cím (legfeljebb hat szó, ne "
            + "tanulság és ne ítélet), és 2–4 bekezdés próza — a bekezdéseket \\n\\n választja "
            + "el. Nagyjából 120–220 szó: elég hosszú, hogy története legyen, elég rövid, hogy "
            + "egy szuszra elolvassa.\n\n"
            + "[Hogyan írsz]\n"
            + "Elbeszélsz, nem értékelsz. A hetet történetként meséld: legyen íve — honnan "
            + "indult, mi fordult, hová érkezett.\n"
            + "Konkrét mozzanatokból építkezz (egy nap, egy szám, egy mondat, egy ember), ne "
            + "általánosságokból — a megadott adat konkrétuma mindig erősebb a nagy szónál.\n"
            + "Jelen lehetsz a szövegben („láttam\", „figyeltem\"), de a hét az övé ({{NÉV}}) — te tanú "
            + "vagy, nem főszereplő.\n"
            + "Kerüld a giccset, a pátoszt és a motivációs frázisokat; ha egy mondat egy poszter "
            + "alján is szerepelhetne, húzd ki.\n"
            + "A nehéz napokat is jegyezd fel, ugyanazzal a nyugalommal, mint a jókat — "
            + "részvéttel, ítélet nélkül. „Még nem tanultad meg\", „elveszel\", „meg kell "
            + "tanulnod\" típusú kioktatás tilos.\n\n"
            + "[Példa a hangra]\n"
            + "ROSSZ: „Büszke lehetsz magadra, de a hétköznapi gondoskodást még tanulnod kell.\"\n"
            + "JÓ: „Csütörtökön, a 105 kilós húzás után, csendben ültél két percet — az ilyen "
            + "percekből épült ez a hét.\"\n"
            + "(A példa FORMÁJÁT másold, ne a tartalmát — minden mozzanat a megadott adatból "
            + "jöjjön.)\n\n"
            + "[Mit szabad állítani]\n"
            + "Kizárólag a megadott hét adataiból dolgozz; számot, adatot, eseményt kitalálni "
            + "tilos. Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj.\n\n"
            + "[Horgonyok]\n"
            + "A HORGONY-JELÖLTEK listából válaszd ki azt a 2–5 tételt, amire a fejezet "
            + "ténylegesen épül. Memory-jelölthez adj rövid (legfeljebb hat szavas) note-ot "
            + "arról, mi történt aznap — a szövegedben szereplő mozzanattal egyezően.\n\n"
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"title\": \"...\", \"body\": \"bekezdések \\n\\n-nel elválasztva\", "
            + "\"anchors\": [{\"index\": 0, \"note\": \"rövid címke\"}]}";

    /** Server-side clip for a model-given anchor note. */
    private static final int NOTE_CLIP = 60;
    /** Per-note and whole-section caps for the week's verbatim workout notes (mezo-d20.13). */
    private static final int WORKOUT_NOTE_CLIP = 400;
    private static final int WORKOUT_NOTES_TOTAL_CLIP = 1200;

    /** HU day label for a Memory anchor: {@code aug. 29., szombat}. */
    private static final DateTimeFormatter MEMORY_DAY_FORMAT =
            DateTimeFormatter.ofPattern("MMM d., EEEE", Locale.of("hu", "HU"));

    private final MemoirRepository memoirRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final GraphNodeRepository graphNodeRepository;
    private final PredictionRepository predictionRepository;
    private final ExerciseRecordService exerciseRecordService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final WeeklyReviewContextSources contextSources;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final GrowthDigestBlock growthDigestBlock;
    private final AppNotificationEmitter appNotificationEmitter;
    /** mezo-1gim.8 — the [Karakter] dossier block; absent (null) unless CHARACTER_SWITCH + COMPANION_SWITCH are both on. */
    private final ObjectProvider<CharacterPromptSource> characterPromptSource;
    private final PromptPersona promptPersona;

    public record MemoirGather(String payload, List<MemoirAnchorsEnvelope.Anchor> candidates) {
    }

    record ParsedAnchor(Integer index, String note) {
    }

    /** {@code anchors} is the v2 shape; {@code anchorIndexes} the legacy fallback (model
     *  variance + old scripted sentinels) — {@link #resolveAnchors} prefers the former. */
    record ParsedMemoir(String title, String body, List<ParsedAnchor> anchors,
            List<Integer> anchorIndexes) {
    }

    @Transactional
    public MemoirEntity generate(UUID userId, LocalDate weekStart) {
        MemoirEntity existing = memoirRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        MemoirGather gather = gather(userId, weekStart);
        if (gather == null) {
            log.debug("No summaries in week {} for {} — no memoir", weekStart, userId);
            return null;
        }
        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_memoir", "generate", null, null),
                () -> companionLlm.completeSmart(promptPersona.render(userId, PROMPT), gather.payload()));
        ParsedMemoir parsed = parse(answer);
        if (parsed == null || parsed.title() == null || parsed.title().isBlank()
                || parsed.body() == null || parsed.body().isBlank()) {
            log.warn("Unusable memoir answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(userId);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(parsed.title().strip());
        memoir.setBody(parsed.body().strip());
        memoir.setAnchors(new MemoirAnchorsEnvelope(resolveAnchors(parsed, gather.candidates())));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        MemoirEntity saved = memoirRepository.saveAndFlush(memoir);
        appNotificationEmitter.emit(userId, AppNotificationKind.MEMOIR_READY,
                "Elkészült a heti memoár",
                saved.getTitle(),
                AppNotificationKind.MEMOIR_READY.deeplink(), saved.getId(),
                "memoir_ready:" + weekStart);
        return saved;
    }

    /** PURE-CODE payload; null when the week [weekStart, weekStart+6] has no summaries. */
    public MemoirGather gather(UUID userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        List<DailySummaryEntity> week = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(userId, weekStart)
                .stream()
                .filter(s -> !s.getSummaryDate().isAfter(weekEnd))
                .toList();
        if (week.isEmpty()) {
            return null;
        }
        List<MemoirAnchorsEnvelope.Anchor> candidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder("A HÉT NAPJAI (" + weekStart + " – " + weekEnd + "):\n");
        for (DailySummaryEntity s : week) {
            payload.append("- ").append(s.getSummaryDate()).append(": ")
                    .append(s.getNarrative()).append('\n');
            candidates.add(new MemoirAnchorsEnvelope.Anchor("Memory", s.getSummaryDate().toString()));
        }
        // Relevant patterns only (mezo-uajy): CONFIRMED ones plus whatever gave an event this
        // week — the old "every non-deleted pattern" also dragged rejected rows in as anchors.
        Instant since = WeeklyReviewWeekWindow.since(weekStart);
        Instant until = WeeklyReviewWeekWindow.until(weekEnd);
        Set<UUID> eventPatternIds = new LinkedHashSet<>();
        for (PatternEventEntity event
                : WeeklyReviewWeekWindow.patternEvents(patternEventRepository, userId, since, until)) {
            eventPatternIds.add(event.getPatternId());
        }
        List<PatternEntity> patterns = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
                .stream()
                .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus())
                        || eventPatternIds.contains(p.getId()))
                .toList();
        if (!patterns.isEmpty()) {
            payload.append("\nMINTÁK:\n");
            for (PatternEntity p : patterns) {
                payload.append("- ").append(p.getTitle()).append(" (státusz: ")
                        .append(p.getStatus()).append(")\n");
                candidates.add(new MemoirAnchorsEnvelope.Anchor("Pattern", p.getTitle()));
            }
        }

        List<GraphNodeEntity> lifeEvents =
                WeeklyReviewWeekWindow.lifeEvents(graphNodeRepository, userId, weekStart, weekEnd);
        if (!lifeEvents.isEmpty()) {
            payload.append("\nÉLETESEMÉNYEK:\n");
            for (GraphNodeEntity node : lifeEvents) {
                payload.append("- ").append(node.getTitle()).append('\n');
                candidates.add(new MemoirAnchorsEnvelope.Anchor("LifeEvent", node.getTitle()));
            }
        }

        appendWeekPrs(payload, candidates, userId, weekStart, weekEnd);
        appendWorkoutNotes(payload, candidates, userId, weekStart, weekEnd);

        List<PredictionEntity> predictions =
                predictionRepository.findByCreatedByAndWeekStart(userId, weekStart);
        if (!predictions.isEmpty()) {
            payload.append("\nPREDIKCIÓK:\n");
            for (PredictionEntity prediction : predictions) {
                payload.append("- ").append(prediction.getTitle())
                        .append(" [").append(prediction.getStatus()).append("]\n");
            }
        }

        // The wider context (journal, decisions, experiments, mentions, medication cycle, week
        // narrative) — the weekly review's renderer verbatim; contributes NO anchor candidates.
        payload.append(contextSources.render(userId, weekStart, weekEnd, since, until));

        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append(characterBlock(userId));
        payload.append(growthDigestBlock.render(userId, weekStart));
        payload.append("\nHORGONY-JELÖLTEK (az anchors indexei ezekre mutatnak):\n");
        for (int i = 0; i < candidates.size(); i++) {
            payload.append(i).append(": [").append(candidates.get(i).kind()).append("] ")
                    .append(candidates.get(i).label()).append('\n');
        }
        return new MemoirGather(payload.toString(), candidates);
    }

    /** mezo-1gim.8: the [Karakter] dossier's contribution — "" when the bean is absent (either
     *  switch off) or the dossier has nothing worth injecting. */
    private String characterBlock(UUID userId) {
        CharacterPromptSource source = characterPromptSource.getIfAvailable();
        return source == null ? "" : source.render(userId);
    }

    private ParsedMemoir parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedMemoir.class);
        } catch (Exception e) {
            log.warn("Memoir answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** The week's training peaks: all-time bests whose best set fell INSIDE the week (the
     *  cheapest honest "PR this week" — no record table, {@code bestSet.date} is the ledger).
     *  New {@code proactive → train} read edge; cycle-checked by {@code ArchitectureTest}. */
    private void appendWeekPrs(StringBuilder payload, List<MemoirAnchorsEnvelope.Anchor> candidates,
            UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        List<ExerciseRecordResponse> weekBests = exerciseRecordService.list(userId).stream()
                .filter(r -> r.getBestSet() != null && r.getBestSet().getDate() != null
                        && !r.getBestSet().getDate().isBefore(weekStart)
                        && !r.getBestSet().getDate().isAfter(weekEnd))
                .toList();
        if (weekBests.isEmpty()) {
            return;
        }
        payload.append("\nA HÉT EDZÉS-CSÚCSAI (all-time best, ezen a héten dőlt):\n");
        for (ExerciseRecordResponse record : weekBests) {
            String weight = record.getBestSet().getWeightKg().stripTrailingZeros().toPlainString();
            payload.append("- ").append(record.getName()).append(": ").append(weight)
                    .append(" kg × ").append(record.getBestSet().getReps())
                    .append(" (").append(record.getBestSet().getDate()).append(")\n");
            candidates.add(new MemoirAnchorsEnvelope.Anchor(
                    "PR", record.getName() + " " + weight + " kg"));
        }
    }

    /**
     * The week's workout closing notes, VERBATIM (mezo-d20.13).
     *
     * <p>This is the highest signal-to-noise material the training week produces: a session is
     * fully describable in numbers, but how it FELT exists only in the user's own sentence, and
     * is unrecoverable from the data. It is therefore passed through unchanged — merely truncated
     * when long. Summarizing it first would strip the numbers, the hedges and the specifics that
     * are the whole reason it is here, and would make the app assert an interpretation of the
     * user's state it was never told.
     *
     * <p>Every note also becomes an anchor candidate, so a chapter that leans on one stays
     * traceable in the "Miből íródott" row. Unattributed echo of a person's own words is what
     * reads as surveillance; a visible trail is what reads as attention.
     *
     * <p>Reads {@code closingNote}, NOT {@code note} — the latter is the template day's plan note
     * on a different row of the same table.
     */
    private void appendWorkoutNotes(StringBuilder payload, List<MemoirAnchorsEnvelope.Anchor> candidates,
            UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        List<WorkoutSessionEntity> withNotes = workoutSessionRepository
                .findDoneInstancesBetween(userId, weekStart, weekEnd).stream()
                .filter(w -> w.getClosingNote() != null && !w.getClosingNote().isBlank())
                .toList();
        if (withNotes.isEmpty()) {
            return;
        }
        payload.append("\nAMIT AZ EDZÉSEK UTÁN ÍRT (a saját szavai, szó szerint):\n");
        int budget = WORKOUT_NOTES_TOTAL_CLIP;
        for (WorkoutSessionEntity w : withNotes) {
            if (budget <= 0) {
                break;
            }
            String note = w.getClosingNote().strip();
            // Per-entry cap AS WELL AS the total: with only a total, one long note crowds every
            // other one out of the week entirely.
            int cap = Math.min(WORKOUT_NOTE_CLIP, budget);
            String clipped = note.length() <= cap ? note : note.substring(0, cap) + "…";
            payload.append("- ").append(w.getDate()).append(": \"").append(clipped).append("\"\n");
            budget -= clipped.length();
            candidates.add(new MemoirAnchorsEnvelope.Anchor("WorkoutNote", w.getDate().toString()));
        }
    }

    /** Human HU label for a Memory anchor day — {@code aug. 29., szombat[ — note]}; the note is
     *  the model's ≤6-word gist, clipped to {@value #NOTE_CLIP} chars server-side. */
    public static String memoryLabel(LocalDate day, String note) {
        String base = MEMORY_DAY_FORMAT.format(day);
        if (note == null || note.isBlank()) {
            return base;
        }
        String clipped = note.strip();
        if (clipped.length() > NOTE_CLIP) {
            clipped = clipped.substring(0, NOTE_CLIP);
        }
        return base + " — " + clipped;
    }

    /** v2 {@code anchors:[{index,note}]} preferred, legacy {@code anchorIndexes} fallback;
     *  bounds-check + dedup unchanged. Memory labels (ISO dates in the candidate list) are
     *  composed into human day labels here — other kinds keep the candidate's own label and
     *  drop the note. */
    private List<MemoirAnchorsEnvelope.Anchor> resolveAnchors(
            ParsedMemoir parsed, List<MemoirAnchorsEnvelope.Anchor> candidates) {
        List<ParsedAnchor> anchors = parsed.anchors();
        if (anchors == null && parsed.anchorIndexes() != null) {
            anchors = parsed.anchorIndexes().stream()
                    .map(i -> new ParsedAnchor(i, null))
                    .toList();
        }
        if (anchors == null) {
            return List.of();
        }
        Set<Integer> seen = new LinkedHashSet<>();
        List<MemoirAnchorsEnvelope.Anchor> resolved = new ArrayList<>();
        for (ParsedAnchor anchor : anchors) {
            Integer index = anchor == null ? null : anchor.index();
            if (index == null || index < 0 || index >= candidates.size() || !seen.add(index)) {
                continue;
            }
            MemoirAnchorsEnvelope.Anchor candidate = candidates.get(index);
            if ("Memory".equals(candidate.kind())) {
                LocalDate day;
                try {
                    day = LocalDate.parse(candidate.label());
                } catch (Exception e) {
                    resolved.add(candidate);
                    continue;
                }
                resolved.add(new MemoirAnchorsEnvelope.Anchor(
                        candidate.kind(), memoryLabel(day, anchor.note())));
            } else {
                resolved.add(candidate);
            }
        }
        return resolved;
    }
}

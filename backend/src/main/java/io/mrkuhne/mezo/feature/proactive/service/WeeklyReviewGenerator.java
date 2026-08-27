package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.MeWeekDay;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.api.dto.MeWeekSubscores;
import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.MeWeekService;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewDayNotesEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewDayNotesEnvelope.DayNote;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope.Highlight;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Weekly review generator (Én/Heti, spec 2026-08-27 §5, bd mezo-p2tr) — the {@code
 * MemoirGenerator} idiom applied to the week's data instead of a single narrative: PURE-CODE
 * gather ({@link MeWeekService#week(UUID, LocalDate)}'s day rows + the week's confirmed pattern
 * events + newly-created facts + active life events + the week's memoir/predictions, plus a
 * numbered anchor-candidate list) → ONE SMART-tier call with a strict-JSON contract
 * {@code {summary, dayNotes, anchorIndexes}} — highlights are model-SELECTED from code-collected
 * candidates, never invented. Empty week (no day carries any logged data) or an unusable answer
 * ⇒ NO row. Existing row ⇒ returned untouched, no second LLM call.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyReviewGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String WEEKLY_REVIEW_MARKER = "HETI-ELEMZES-FELADAT";

    private static final String PROMPT = WEEKLY_REVIEW_MARKER + "\n"
            + "Elemezd Daniel hetét KIZÁRÓLAG a megadott adatokból: mi ment jól, mi tört meg, milyen "
            + "összefüggés látszik a napok között. Társ-hangnem, nem jelentés; számot kitalálni tilos; "
            + "gyógyszer-adagolást érintő javaslat tilos. Minden adatot tartalmazó naphoz írj 1-2 mondatos "
            + "megjegyzést. Válaszolj KIZÁRÓLAG szigorú JSON-nal: {\"summary\": \"a heti elemzés szövege\", "
            + "\"dayNotes\": [{\"date\": \"YYYY-MM-DD\", \"note\": \"...\"}], "
            + "\"anchorIndexes\": [a felhasznált HORGONY-JELÖLTEK sorszámai]}";

    private static final String[] HU_DOW = {"H", "K", "Sze", "Cs", "P", "Szo", "V"};

    private final WeeklyReviewRepository weeklyReviewRepository;
    private final MeWeekService meWeekService;
    private final PatternEventRepository patternEventRepository;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final GraphNodeRepository graphNodeRepository;
    private final MemoirRepository memoirRepository;
    private final PredictionRepository predictionRepository;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final AppNotificationEmitter appNotificationEmitter;

    public record WeeklyReviewGather(String payload, List<Highlight> candidates) {
    }

    record ParsedDayNote(String date, String note) {
    }

    record ParsedReview(String summary, List<ParsedDayNote> dayNotes, List<Integer> anchorIndexes) {
    }

    @Transactional
    public WeeklyReviewEntity generate(UUID userId, LocalDate weekStart) {
        WeeklyReviewEntity existing = weeklyReviewRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        WeeklyReviewGather gather = gather(userId, weekStart);
        if (gather == null) {
            log.debug("No logged data in week {} for {} — no weekly review", weekStart, userId);
            return null;
        }
        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_weekly_review", "generate", null, null),
                () -> companionLlm.completeSmart(PROMPT, gather.payload()));
        ParsedReview parsed = parse(answer);
        if (parsed == null || parsed.summary() == null || parsed.summary().isBlank()) {
            log.warn("Unusable weekly review answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        WeeklyReviewEntity review = new WeeklyReviewEntity();
        review.setCreatedBy(userId);
        review.setWeekStart(weekStart);
        review.setSummary(parsed.summary().strip());
        review.setDayNotes(new WeeklyReviewDayNotesEnvelope(resolveDayNotes(parsed.dayNotes(), weekStart)));
        review.setHighlights(new WeeklyReviewHighlightsEnvelope(
                resolveHighlights(parsed.anchorIndexes(), gather.candidates())));
        review.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        WeeklyReviewEntity saved = weeklyReviewRepository.saveAndFlush(review);
        appNotificationEmitter.emit(userId, AppNotificationKind.WEEKLY_REVIEW_READY,
                "Elkészült a heti elemzés",
                firstSentence(saved.getSummary()),
                AppNotificationKind.WEEKLY_REVIEW_READY.deeplink() + "?start=" + weekStart,
                saved.getId(),
                "weekly_review_ready:" + weekStart);
        return saved;
    }

    /** PURE-CODE payload; null when NO day in the week carries any logged data. */
    public WeeklyReviewGather gather(UUID userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        MeWeekResponse week = meWeekService.week(userId, weekStart);
        boolean anyData = week.getDays().stream().anyMatch(WeeklyReviewGenerator::hasLoggedData);
        if (!anyData) {
            return null;
        }

        List<Highlight> candidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder("A HÉT NAPJAI (" + weekStart + " – " + weekEnd + "):\n");
        for (MeWeekDay day : week.getDays()) {
            payload.append(renderDayLine(day)).append('\n');
        }

        Instant since = WeeklyReviewWeekWindow.since(weekStart);
        Instant until = WeeklyReviewWeekWindow.until(weekEnd);

        List<PatternEventEntity> patternEvents =
                WeeklyReviewWeekWindow.patternEvents(patternEventRepository, userId, since, until);
        if (!patternEvents.isEmpty()) {
            payload.append("\nMINTA-ESEMÉNYEK A HÉTEN:\n");
            for (PatternEventEntity event : patternEvents) {
                String title = patternRepository.findByIdAndCreatedByAndDeletedFalse(event.getPatternId(), userId)
                        .map(PatternEntity::getTitle).orElse("Ismeretlen minta");
                payload.append("- ").append(title).append(" (").append(event.getKind()).append(")\n");
                candidates.add(new Highlight("Pattern", title));
            }
        }

        List<KnowledgeFactEntity> facts =
                WeeklyReviewWeekWindow.facts(knowledgeFactRepository, userId, since, until);
        if (!facts.isEmpty()) {
            payload.append("\nÚJ TÉNYEK:\n");
            for (KnowledgeFactEntity fact : facts) {
                String label = truncate(fact.getFactText(), 80);
                payload.append("- ").append(label).append('\n');
                candidates.add(new Highlight("Fact", label));
            }
        }

        List<GraphNodeEntity> lifeEvents =
                WeeklyReviewWeekWindow.lifeEvents(graphNodeRepository, userId, weekStart, weekEnd);
        if (!lifeEvents.isEmpty()) {
            payload.append("\nÉLETESEMÉNYEK:\n");
            for (GraphNodeEntity node : lifeEvents) {
                payload.append("- ").append(node.getTitle()).append('\n');
                candidates.add(new Highlight("LifeEvent", node.getTitle()));
            }
        }

        memoirRepository.findByCreatedByAndWeekStart(userId, weekStart).ifPresent(memoir -> {
            payload.append("\nHETI MEMOÁR: ").append(memoir.getTitle()).append('\n');
            candidates.add(new Highlight("Memory", weekStart.toString()));
        });

        List<PredictionEntity> predictions = predictionRepository.findByCreatedByAndWeekStart(userId, weekStart);
        if (!predictions.isEmpty()) {
            payload.append("\nPREDIKCIÓK:\n");
            for (PredictionEntity prediction : predictions) {
                payload.append("- ").append(prediction.getTitle())
                        .append(" [").append(prediction.getStatus()).append("]\n");
            }
        }

        payload.append("\nHORGONY-JELÖLTEK (az anchorIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            payload.append(i).append(": [").append(candidates.get(i).kind()).append("] ")
                    .append(candidates.get(i).label()).append('\n');
        }
        return new WeeklyReviewGather(payload.toString(), candidates);
    }

    private static boolean hasLoggedData(MeWeekDay day) {
        return day.getKcal() != null || day.getSleepMin() != null
                || (day.getCheckinCount() != null && day.getCheckinCount() > 0)
                || (day.getWorkoutCount() != null && day.getWorkoutCount() > 0);
    }

    private static String renderDayLine(MeWeekDay day) {
        MeWeekSubscores subscores = day.getSubscores();
        StringBuilder sb = new StringBuilder("- ").append(day.getDate())
                .append(" (").append(HU_DOW[day.getDate().getDayOfWeek().getValue() - 1]).append("): ")
                .append("score ").append(orDash(day.getScore()))
                .append(" [alvás ").append(orDash(subscores != null ? subscores.getSleep() : null))
                .append(" · fuel ").append(orDash(subscores != null ? subscores.getFuel() : null))
                .append(" · checkin ").append(orDash(subscores != null ? subscores.getCheckin() : null))
                .append(" · aktivitás ").append(orDash(subscores != null ? subscores.getActivity() : null))
                .append(']')
                .append(", ").append(orDashDecimal(day.getKcal())).append(" kcal / cél ")
                .append(orDashDecimal(day.getKcalTarget()))
                .append(", fehérje ").append(orDashDecimal(day.getProteinG())).append('g')
                .append(", súly ").append(orDashDecimal(day.getWeightKg()));
        if (day.getSleepMin() != null) {
            sb.append(", alvás ").append(day.getSleepMin() / 60).append("ó")
                    .append(day.getSleepMin() % 60).append('p');
            if (day.getSleepQuality() != null) {
                sb.append(" (").append(orDashDecimal(day.getSleepQuality())).append(')');
            }
        } else {
            sb.append(", alvás –");
        }
        sb.append(", ").append(day.getCheckinCount() != null ? day.getCheckinCount() : 0).append(" check-in")
                .append(", ").append(day.getWorkoutCount() != null ? day.getWorkoutCount() : 0).append(" edzés")
                .append(", ").append(orDash(day.getXp())).append(" XP");
        return sb.toString();
    }

    private static String orDash(Object v) {
        return v != null ? v.toString() : "–";
    }

    private static String orDashDecimal(java.math.BigDecimal v) {
        return v != null ? v.stripTrailingZeros().toPlainString() : "–";
    }

    private static String truncate(String text, int maxLen) {
        if (text == null) {
            return "";
        }
        return text.length() <= maxLen ? text : text.substring(0, maxLen);
    }

    private static String firstSentence(String text) {
        int dot = text.indexOf('.');
        return dot >= 0 ? text.substring(0, dot + 1).strip() : text.strip();
    }

    private ParsedReview parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedReview.class);
        } catch (Exception e) {
            log.warn("Weekly review answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private List<DayNote> resolveDayNotes(List<ParsedDayNote> dayNotes, LocalDate weekStart) {
        if (dayNotes == null) {
            return List.of();
        }
        LocalDate weekEnd = weekStart.plusDays(6);
        List<DayNote> resolved = new ArrayList<>();
        for (ParsedDayNote note : dayNotes) {
            if (note == null || note.date() == null || note.note() == null) {
                continue;
            }
            LocalDate date;
            try {
                date = LocalDate.parse(note.date());
            } catch (Exception e) {
                continue;
            }
            if (date.isBefore(weekStart) || date.isAfter(weekEnd)) {
                continue;
            }
            resolved.add(new DayNote(date, note.note()));
        }
        return resolved;
    }

    private List<Highlight> resolveHighlights(List<Integer> indexes, List<Highlight> candidates) {
        if (indexes == null) {
            return List.of();
        }
        return indexes.stream()
                .filter(i -> i != null && i >= 0 && i < candidates.size())
                .distinct()
                .map(candidates::get)
                .toList();
    }
}

package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.DayDimensionFactsInner;
import io.mrkuhne.mezo.api.dto.DayEvaluationResponse;
import io.mrkuhne.mezo.api.dto.DayEvaluationResponseAdjustment;
import io.mrkuhne.mezo.api.dto.DayEvaluationResponseHighlightsInner;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewJson;
import io.mrkuhne.mezo.feature.companion.repository.DayReviewRepository;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayEvaluation;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayInputs;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DimFact;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The day-evaluation READ endpoint's assembler (mezo-jcpt.4, plan 2/2, task 8): the deterministic
 * 6-dimension evaluation plus — lazily, for a CLOSED and SCORED day only — a cached LLM prose
 * layer over it.
 *
 * <p><b>The deterministic answer is the answer.</b> Prose is a bonus: every LLM failure (port
 * absent because a switch is off, provider throw/timeout, unparseable answer, schema mismatch)
 * yields a 200 carrying the full evaluation with an EMPTY narrative and NO persisted row — never
 * a 5xx, never a cached lie, self-healing on the next read ({@code MealCoachService}'s contract,
 * one day-shaped level up).
 *
 * <p><b>Assembly sequence</b> (the brief's order):
 * <ol>
 *   <li><b>State</b> — the server-side mirror of the frontend's four {@code weekDay.ts} states
 *       plus {@code in_progress}; see {@link #state}.</li>
 *   <li><b>Engine</b> — {@link DayScoreService#inputsFor} loads the day, {@link
 *       DayEvaluationEngine#evaluate} scores it. No math lives here.</li>
 *   <li><b>Context signals</b> — the UNSCORED facts, filled DETERMINISTICALLY from their real
 *       sources ({@link #contextSignals}); they go into the response AND into the model's user
 *       message, precisely so the model never has to invent them.</li>
 *   <li><b>Prose</b> — cache read keyed by {@link #inputsHash}; a match serves the stored
 *       envelope with ZERO calls, a mismatch or a missing row costs exactly ONE call, parsed,
 *       clamped and upserted.</li>
 *   <li><b>Score</b> — {@code score = base == null ? null : clamp(base + delta, 0, 100)}, with
 *       {@code base} still reported separately: the correction is a visible chip, never silently
 *       folded into the number.</li>
 * </ol>
 *
 * <p>Deliberately holds NO transaction: {@code inputsFor} owns its own read-only one and the two
 * repository calls own theirs, so the LLM roundtrip never pins a pooled connection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayReviewService {

    /** Verbatim from the task brief — do not paraphrase; the fake LLM keys off nothing here. */
    static final String SYSTEM_PROMPT = """
        Egy fitness-app napi értékelő rétege vagy. Megkapod a nap determinisztikus dimenzió-pontjait,
        tényeit, a nem pontozott kontextus-jeleket (energia, súlytrend) és az előző napok mintáit.
        Válaszolj EGY JSON objektummal:
        {"narrative":[string,...],"dimensionNotes":{"<dim-id>":string},
         "highlights":[{"kind":"key|pattern|win","label":string}],
         "adjustment":{"delta":int,"reason":string} | null}
        Szabályok:
        - Magyarul, tegeződve, ítélkezésmentesen — tényt nevezel meg, nem minősítesz.
        - narrative: 2-3 bekezdés, ami ÖSSZEKÖTI a dimenziókat (ok-okozat, minták), nem felolvassa őket.
        - dimensionNotes: minden DONE dimenzióhoz 1-2 mondat, mindig MÁS adatból hozott kontextussal.
        - adjustment: CSAK ha a számok nem látnak valamit (edzésnapi refeed, betegnap-jel); delta −5..+5
          egész, kötelező indoklással. Ha nincs ok, null.
        - A kapott számoknak soha ne mondj ellent és ne találj ki újakat.
        """;

    /** The AI correction's hard bounds — binding (constraints.md), enforced here, not trusted. */
    private static final int DELTA_MIN = -5;
    private static final int DELTA_MAX = 5;
    private static final int SCORE_MIN = 0;
    private static final int SCORE_MAX = 100;
    /** Card-sized by construction, like the meal coach's note cap. */
    private static final int NOTE_MAX = 240;
    private static final int HIGHLIGHT_MAX = 3;
    /** The only kinds the day page knows how to colour — see {@link #kind}. */
    private static final Set<String> HIGHLIGHT_KINDS = Set.of("key", "pattern", "win");
    /** How far back the under-target sleep streak is allowed to look — a bounded, single query. */
    private static final int SLEEP_STREAK_WINDOW_DAYS = 14;

    private static final String STATE_FUTURE = "future";
    private static final String STATE_IN_PROGRESS = "in_progress";
    private static final String STATE_SCORED = "scored";
    private static final String STATE_THIN = "thin";
    private static final String STATE_EMPTY = "empty";

    private static final String DONE = "DONE";

    /** The LLM answer contract — permissive by design; anything malformed degrades, never errors. */
    record ExtractedHighlight(String kind, String label) {
    }

    record ExtractedAdjustment(Integer delta, String reason) {
    }

    record ExtractedReview(List<String> narrative, Map<String, String> dimensionNotes,
                           List<ExtractedHighlight> highlights, ExtractedAdjustment adjustment) {
    }

    private final DayScoreService dayScoreService;
    private final DayEvaluationEngine dayEvaluationEngine;
    private final DayReviewRepository dayReviewRepository;
    private final MetricSeriesService metricSeriesService;
    private final WeightTrendService weightTrendService;
    private final DayEvaluationProperties properties;
    private final ObjectProvider<DayReviewLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** One day's full evaluation — deterministic always, prose when the day has earned one. */
    public DayEvaluationResponse assemble(UUID userId, LocalDate date) {
        DayInputs inputs = dayScoreService.inputsFor(userId, date);
        DayEvaluation evaluation = dayEvaluationEngine.evaluate(inputs);
        String state = state(inputs, evaluation, LocalDate.now());

        // A future day has no signals to report: its energy/sleep series are empty by definition
        // and the user-level weight trend would be the only thing shown, which would read as a
        // fact about a day that has not happened.
        List<DayReviewJson.ContextSignal> signals = STATE_FUTURE.equals(state)
            ? List.of() : signalsOrNone(userId, date);

        // Prose exists ONLY for a closed, scored day (the brief): an open, thin or empty day has
        // nothing stable to narrate, and asking anyway would burn a call per page view.
        DayReviewJson envelope = STATE_SCORED.equals(state)
            ? prose(userId, date, evaluation, signals, inputs.priorBaseScores()) : null;

        return response(date, state, evaluation, signals, envelope);
    }

    // --- State -----------------------------------------------------------------------------

    /**
     * The server-side mirror of the frontend's {@code weekDay.ts} four states, plus the
     * {@code in_progress} the frontend never needed (its week view has no live day page):
     * <pre>
     *   date &gt; today                      -&gt; future        (nothing has happened yet)
     *   date == today                     -&gt; in_progress   (still gathering; no overall score)
     *   closed &amp;&amp; base != null            -&gt; scored
     *   closed &amp;&amp; nothing was logged      -&gt; empty         ("nincs adat")
     *   closed &amp;&amp; something was logged    -&gt; thin          ("tanulom" — &lt;2 DONE dimensions)
     * </pre>
     * {@code empty} asks the day's OWN logs, not the dimension statuses: on a closed day the
     * {@code logging} dimension is always DONE (a genuinely untouched day scores a real 0, by
     * design) and {@code rhythm} is computed from PRIOR days, so "all dimensions degraded" would
     * never fire and every untouched day would read as {@code thin}.
     */
    private static String state(DayInputs inputs, DayEvaluation evaluation, LocalDate today) {
        LocalDate date = inputs.date();
        if (date.isAfter(today)) {
            return STATE_FUTURE;
        }
        if (date.isEqual(today)) {
            return STATE_IN_PROGRESS;
        }
        if (evaluation.base() != null) {
            return STATE_SCORED;
        }
        return hasAnyLog(inputs) ? STATE_THIN : STATE_EMPTY;
    }

    /** Did the user write ANYTHING down for this day? (weight/XP live outside {@link DayInputs};
     *  a day carrying only those reads as {@code empty} here — noted, not silently assumed away.) */
    private static boolean hasAnyLog(DayInputs in) {
        return in.kcal() != null
            || in.sleepH() != null
            || in.checkinCount() > 0
            || in.waterLogged()
            || (in.meals() != null && !in.meals().isEmpty())
            || (in.doneWorkouts() != null && in.doneWorkouts() > 0);
    }

    // --- Context signals (deterministic, never the model's) ----------------------------------

    /**
     * The day's UNSCORED facts, each from its real source — the model is TOLD these, it never
     * invents them. A signal with no measurement is ABSENT, never a fabricated neutral value.
     * <ul>
     *   <li>{@code energia} — the day's {@code CHECKIN_ENERGY} mean ({@link MetricSeriesService});</li>
     *   <li>{@code súlytrend} — {@link WeightTrendService#computeTrend}'s EWMA weekly rate;</li>
     *   <li>{@code alvás cél alatt} — consecutive days ending at {@code date} whose logged sleep
     *       was under {@link DayEvaluationProperties#sleepTargetH()}. A day with NO sleep log
     *       breaks the streak: unknown is not "under".</li>
     * </ul>
     */
    private List<DayReviewJson.ContextSignal> contextSignals(UUID userId, LocalDate date) {
        List<DayReviewJson.ContextSignal> signals = new ArrayList<>();

        Double energy = metricSeriesService
            .series(userId, MetricKey.CHECKIN_ENERGY, date, date).get(date);
        if (energy != null) {
            signals.add(new DayReviewJson.ContextSignal("energia", fmt1(energy) + " / 10"));
        }

        BigDecimal rate = weeklyRate(userId);
        if (rate != null) {
            signals.add(new DayReviewJson.ContextSignal("súlytrend",
                fmt2(rate.doubleValue()) + " kg/hét"));
        }

        int streak = underTargetSleepStreak(userId, date);
        if (streak > 0) {
            signals.add(new DayReviewJson.ContextSignal("alvás cél alatt", streak + " napja"));
        }

        return signals;
    }

    /**
     * {@link #contextSignals}, but a failure there costs the signals — not the page. These are
     * BONUS facts read from two neighbouring services; the six dimensions and the score are
     * already complete without them, so a throw degrades to no signals rather than a 5xx (the
     * same rule the prose layer lives by).
     */
    private List<DayReviewJson.ContextSignal> signalsOrNone(UUID userId, LocalDate date) {
        try {
            return contextSignals(userId, date);
        } catch (Exception e) {
            log.warn("Day-evaluation context signals failed for {} on {} — serving the day "
                + "without them", userId, date, e);
            return List.of();
        }
    }

    /** Null-safe read of the weight trend — an absent/empty trend yields no signal at all. */
    private BigDecimal weeklyRate(UUID userId) {
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        return trend == null ? null : trend.getWeeklyRateKgPerWeek();
    }

    /** Consecutive under-target sleep days ending at {@code date}, over one bounded query. */
    private int underTargetSleepStreak(UUID userId, LocalDate date) {
        LocalDate from = date.minusDays(SLEEP_STREAK_WINDOW_DAYS - 1L);
        Map<LocalDate, Double> series =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, date);
        int streak = 0;
        for (LocalDate day = date; !day.isBefore(from); day = day.minusDays(1)) {
            Double hours = series.get(day);
            if (hours == null || hours >= properties.sleepTargetH()) {
                break;
            }
            streak++;
        }
        return streak;
    }

    // --- Prose (lazy, hash-keyed, one call at most) -------------------------------------------

    /**
     * The cached envelope when {@link #inputsHash} still matches the row; otherwise exactly ONE
     * generation, upserted. {@code null} when there is no prose to be had — which is always a
     * legitimate outcome, not an error.
     */
    private DayReviewJson prose(UUID userId, LocalDate date, DayEvaluation evaluation,
        List<DayReviewJson.ContextSignal> signals, List<Integer> priorBaseScores) {
        try {
            String hash = inputsHash(evaluation);
            Optional<DayReviewEntity> cached =
                dayReviewRepository.findByCreatedByAndDate(userId, date);
            if (cached.isPresent() && hash.equals(cached.get().getInputsHash())) {
                return cached.get().getEnvelope();
            }
            DayReviewLlm port = llm.getIfAvailable();
            if (port == null) {
                return null;   // day-review or companion switch off — the numbers stand alone
            }
            String userMessage = userMessage(date, evaluation, signals, priorBaseScores);
            String answer = llmCallContextHolder.runWith(
                new LlmCallContext("day_review", "narrate", "day", null),
                () -> port.complete(SYSTEM_PROMPT, userMessage));
            DayReviewJson envelope = parse(answer, signals);
            if (envelope == null) {
                log.warn("Day review for {} on {}: unusable answer — nothing persisted, the "
                    + "deterministic evaluation is served un-narrated", userId, date);
                return null;
            }
            upsert(userId, date, cached.orElse(null), envelope, hash);
            return envelope;
        } catch (Exception e) {
            log.warn("Day review failed for {} on {} — serving the deterministic evaluation",
                userId, date, e);
            return null;
        }
    }

    /**
     * The cache key: {@code sha256} over each dimension's {@code id|score|status} (in the engine's
     * fixed order) plus the day's {@code base}. Those ARE the numbers the prose explains — a
     * retroactive log that moves any of them invalidates the narrative that justified them, and
     * nothing else can. The unscored context signals are deliberately OUTSIDE the key: they are
     * re-read fresh on every call and never fold into a cached sentence's correctness.
     */
    static String inputsHash(DayEvaluation evaluation) throws NoSuchAlgorithmException {
        StringBuilder sb = new StringBuilder();
        for (DayEvaluationEngine.DayDimension d : evaluation.dimensions()) {
            sb.append(d.id()).append('|')
                .append(d.score() == null ? "" : d.score()).append('|')
                .append(d.status()).append('\n');
        }
        sb.append("base|").append(evaluation.base() == null ? "" : evaluation.base());
        return sha256Hex(sb.toString());
    }

    /** The checked {@code NoSuchAlgorithmException} is propagated rather than wrapped in a raw
     *  runtime exception (ArchUnit forbids those outside techcore): it rides the same degrade path
     *  as every other prose failure — no hash, no cache, no prose, still a 200. */
    private static String sha256Hex(String value) throws NoSuchAlgorithmException {
        byte[] digest = MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(digest.length * 2);
        for (byte b : digest) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                .append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }

    /** The day's numbers, facts, deterministic signals and prior-day pattern — nothing invented. */
    private static String userMessage(LocalDate date, DayEvaluation evaluation,
        List<DayReviewJson.ContextSignal> signals, List<Integer> priorBaseScores) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nap: ").append(date).append('\n');
        sb.append("Összpontszám (base, determinisztikus): ")
            .append(evaluation.base() == null ? "nincs" : evaluation.base()).append('\n');
        sb.append("\nDimenziók:\n");
        for (DayEvaluationEngine.DayDimension d : evaluation.dimensions()) {
            sb.append("- ").append(d.id()).append(" (").append(d.label()).append("): ")
                .append(d.score() == null ? "nincs pont" : d.score())
                .append(" · státusz ").append(d.status())
                .append(" · súly ").append(String.format(Locale.ROOT, "%.2f", d.weight()))
                .append('\n');
            if (d.facts() != null) {
                for (DimFact f : d.facts()) {
                    sb.append("    ").append(f.label()).append(": ").append(f.value()).append('\n');
                }
            }
        }
        sb.append("\nNem pontozott kontextus-jelek (determinisztikus, NE találj ki továbbiakat):\n");
        if (signals.isEmpty()) {
            sb.append("- nincs\n");
        } else {
            for (DayReviewJson.ContextSignal s : signals) {
                sb.append("- ").append(s.label()).append(": ").append(s.value()).append('\n');
            }
        }
        sb.append("\nElőző napok base-pontjai (a ritmus dimenzió alapja): ")
            .append(priorBaseScores == null || priorBaseScores.isEmpty()
                ? "nincs" : priorBaseScores.toString())
            .append('\n');
        return sb.toString();
    }

    /**
     * The model's answer, cleaned. Returns {@code null} for anything unusable (no JSON object, no
     * narrative) so the caller degrades rather than persisting an empty envelope. Anything
     * out-of-contract INSIDE a usable answer is dropped field by field: an over-range delta is
     * clamped, a reason-less adjustment is discarded entirely.
     */
    private DayReviewJson parse(String answer, List<DayReviewJson.ContextSignal> signals) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        ExtractedReview parsed =
            objectMapper.readValue(answer.substring(start, end + 1), ExtractedReview.class);
        List<String> narrative = narrative(parsed);
        if (narrative.isEmpty()) {
            return null;   // prose-less "prose" is not worth a row
        }
        return new DayReviewJson(narrative, notes(parsed), highlights(parsed),
            adjustment(parsed), signals);
    }

    private static List<String> narrative(ExtractedReview parsed) {
        if (parsed.narrative() == null) {
            return List.of();
        }
        return parsed.narrative().stream()
            .filter(p -> p != null && !p.isBlank())
            .map(String::trim)
            .toList();
    }

    private static Map<String, String> notes(ExtractedReview parsed) {
        if (parsed.dimensionNotes() == null) {
            return Map.of();
        }
        Map<String, String> out = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : parsed.dimensionNotes().entrySet()) {
            String raw = e.getValue();
            if (e.getKey() == null || raw == null || raw.isBlank()) {
                continue;
            }
            String trimmed = raw.trim();
            out.put(e.getKey(),
                trimmed.length() <= NOTE_MAX ? trimmed : trimmed.substring(0, NOTE_MAX));
        }
        return out;
    }

    /**
     * Up to three highlights, each with a {@code kind} the frontend can actually render. The
     * contract types {@code kind} as a free string but documents it as {@code key|pattern|win},
     * and the day page switches on it to pick a chip colour — so a model-invented kind is
     * normalised to {@code key} rather than passed through to fall out of that mapping. The label
     * is the load-bearing half; the kind is presentation.
     */
    private static List<DayReviewJson.Highlight> highlights(ExtractedReview parsed) {
        if (parsed.highlights() == null) {
            return List.of();
        }
        return parsed.highlights().stream()
            .filter(h -> h != null && h.label() != null && !h.label().isBlank())
            .limit(HIGHLIGHT_MAX)
            .map(h -> new DayReviewJson.Highlight(kind(h.kind()), h.label().trim()))
            .toList();
    }

    /** {@code key|pattern|win}, or {@code key} for anything blank, unknown or invented. */
    private static String kind(String raw) {
        String trimmed = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return HIGHLIGHT_KINDS.contains(trimmed) ? trimmed : "key";
    }

    /**
     * The clamp, and the discard. {@code delta} is an integer in [−5, +5] — anything outside is
     * clamped to the bound, and an adjustment WITHOUT a reason is thrown away entirely rather
     * than defaulted: an unexplained score nudge is exactly the thing the honesty rules forbid.
     */
    private static DayReviewJson.Adjustment adjustment(ExtractedReview parsed) {
        ExtractedAdjustment raw = parsed.adjustment();
        if (raw == null || raw.delta() == null || raw.reason() == null || raw.reason().isBlank()) {
            return null;
        }
        int delta = Math.max(DELTA_MIN, Math.min(DELTA_MAX, raw.delta()));
        return new DayReviewJson.Adjustment(delta, raw.reason().trim());
    }

    /** One live row per user+day (partial unique index) — rewritten in place on a hash change. */
    private void upsert(UUID userId, LocalDate date, DayReviewEntity existing,
        DayReviewJson envelope, String hash) {
        DayReviewEntity row = existing != null ? existing : new DayReviewEntity();
        row.setCreatedBy(userId);
        row.setDate(date);
        row.setEnvelope(envelope);
        row.setInputsHash(hash);
        row.setComputedAt(Instant.now());
        dayReviewRepository.save(row);
    }

    // --- Wire assembly -------------------------------------------------------------------------

    private static DayEvaluationResponse response(LocalDate date, String state,
        DayEvaluation evaluation, List<DayReviewJson.ContextSignal> signals,
        DayReviewJson envelope) {
        DayReviewJson.Adjustment adjustment = envelope == null ? null : envelope.adjustment();
        Integer base = evaluation.base();
        return DayEvaluationResponse.builder()
            .date(date)
            .state(state)
            .base(base)
            .score(score(base, adjustment))
            .adjustment(adjustment == null ? null : DayEvaluationResponseAdjustment.builder()
                .delta(adjustment.delta()).reason(adjustment.reason()).build())
            .narrative(envelope == null || envelope.narrative() == null
                ? List.of() : envelope.narrative())
            .highlights(envelope == null || envelope.highlights() == null ? List.of()
                : envelope.highlights().stream()
                    .map(h -> DayEvaluationResponseHighlightsInner.builder()
                        .kind(h.kind()).label(h.label()).build())
                    .toList())
            .context(signals.stream()
                .map(s -> DayDimensionFactsInner.builder().label(s.label()).value(s.value()).build())
                .toList())
            .dimensions(dimensions(evaluation, envelope))
            .build();
    }

    /** {@code base + delta}, clamped to 0..100 — and {@code base} itself stays on the wire. */
    private static Integer score(Integer base, DayReviewJson.Adjustment adjustment) {
        if (base == null) {
            return null;
        }
        int delta = adjustment == null ? 0 : adjustment.delta();
        return Math.max(SCORE_MIN, Math.min(SCORE_MAX, base + delta));
    }

    private static List<io.mrkuhne.mezo.api.dto.DayDimension> dimensions(DayEvaluation evaluation,
        DayReviewJson envelope) {
        Map<String, String> notes = envelope == null || envelope.dimensionNotes() == null
            ? Map.of() : envelope.dimensionNotes();
        List<io.mrkuhne.mezo.api.dto.DayDimension> out = new ArrayList<>();
        for (DayEvaluationEngine.DayDimension d : evaluation.dimensions()) {
            out.add(io.mrkuhne.mezo.api.dto.DayDimension.builder()
                .id(d.id())
                .label(d.label())
                .weight(BigDecimal.valueOf(d.weight()).setScale(4, RoundingMode.HALF_UP))
                .score(d.score())
                .status(d.status())
                .facts(d.facts() == null ? List.of() : d.facts().stream()
                    .map(f -> DayDimensionFactsInner.builder()
                        .label(f.label()).value(f.value()).build())
                    .toList())
                // a note only ever belongs to a DONE dimension — the prompt asks for those only,
                // and a note on a degraded dimension would be prose about absent data
                .note(DONE.equals(d.status()) ? notes.get(d.id()) : null)
                .build());
        }
        return out;
    }

    private static String fmt1(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    private static String fmt2(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }
}

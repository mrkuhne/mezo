package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.MealCoachVerdict;
import io.mrkuhne.mezo.api.dto.MealImproveRow;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.meal.service.MealCoachStore.LoadedMeal;
import io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The LLM coach layer over the deterministic meal score (mezo-mr4n, spec
 * {@code 2026-07-27-llm-meal-coach-design.md}): ONE cheap-tier call turns a day's already-computed
 * numbers into Hungarian prose — a card-sized {@code tagline}, a 2-3 sentence {@code summary}, and
 * up to three {@code improve} rows. The numbers are NEVER the LLM's; only the envelope's prose
 * sockets are written ({@link MealCoachStore#writeProse}).
 *
 * <p>Verdicts cache in the meal's own {@code breakdown} jsonb and need no explicit invalidation:
 * editing a meal re-runs {@code MealService.applyScore}, which rewrites the envelope with null
 * prose, so a stale verdict cannot outlive its numbers.
 *
 * <p>Any failure (companion off, LLM throw, unparseable answer, unknown mealId, blank summary)
 * drops that verdict, persists NOTHING and returns whatever was already cached — degraded honesty,
 * never a 5xx, self-healing on the next read (the {@code RecipeBreakdownProseService} contract).
 * This service holds NO transaction: {@link MealCoachStore} owns the short read/write ones so the
 * LLM roundtrip never pins a pooled connection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_COACH_SWITCH, havingValue = "true")
public class MealCoachService {

    /** Card-sized by construction — a longer cut is truncated rather than shown broken. */
    private static final int TAGLINE_MAX = 60;
    private static final int IMPROVE_MAX = 3;

    private static final String SYSTEM_PROMPT = """
        Egy fitness-alkalmazás étkezés-coach rétege vagy: a felhasználó MÁR LOGOLT étkezéseiről
        adsz rövid, kontextusos szakvéleményt.
        Megkapod az étkezéseket, a determinisztikus pontszámukat dimenziónként, a szerepüket
        (standard / pre_workout / post_workout), az aznapi edzéseket, és azt, hol tartott a napi
        keret az adott étkezés PILLANATÁBAN.
        Válaszolj EGY JSON objektummal és semmi mással:
        {"meals":[{"mealId":string,"tagline":string,"summary":string,
                   "improve":[{"text":string,"impact":string}]}]}
        Szabályok:
        - Magyarul, tegeződve, tömören.
        - tagline: LEGFELJEBB 60 karakter, kártyára való vágat (pl. "Remek pre-workout üzemanyag").
        - summary: 2-3 mondat — mire volt jó ez az étkezés EBBEN a helyzetben, a szerepét figyelembe véve.
        - improve: 0-3 konkrét javaslat; az impact rövid kvalitatív címke (pl. "+rost", "-NOVA4").
        - A megadott SZÁMOKNAK soha ne mondj ellent és ne találj ki újakat — magyarázod őket.
        - Minden étkezésnél CSAK a saját pillanatáig ismert napi állapotot vedd figyelembe;
          későbbi étkezésre ne utalj egy korábbi értékelésében.
        - Pre-workout szerepnél a gyors szénhidrát ÜZEMANYAG, nem hiba; post-workoutnál a fehérje
          és a szénhidrát-pótlás a fő szempont.
        - Minden kapott mealId-hoz pontosan egy objektum tartozzon.
        """;

    /** LLM answer contract — permissive shapes; a malformed answer degrades, never errors. */
    record ExtractedImprove(String text, String impact) {
    }

    record ExtractedVerdict(String mealId, String tagline, String summary,
                            List<ExtractedImprove> improve) {
    }

    record ExtractedAnswer(List<ExtractedVerdict> meals) {
    }

    private final MealCoachStore store;
    private final WorkoutWindowQueryService workoutWindowQueryService;
    private final NutritionTargetsProperties targets;
    private final MealScoringProperties scoringProperties;
    private final ObjectProvider<MealCoachLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /**
     * A day's verdicts: everything already cached, plus — when {@code allowGenerate} — ONE batched
     * call for the still-verdictless meals of that day. The caller owns the today-vs-history rule.
     */
    public List<MealCoachVerdict> generateForDay(UUID userId, LocalDate date, boolean allowGenerate) {
        List<LoadedMeal> day = store.loadDay(userId, date);
        return verdicts(userId, date, day, day, allowGenerate);
    }

    /** One meal's verdict, generating on demand for any date (an explicit score-sheet open). */
    public List<MealCoachVerdict> generateForMeal(UUID userId, UUID mealId) {
        LocalDate date = store.dateOfOwnedMeal(userId, mealId);
        List<LoadedMeal> day = store.loadDay(userId, date);
        List<LoadedMeal> wanted = day.stream().filter(m -> m.id().equals(mealId)).toList();
        return verdicts(userId, date, day, wanted, true);
    }

    /**
     * Cached verdicts of {@code wanted} plus, when allowed, one generated batch for those without.
     * {@code day} is always the FULL day — it supplies each meal's up-to-that-point state even when
     * only one meal is narrated, so a single open and a day batch produce identical prompts.
     */
    private List<MealCoachVerdict> verdicts(UUID userId, LocalDate date, List<LoadedMeal> day,
        List<LoadedMeal> wanted, boolean allowGenerate) {
        List<MealCoachVerdict> cached = wanted.stream()
            .filter(MealCoachService::hasVerdict)
            .map(MealCoachService::toVerdict)
            .toList();
        List<LoadedMeal> missing = wanted.stream()
            .filter(m -> !hasVerdict(m) && m.breakdown() != null)
            .toList();
        if (!allowGenerate || missing.isEmpty()) {
            return cached;
        }
        List<MealCoachVerdict> all = new ArrayList<>(cached);
        all.addAll(generate(userId, date, day, missing));
        return all;
    }

    /** The LLM leg: prompt → call → parse → persist. Deliberately runs with no transaction open. */
    private List<MealCoachVerdict> generate(UUID userId, LocalDate date, List<LoadedMeal> day,
        List<LoadedMeal> missing) {
        MealCoachLlm port = llm.getIfAvailable();
        if (port == null) {
            return List.of();   // companion off — the deterministic envelope is served un-enriched
        }
        try {
            List<Window> windows = workoutWindowQueryService.windowsFor(userId, date);
            Map<UUID, MealCoachPrompt.MealBlock> blocks = blocks(day, missing, windows);
            if (blocks.isEmpty()) {
                return List.of();
            }
            String userMessage =
                MealCoachPrompt.userMessage(date, targets, windows, List.copyOf(blocks.values()));
            // The subject is a single meal only when exactly one is narrated (an opened score sheet);
            // a day batch is about the day, so it leaves the entity id honestly empty (mezo-2zyu).
            UUID subject = blocks.size() == 1 ? blocks.keySet().iterator().next() : null;
            String answer = llmCallContextHolder.runWith(
                new LlmCallContext("meal_coach", "verdict", "meal", subject),
                () -> port.complete(SYSTEM_PROMPT, userMessage));
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            ExtractedAnswer parsed = objectMapper.readValue(json, ExtractedAnswer.class);
            return persist(userId, parsed, blocks.keySet());
        } catch (Exception e) {
            log.warn("Meal coach failed for {} on {} — serving the deterministic envelopes",
                userId, date, e);
            return List.of();
        }
    }

    /**
     * One prompt block per verdictless meal, each carrying the day totals BEFORE it — the fold that
     * makes a verdict reproducible (spec §4). The whole day is walked even when a single meal is
     * narrated, so its state is the same either way.
     */
    private Map<UUID, MealCoachPrompt.MealBlock> blocks(List<LoadedMeal> day,
        List<LoadedMeal> missing, List<Window> windows) {
        Set<UUID> wantedIds = missing.stream().map(LoadedMeal::id).collect(java.util.stream.Collectors.toSet());
        Map<UUID, MealCoachPrompt.MealBlock> blocks = new LinkedHashMap<>();
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal p = BigDecimal.ZERO;
        BigDecimal c = BigDecimal.ZERO;
        BigDecimal f = BigDecimal.ZERO;
        int index = 0;
        for (LoadedMeal meal : day) {
            index++;
            if (wantedIds.contains(meal.id())) {
                LocalTime loggedAt = LocalTime.ofInstant(meal.loggedAt(), ZoneId.systemDefault());
                blocks.put(meal.id(), new MealCoachPrompt.MealBlock(meal.id(), meal.title(),
                    meal.slot(), loggedAt, index, meal.breakdown(), roleOf(loggedAt, windows),
                    kcal, p, c, f));
            }
            kcal = kcal.add(meal.kcal());
            p = p.add(meal.p());
            c = c.add(meal.c());
            f = f.add(meal.f());
        }
        return blocks;
    }

    /** The same role the scorer derived at write time — re-derived from the day's windows. */
    private MealRole roleOf(LocalTime loggedAt, List<Window> windows) {
        return MealScoringService.classifyRole(loggedAt, windows.stream()
                .map(w -> new MealScoringService.WorkoutWindow(w.start(), w.end(), w.done()))
                .toList(),
            scoringProperties.preLeadMin(), scoringProperties.postTrailMin());
    }

    /** Persists the parsed verdicts; anything unattributable or prose-less is dropped, not stored. */
    private List<MealCoachVerdict> persist(UUID userId, ExtractedAnswer parsed, Set<UUID> allowedIds) {
        if (parsed == null || parsed.meals() == null) {
            return List.of();
        }
        List<MealCoachVerdict> out = new ArrayList<>();
        for (ExtractedVerdict v : parsed.meals()) {
            UUID mealId = parseId(v.mealId());
            if (mealId == null || !allowedIds.contains(mealId)
                || v.summary() == null || v.summary().isBlank()) {
                log.warn("Meal coach: dropping a verdict (unknown mealId {} or blank summary)",
                    v.mealId());
                continue;
            }
            store.writeProse(userId, mealId, v.summary(), tagline(v.tagline()), improve(v))
                .map(MealCoachService::toVerdict)
                .ifPresent(out::add);
        }
        return out;
    }

    private static UUID parseId(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String tagline(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.length() <= TAGLINE_MAX ? trimmed : trimmed.substring(0, TAGLINE_MAX).trim();
    }

    private static List<MealBreakdownJson.ImproveRow> improve(ExtractedVerdict v) {
        return v.improve() == null ? List.of() : v.improve().stream()
            .filter(i -> i.text() != null && !i.text().isBlank())
            .limit(IMPROVE_MAX)
            .map(i -> new MealBreakdownJson.ImproveRow(i.text(),
                i.impact() == null ? "" : i.impact()))
            .toList();
    }

    /** A meal counts as narrated once it carries prose — the summary is the required half. */
    private static boolean hasVerdict(LoadedMeal meal) {
        return meal.breakdown() != null && meal.breakdown().summary() != null
            && !meal.breakdown().summary().isBlank();
    }

    private static MealCoachVerdict toVerdict(LoadedMeal meal) {
        MealBreakdownJson b = meal.breakdown();
        return MealCoachVerdict.builder()
            .mealId(meal.id())
            .tagline(b.tagline())
            .summary(b.summary())
            .improve(b.improve() == null ? List.of() : b.improve().stream()
                .map(i -> MealImproveRow.builder().text(i.text()).impact(i.impact()).build())
                .toList())
            .build();
    }
}

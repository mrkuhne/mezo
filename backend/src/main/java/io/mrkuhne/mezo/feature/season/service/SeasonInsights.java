package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkCalculator;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * „Amit Boop észrevett" (spec §5.6) — at most three insights, each present only past its data gate, never a
 * placeholder:
 *
 * <ol>
 *   <li>{@code learned_expenditure} — the engine serves a learned base ({@code LearnedBaseResolver}) and it is at
 *       least {@value #LEARNED_MIN_DIFF_KCAL} kcal away from the planned (formula) expenditure;</li>
 *   <li>{@code short_night_intake} — nights under 7 h vs the rest, paired with that day's logged intake over the last
 *       {@value #EFFECT_WINDOW_DAYS} days ending yesterday (judged days only: no today, no kímélő day, something
 *       logged); gate = {@link EffectLinkCalculator#compute} present with |Cliff's delta| ≥
 *       {@link EffectLinkCalculator#SMALL}; the number is the real mean difference rounded to 10 kcal (also
 *       {@code map.links[sleep_food]});</li>
 *   <li>{@code guard} — any warning of the season as it stands (strength, cut pace, muscles under their floor), in
 *       the preview's own Hungarian words.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class SeasonInsights {

    static final int LEARNED_MIN_DIFF_KCAL = 50;
    static final int EFFECT_WINDOW_DAYS = 60;
    static final int SHORT_NIGHT_MIN = 7 * 60;

    private final SeasonRepository seasonRepository;
    private final SeasonPreviewService previewService;
    private final SeasonGoalPort goalPort;
    private final AdherenceService adherenceService;

    public record Insight(String key, String title, String body) {
    }

    /** {@code sleepFoodKcal} = the short-night intake difference (rounded to 10) when its gate passes, else null. */
    public record Result(List<Insight> insights, Integer sleepFoodKcal) {
    }

    /** The active season's insights; empty without one. */
    @Transactional(readOnly = true)
    public List<Insight> insights(UUID owner) {
        Optional<SeasonEntity> s = seasonRepository.findActive(owner);
        if (s.isEmpty()) {
            return List.of();
        }
        SeasonDraftJson draft = previewService.currentDraft(owner, s.get());
        List<SeasonPreviewService.Warning> warnings = previewService.compute(owner, s.get(), draft).warnings();
        return compute(owner, s.get(), draft.trajectory(), warnings, LocalDate.now()).insights();
    }

    /** For a caller that already holds the season's computed warnings (the overview). */
    public Result compute(UUID owner, SeasonEntity season, String trajectory,
                          List<SeasonPreviewService.Warning> warnings, LocalDate today) {
        List<Insight> out = new ArrayList<>();
        goalPort.learnedExpenditure(owner, season.getGoalId()).flatMap(SeasonInsights::learned).ifPresent(out::add);
        Integer sleepFood = shortNightDifference(owner, today);
        if (sleepFood != null) {
            out.add(shortNight(sleepFood, trajectory));
        }
        if (warnings != null && !warnings.isEmpty()) {
            out.add(new Insight("guard", "Erre figyelek",
                warnings.stream().map(SeasonPreviewService.Warning::text).collect(Collectors.joining(" "))));
        }
        return new Result(List.copyOf(out.subList(0, Math.min(3, out.size()))), sleepFood);
    }

    private static Optional<Insight> learned(SeasonGoalPort.Expenditure e) {
        int planned = round10(e.plannedKcal());
        int learned = round10(e.learnedKcal());
        if (Math.abs(e.plannedKcal() - e.learnedKcal()) < LEARNED_MIN_DIFF_KCAL || planned == learned) {
            return Optional.empty();
        }
        String title = learned < planned ? "Kevesebbet égetsz, mint gondoltuk" : "Többet égetsz, mint gondoltuk";
        return Optional.of(new Insight("learned_expenditure", title,
            "A terv napi %s-lal számolt, de a mérleged és az étkezéseid alapján inkább %s körül égetsz."
                .formatted(SeasonFormat.kcal(planned), SeasonFormat.kcal(learned))));
    }

    /** The mean next-day intake difference after a short night, rounded to 10 kcal; null below the gate. */
    private Integer shortNightDifference(UUID owner, LocalDate today) {
        List<AdherenceService.AdherenceDay> days =
            adherenceService.days(owner, today.minusDays(EFFECT_WINDOW_DAYS), today.minusDays(1), today);
        Map<LocalDate, Double> intake = new LinkedHashMap<>();
        Set<LocalDate> shortNights = new HashSet<>();
        for (AdherenceService.AdherenceDay d : days) {
            if (!d.judged() || d.sleepMin() == null) {
                continue;
            }
            intake.put(d.date(), d.kcal().doubleValue());
            if (d.sleepMin() < SHORT_NIGHT_MIN) {
                shortNights.add(d.date());
            }
        }
        return EffectLinkCalculator.compute(shortNights, intake)
            .filter(e -> Math.abs(e.cliffsDelta()) >= EffectLinkCalculator.SMALL)
            .map(e -> round10((int) Math.round(e.meanDiff())))
            .filter(diff -> diff != 0)
            .orElse(null);
    }

    private static Insight shortNight(int diff, String trajectory) {
        boolean more = diff > 0;
        String body = "Ha 7 óránál kevesebbet alszol, másnap átlagosan %d kcal-lal %s eszel."
            .formatted(Math.abs(diff), more ? "többet" : "kevesebbet");
        if (more && "cut".equals(trajectory)) {
            body += " Vagyis a jobb alvás is segít fogyni.";
        }
        return new Insight("short_night_intake", more ? "Rossz alvás után többet eszel" : "Rossz alvás után kevesebbet eszel",
            body);
    }

    static int round10(int kcal) {
        return Math.round(kcal / 10f) * 10;
    }
}

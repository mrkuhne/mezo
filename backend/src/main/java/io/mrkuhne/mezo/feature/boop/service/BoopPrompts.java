package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Conflict;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * The Boop brief prompt (Boop S3, mezo-r36n9.7). The system prompt is fixed and starts with
 * {@link #MARKER} — {@code FakeCompanionLlm} mirrors it literally (no import back into boop) to
 * answer deterministically. The user message carries the day's COMPUTED numbers; the model is told
 * not to score, only to put the scores into words. Missing data is written as "nincs adat" so the
 * model can say so instead of inventing a number.
 */
final class BoopPrompts {

    /** First token of the system prompt; FakeCompanionLlm keys its canned answer on it. */
    static final String MARKER = "BOOP_BRIEF_V1";

    private static final String NO_DATA = "nincs adat";

    static final String SYSTEM_PROMPT = MARKER + """
        : Te vagy Boop, a felhasználó reggeli társa egy egészség-alkalmazásban. A felhasználót
        tegezed, melegen és közvetlenül beszélsz, szakszavak nélkül, magyarul. A pontszámokat már
        kiszámoltuk — NE számolj és NE pontozz újra, csak mondd el szavakkal, mit jelentenek.
        Soha ne találj ki számot: ha egy adatnál "nincs adat" áll, mondd ki egyszerűen, hogy erről
        nincs adatod. Ha az állapot "learning", a forma címe pontosan "Még tanulom a ritmusod".
        Minden mutatónál a headline legfeljebb 5 szó, a sentence legfeljebb 2 rövid mondat.
        A brief 2–4 rövid mondat a napról; mindegyikhez link: "sleep" (alvásról szól), "heart"
        (pulzusról szól), "day" (a nap programjáról szól), vagy null.
        A tonightTip egy mondat az esti lefekvésről; a nextMealTip egy mondat a következő
        étkezésről, vagy null, ha ma már nincs mit mondani.
        Válaszolj KIZÁRÓLAG egyetlen JSON objektummal, pontosan ebben a formában:
        {"forma":{"headline":"...","sentence":"..."},"alvas":{"headline":"...","sentence":"..."},
         "mozgas":{"headline":"...","sentence":"..."},"fuel":{"headline":"...","sentence":"..."},
         "pulzus":{"headline":"...","sentence":"..."},
         "brief":[{"text":"...","link":"sleep"}],"tonightTip":"...","nextMealTip":"..."}""";

    private final int stepsGoal;
    private final int nightsNeeded;

    BoopPrompts(int stepsGoal) {
        this(stepsGoal, BoopScores.MIN_NIGHTS_FOR_FORMA);
    }

    BoopPrompts(int stepsGoal, int nightsNeeded) {
        this.stepsGoal = stepsGoal;
        this.nightsNeeded = nightsNeeded;
    }

    String context(BoopDay d, Scores s, LocalTime now, Conflict conflict) {
        StringBuilder b = new StringBuilder();
        b.append("[Idő] ").append(d.date()).append(' ').append(RuleVerdicts.hhmm(now)).append('\n');
        b.append("[Állapot] ").append(s.state()).append('\n');
        b.append("[Forma] ").append(score(s.forma()));
        if (s.forma() == null) {
            b.append(" (ismert éjszakák: ").append(d.nightsKnown()).append(", kell legalább ")
                .append(nightsNeeded).append(')');
        }
        b.append('\n');

        b.append("[Alvás] pontszám ").append(score(s.alvas()));
        if (d.sleep() == null) {
            b.append(", ma éjjel: ").append(NO_DATA);
        } else {
            BoopDay.Sleep n = d.sleep();
            if (n.bedtime() != null && n.wakeup() != null) {
                b.append(", ").append(n.bedtime()).append("–").append(n.wakeup());
            }
            b.append(", ").append(RuleVerdicts.duration(n.totalMin()))
                .append(" (cél ").append(RuleVerdicts.duration(d.sleepTargetMin())).append(')')
                .append(", mélyalvás ").append(n.deepMin() == null ? NO_DATA : n.deepMin() + " perc")
                .append(", szokásos mélyalvás ").append(d.baselineDeepMin() == null ? NO_DATA
                    : Math.round(d.baselineDeepMin()) + " perc")
                .append(", minőség ").append(n.quality() == null ? NO_DATA : n.quality() + "/10");
        }
        b.append('\n');

        b.append("[Pulzus] pontszám ").append(score(s.pulzus()))
            .append(", nyugalmi ma ").append(d.restingHr() == null ? NO_DATA : d.restingHr() + " bpm")
            .append(", szokásos ").append(d.baselineRestingHr() == null ? NO_DATA
                : Math.round(d.baselineRestingHr()) + " bpm")
            .append('\n');

        b.append("[Mozgás] pontszám ").append(score(s.mozgas()))
            .append(", lépés ").append(d.steps() == null ? NO_DATA : d.steps())
            .append(" / cél ").append(stepsGoal)
            .append(", tegnapi edzés ").append(d.yesterdayLoad() == null ? 0 : d.yesterdayLoad().minutes())
            .append(" perc\n");

        b.append("[Étkezés] pontszám ").append(score(s.fuel()))
            .append(", eddig ").append(d.kcalSoFar()).append(" kcal / cél ")
            .append(d.kcalTarget() <= 0 ? NO_DATA : d.kcalTarget() + " kcal")
            .append(", fehérje ").append(d.proteinG()).append(" g / cél ")
            .append(d.proteinTarget() <= 0 ? NO_DATA : d.proteinTarget() + " g")
            .append('\n');
        List<BoopDay.Meal> meals = d.meals() == null ? List.of() : d.meals();
        b.append("[Étkezések] ").append(meals.isEmpty() ? NO_DATA : meals.stream()
            .map(m -> RuleVerdicts.hhmm(m.time()) + " " + m.title() + (m.logged() ? " (megvolt)" : " (tervezett)"))
            .collect(Collectors.joining(", "))).append('\n');

        BoopDay.Session session = d.session();
        b.append("[Edzés] ").append(session == null ? "ma nincs tervezett edzés"
            : session.title() + (session.time() == null ? "" : " " + RuleVerdicts.hhmm(session.time())))
            .append('\n');
        b.append("[Naptár] ").append(calendar(d)).append('\n');
        if (conflict != null) {
            b.append("[Ütközés] ").append(conflict.text()).append('\n');
        }
        b.append("[Lefekvési cél] ").append(RuleVerdicts.hhmm(d.bedtimeTarget())).append('\n');
        if (d.recovery() != null) {
            b.append("[Kímélő mód] ").append(d.recovery().reason()).append(", ")
                .append(d.recovery().day()).append(". nap\n");
        }
        BoopDay.Intention intention = d.intention();
        if (intention != null && intention.creed() != null && !intention.creed().isBlank()) {
            b.append("[Szándék] ").append(intention.creed()).append('\n');
        }
        return b.toString();
    }

    /**
     * Count, time spans and busy density only — never an event title: the model needs when the day
     * is full, not what the meetings are about (titles are private and would also land in the LLM
     * log). The conflict itself comes from the rules.
     */
    private static String calendar(BoopDay d) {
        List<BoopDay.CalendarItem> timed = RuleVerdicts.timedEvents(d);
        if (timed.isEmpty()) {
            return "ma nincs időponthoz kötött esemény";
        }
        long busy = d.calendar().busySlots().stream().filter(Boolean::booleanValue).count();
        return timed.size() + " esemény: " + timed.stream()
            .map(e -> RuleVerdicts.hhmm(e.start()) + "–" + RuleVerdicts.hhmm(e.end()))
            .collect(Collectors.joining(", "))
            + String.format(Locale.ROOT, " (foglalt %d perc 06:00 és 24:00 között)", busy * BoopDay.SLOT_MINUTES);
    }

    private static String score(Integer v) {
        return v == null ? NO_DATA : String.format(Locale.ROOT, "%d/100", v);
    }
}

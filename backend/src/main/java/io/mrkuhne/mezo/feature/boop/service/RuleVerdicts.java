package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.BriefLine;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Conflict;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdict;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic Hungarian verdicts in Boop's voice (Boop S3, mezo-r36n9.7) — pure, no Spring. The
 * fallback of {@link BoopVerdictWriter}: always a complete schema, for every state and for null
 * scores. "No data" is said plainly; a number is only ever quoted from the day, never invented.
 *
 * <p>The session conflict lives only here (the LLM never decides it): the last timed meeting that
 * started before the session ends less than {@value #CONFLICT_GAP_MIN} minutes before the session
 * start (or is still running) → suggest the meeting end + {@value #SUGGEST_AFTER_MIN} minutes,
 * rounded UP to the next :00/:30. No session time, no meeting, or a suggestion past midnight → none.
 */
public class RuleVerdicts {

    public static final String LEARNING_HEADLINE = "Még tanulom a ritmusod";
    static final int CONFLICT_GAP_MIN = 45;
    static final int SUGGEST_AFTER_MIN = 60;
    private static final LocalTime NOON = LocalTime.NOON;
    private static final LocalTime LAST_MEAL_TIP = LocalTime.of(20, 0);

    private final int stepsGoal;
    private final int nightsNeeded;

    public RuleVerdicts(int stepsGoal) {
        this(stepsGoal, BoopScores.MIN_NIGHTS_FOR_FORMA);
    }

    public RuleVerdicts(int stepsGoal, int nightsNeeded) {
        this.stepsGoal = stepsGoal;
        this.nightsNeeded = nightsNeeded;
    }

    public Verdicts write(BoopDay d, Scores s, LocalTime now) {
        Conflict conflict = conflict(d);
        return new Verdicts(forma(d, s), alvas(d, s), mozgas(d, s, now), fuel(d, s), pulzus(d, s),
            brief(d, s, conflict), tonightTip(d, s), nextMealTip(d, now), conflict);
    }

    // --- metrics ------------------------------------------------------------------------------

    private Verdict forma(BoopDay d, Scores s) {
        if (s.forma() == null || "learning".equals(s.state())) {
            if (d.nightsKnown() < nightsNeeded) {
                String known = d.nightsKnown() <= 0 ? "Még egyetlen éjszakádat sem ismerem"
                    : "Eddig " + d.nightsKnown() + " éjszakádat ismerem";
                return new Verdict(LEARNING_HEADLINE, known + ", " + nightsNeeded
                    + " kell, hogy megbízható formát mondjak. Addig az alvásodat és a pulzusodat figyelem.");
            }
            return new Verdict(LEARNING_HEADLINE,
                "Ma éjjelről nincs alvásadatom, ezért most nem mondok formát. Ha aludtál, írd be, és újraszámolom.");
        }
        String headline = switch (s.state()) {
            case "good" -> "Jó formában vagy";
            case "okay" -> "Átlagos napod van";
            default -> "Ma kíméld magad";
        };
        if (d.recovery() != null) {
            return new Verdict(headline, "Kímélő módban vagy (" + d.recovery().reason() + ", "
                + d.recovery().day() + ". nap). Ma a pihenés a feladat, nem a teljesítmény.");
        }
        String sentence = switch (s.state()) {
            case "good" -> "Ma bírni fogod a terhelést. Nyugodtan mehetsz bele a napba.";
            case "okay" -> "Rendben vagy, de nem csúcsformában. Ma a tempót te diktáld, ne a nap.";
            default -> "A tested ma pihenést kér. Inkább könnyebben, mint sehogy.";
        };
        return new Verdict(headline, sentence);
    }

    private static Verdict alvas(BoopDay d, Scores s) {
        BoopDay.Sleep n = d.sleep();
        if (n == null) {
            return new Verdict("Nincs adat az éjszakáról",
                "Erről az éjszakáról nem kaptam alvásadatot. Ha aludtál, írd be, és számolok vele.");
        }
        if (s.alvas() == null) {
            return new Verdict(duration(n.totalMin()) + " alvás", "Alvás-célt még nem látok, ezért nem pontozom.");
        }
        String headline = s.alvas() >= 80 ? "Jól aludtál" : s.alvas() >= 60 ? "Elment az éjszaka" : "Gyenge éjszaka volt";
        String first = duration(n.totalMin()) + " aludtál, a célod " + duration(d.sleepTargetMin()) + ".";
        String second = "";
        if (n.deepMin() != null && d.baselineDeepMin() != null) {
            long base = Math.round(d.baselineDeepMin());
            second = n.deepMin() >= d.baselineDeepMin() * 0.9
                ? " A mélyalvásod (" + n.deepMin() + " perc) rendben van."
                : " Mélyalvásból kevesebb jutott, mint szokott: " + n.deepMin() + " perc a szokásos " + base + " helyett.";
        } else if (n.deepMin() != null) {
            second = " Ebből " + n.deepMin() + " perc volt mélyalvás.";
        }
        return new Verdict(headline, first + second);
    }

    private Verdict mozgas(BoopDay d, Scores s, LocalTime now) {
        if (s.mozgas() == null) {
            return new Verdict("Nincs lépéscél", "Lépéscél nélkül nem tudom megmondani, hol tartasz.");
        }
        if (d.steps() == null) {
            return new Verdict("Még nincs lépésadat", "Ma még nem jött lépésszám a telefonodról vagy az órádról.");
        }
        String where = d.steps() + " lépésnél tartasz, a cél " + stepsGoal + ".";
        if (s.mozgas() >= 100) {
            return new Verdict("Megvan a napi mozgás", where + " Szép munka!");
        }
        if (now.isBefore(NOON) && s.mozgas() < 50) {
            return new Verdict("Még korán van", where + " A nap nagy része még előtted.");
        }
        if (s.mozgas() >= 50) {
            return new Verdict("Jó úton vagy", where + " Egy séta, és meglesz.");
        }
        return new Verdict("Kevés volt ma a mozgás", where + " Egy rövid séta is sokat számít.");
    }

    private static Verdict fuel(BoopDay d, Scores s) {
        if (d.kcalTarget() <= 0) {
            return new Verdict("Nincs kalóriacél", "Kalóriacél nélkül nem tudom megmondani, hol tartasz az evéssel.");
        }
        if (s.fuel() == null) {
            String logged = d.kcalSoFar() > 0 ? " Eddig " + d.kcalSoFar() + " kcal van beírva." : "";
            return new Verdict("Még korai", "A nap elején még nem ítélem meg az evést." + logged);
        }
        String headline = s.fuel() >= 85 ? "Jó ütemben eszel"
            : s.fuel() >= 60 ? "Kicsit le vagy maradva" : "Lemaradtál az evéssel";
        String protein = d.proteinTarget() > 0
            ? " Fehérjéből " + d.proteinG() + " g, a cél " + d.proteinTarget() + " g." : "";
        return new Verdict(headline, "Eddig " + d.kcalSoFar() + " kcal, a napi cél " + d.kcalTarget() + "." + protein);
    }

    private static Verdict pulzus(BoopDay d, Scores s) {
        if (d.restingHr() == null) {
            return new Verdict("Nincs nyugalmi pulzus", "Ma még nem kaptam nyugalmi pulzust az órádtól.");
        }
        if (s.pulzus() == null || d.baselineRestingHr() == null) {
            return new Verdict(d.restingHr() + " bpm nyugalomban",
                "Még nincs elég korábbi adatom, hogy összevessem a szokásossal.");
        }
        long base = Math.round(d.baselineRestingHr());
        if (s.pulzus() >= 70) {
            return new Verdict("Nyugodt a szíved",
                "A nyugalmi pulzusod " + d.restingHr() + ", a szokásos " + base + ". Ez jó jel.");
        }
        if (s.pulzus() >= 50) {
            return new Verdict("Kicsit magasabb a pulzusod", "A nyugalmi pulzusod " + d.restingHr()
                + " a szokásos " + base + " helyett. Ma figyelj jobban a pihenésre.");
        }
        return new Verdict("Magas a nyugalmi pulzusod", "A nyugalmi pulzusod " + d.restingHr() + " a szokásos "
            + base + " helyett, ez fáradtságra vagy kezdődő betegségre utalhat. Ma ne hajtsd túl magad.");
    }

    // --- the spoken brief and the tips -------------------------------------------------------

    private static List<BriefLine> brief(BoopDay d, Scores s, Conflict conflict) {
        List<BriefLine> lines = new ArrayList<>();
        if ("learning".equals(s.state())) {
            lines.add(new BriefLine("Még tanulom a ritmusod, ezért ma formát nem mondok.", null));
        }
        if (d.sleep() == null) {
            lines.add(new BriefLine("Ma éjjelről nincs alvásadatom.", "sleep"));
        } else {
            String tail = s.alvas() == null ? "." : s.alvas() >= 80 ? ", ez jó alap a naphoz."
                : ", ez kevesebb a kelleténél.";
            lines.add(new BriefLine(duration(d.sleep().totalMin()) + " aludtál" + tail, "sleep"));
        }
        if (d.restingHr() != null) {
            String text = s.pulzus() == null ? "A nyugalmi pulzusod " + d.restingHr() + "."
                : s.pulzus() >= 70 ? "A szíved nyugodt, " + d.restingHr() + " a nyugalmi pulzusod."
                : "A nyugalmi pulzusod " + d.restingHr() + ", a szokásosnál magasabb.";
            lines.add(new BriefLine(text, "heart"));
        }
        lines.add(new BriefLine(dayLine(d, conflict), "day"));
        return List.copyOf(lines);
    }

    private static String dayLine(BoopDay d, Conflict conflict) {
        if (d.recovery() != null) {
            return "Kímélő módban vagy, ma a pihenés a feladat.";
        }
        StringBuilder b = new StringBuilder();
        BoopDay.Session session = d.session();
        if (session == null) {
            b.append("Ma nincs edzés, pihenőnap.");
        } else {
            b.append("Ma ").append(session.title()).append(" vár rád")
                .append(session.time() == null ? "" : ", " + hhmm(session.time()) + "-kor").append('.');
        }
        if (conflict != null) {
            b.append(" Az edzés túl közel esik az utolsó megbeszélésedhez.");
        } else {
            int meetings = timedEvents(d).size();
            if (meetings > 0) {
                b.append(" A naptáradban ").append(meetings).append(" esemény van.");
            }
        }
        return b.toString();
    }

    private static String tonightTip(BoopDay d, Scores s) {
        LocalTime bed = d.bedtimeTarget() == null ? LocalTime.of(23, 0) : d.bedtimeTarget();
        if ("tired".equals(s.state())) {
            return "Ma este bújj ágyba korábban, már " + hhmm(bed.minusMinutes(30)) + " körül.";
        }
        if (d.sleepTargetMin() <= 0) {
            return "Ma este " + hhmm(bed) + " körül bújj ágyba.";
        }
        return "Ma este " + hhmm(bed) + " körül bújj ágyba, hogy meglegyen a " + duration(d.sleepTargetMin()) + " alvás.";
    }

    private static String nextMealTip(BoopDay d, LocalTime now) {
        int gap = d.proteinTarget() > 0 ? d.proteinTarget() - d.proteinG() : 0;
        String protein = gap > 0 ? " Még " + gap + " g fehérje hiányzik a mai célból." : "";
        BoopDay.Meal next = (d.meals() == null ? List.<BoopDay.Meal>of() : d.meals()).stream()
            .filter(m -> !m.logged() && m.time() != null && !m.time().isBefore(now))
            .min(Comparator.comparing(BoopDay.Meal::time))
            .orElse(null);
        if (next != null) {
            return "Következik: " + next.title() + ", " + hhmm(next.time()) + "." + protein;
        }
        if (gap > 0 && now.isBefore(LAST_MEAL_TIP)) {
            return "Még " + gap + " g fehérje hiányzik ma, a következő étkezésnél figyelj rá.";
        }
        return null;
    }

    // --- conflict ------------------------------------------------------------------------------

    static Conflict conflict(BoopDay d) {
        LocalTime start = d.session() == null ? null : d.session().time();
        if (start == null) {
            return null;
        }
        BoopDay.CalendarItem last = timedEvents(d).stream()
            .filter(e -> e.start().isBefore(start))
            .max(Comparator.comparing(BoopDay.CalendarItem::end))
            .orElse(null);
        if (last == null || Duration.between(last.end(), start).toMinutes() >= CONFLICT_GAP_MIN) {
            return null;
        }
        int minute = last.end().toSecondOfDay() / 60 + SUGGEST_AFTER_MIN;
        int rounded = (minute + 29) / 30 * 30;
        if (rounded >= 24 * 60) {
            return null;
        }
        String suggested = hhmm(LocalTime.of(rounded / 60, rounded % 60));
        return new Conflict("Az edzés " + hhmm(start) + "-kor kezdődik, de az utolsó megbeszélésed csak "
            + hhmm(last.end()) + "-kor ér véget. Mit szólnál, ha " + suggested + "-kor kezdenéd?", suggested);
    }

    /** Timed, same-day events (all-day and overnight ones excluded). */
    static List<BoopDay.CalendarItem> timedEvents(BoopDay d) {
        if (d.calendar() == null || d.calendar().events() == null) {
            return List.of();
        }
        return d.calendar().events().stream()
            .filter(e -> !e.allDay() && e.start() != null && e.end() != null && !e.end().isBefore(e.start()))
            .sorted(Comparator.comparing(BoopDay.CalendarItem::start))
            .toList();
    }

    // --- formatting ----------------------------------------------------------------------------

    static String hhmm(LocalTime t) {
        return t == null ? "" : String.format(Locale.ROOT, "%02d:%02d", t.getHour(), t.getMinute());
    }

    /** "7 óra 30 perc", "8 óra", "45 perc". */
    static String duration(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        if (h == 0) {
            return m + " perc";
        }
        return m == 0 ? h + " óra" : h + " óra " + m + " perc";
    }
}

package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * The deterministic "Ehhez ezt kell tenned" checklist of a season preview (spec §5.3) — pure rules over the diff of
 * the before / after numbers and drafts, copy verbatim from the approved spike. Order is fixed: food, sleep, block,
 * length, sport, the running menu week.
 */
public final class SeasonTodoRules {

    /** A kcal change smaller than this on a training day is not worth a line. */
    static final int KCAL_STEP = 40;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MMM d.", Locale.forLanguageTag("hu"));
    /** "Hétfőtől" .. "Vasárnaptól" (0 = hétfő). */
    private static final String[] FROM_DAY = {
        "Hétfőtől", "Keddtől", "Szerdától", "Csütörtöktől", "Péntektől", "Szombattól", "Vasárnaptól"};

    public record Todo(String key, String title, String body) {
    }

    private SeasonTodoRules() {
    }

    /**
     * @param refitFromDow the first weekday (0 = hétfő) of an approved, running menu week that a kcal change would
     *                     re-fit, or {@code null} when no approved menu week is running (always null before S3)
     */
    public static List<Todo> todo(SeasonNumbersJson before, SeasonNumbersJson after,
                                  SeasonDraftJson from, SeasonDraftJson to, Integer refitFromDow) {
        List<Todo> out = new ArrayList<>();
        int kcalDiff = after.trainDayKcal() - before.trainDayKcal();
        if (kcalDiff >= KCAL_STEP) {
            out.add(new Todo("more_food", "Több étel edzésnapon",
                "Edzésnapokon kapsz egy plusz uzsonnát (kb. +%d kcal), és a bevásárlólista is frissül.".formatted(kcalDiff)));
        }
        if (kcalDiff <= -KCAL_STEP) {
            out.add(new Todo("less_food", "Kisebb adagok",
                "Edzésnapon kb. %d kcal-lal kisebbek lesznek az adagok.".formatted(-kcalDiff)));
        }
        if (after.sleepNeedMin() > before.sleepNeedMin()) {
            out.add(new Todo("earlier_bed", "Korábbi lefekvés",
                "%s körül feküdj le. Az esti emlékeztetőt is ehhez igazítom.".formatted(after.bedtime())));
        }
        int gymTo = to.gymDaysOrEmpty().size();
        if (gymTo != from.gymDaysOrEmpty().size()) {
            out.add(new Todo("block", "Az edzésblokk",
                "A blokkot át kell tenni heti %d napra. Az Edzés → Blokk részben megmutatom a javaslatot, és te döntesz."
                    .formatted(gymTo)));
        }
        if (before.weeksToTarget() != null && after.weeksToTarget() != null
            && !before.weeksToTarget().equals(after.weeksToTarget()) && after.targetDate() != null) {
            out.add(new Todo("length", "Az évad hossza", "Az évad %s lesz, a célt %s körül éred el.".formatted(
                after.weeksToTarget() > before.weeksToTarget() ? "hosszabb" : "rövidebb", DAY.format(after.targetDate()))));
        }
        if (!sportKeys(from).equals(sportKeys(to))) {
            out.add(new Todo("sport", "Sportnapok",
                "Sportnap reggelén több szénhidrát lesz a menüben, és a pihenőnapok is máshova kerülnek."));
        }
        boolean kcalMoved = kcalDiff != 0 || !Objects.equals(before.restDayKcal(), after.restDayKcal());
        if (refitFromDow != null && kcalMoved && refitFromDow >= 0 && refitFromDow <= 6) {
            out.add(new Todo("refit_week", "A hét hátralévő napjai",
                "%s vasárnapig igazodnak az adagok; a bevásárlólistán egy rövid »változott« rész jelenik meg."
                    .formatted(FROM_DAY[refitFromDow])));
        }
        return out;
    }

    private static Set<String> sportKeys(SeasonDraftJson d) {
        Set<String> keys = new HashSet<>();
        d.sportOrEmpty().forEach(s -> keys.add(s.dayOfWeek() + "|" + s.sport()));
        return keys;
    }
}

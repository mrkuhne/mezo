package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Emberek S6 (mezo-06o0.8): a hangulat-ív, az irány és a magyar indoklás egyetlen forrása.
 *
 * <p>Az S1 óta létező {@code person.affect_trend} oszlopot SEMMI nem töltötte — „AI-kurált"-ként
 * vezettük be, de kurátor sosem lett. Éles adaton tehát minden ív üres volt, és vele együtt
 * halott a hub hangulat-lejtő cellája és a Heti kép irány-mozaikja. Az S4 óta viszont az éjszakai
 * kör tónust ÉS intenzitást ír a mentionökre, tehát az ív végre becsületesen SZÁMÍTHATÓ. Ez az
 * osztály ezt teszi, a {@code mentionCount}/{@code mentionsThisWeek} bevált idiómája szerint:
 * mention-származtatott statisztika, a service számolja, sosem perzisztáljuk.
 *
 * <p>Tiszta és állapotmentes — {@code today} paraméter, sosem {@code LocalDate.now()} —, hogy
 * unit-tesztelhető legyen és ne váljon naptárforduló-bombává.
 *
 * <p><b>Az üres hét nem kap kitalált pontot.</b> Csak azok a hetek adnak olvasatot, ahol volt
 * legalább egy tónusozott említés; az ív tehát lehet „hézagos" a naptárhoz képest. Ezért utazik
 * vele a {@link PersonAffectTrend#startWeek()} — enélkül a felület nem tudná, milyen időablakot
 * címkézzen (egy „az olvasatok száma × 1 hét" becslés hézagos ívnél hazudna).
 */
@Service
public class PersonAffectTrendCalculator {

    /** A prototípus nyolc oszlopos sparkja — ennyi legutóbbi heti olvasatot mutatunk. */
    static final int MAX_READINGS = 8;
    /** Ennyi olvasat alatt nincs értelmes irány (két pontból még zaj). */
    static final int MIN_READINGS_FOR_DIRECTION = 3;
    /** Hiányzó intenzitás = a skála közepe (az S4 előtti sorok és a chip-es logolás). */
    private static final int DEFAULT_INTENSITY = 2;
    /** Ekkora eltérés alatt az irány lapos — ugyanaz a küszöb, amit az FE `directionFor` használt. */
    private static final double FLAT_BAND = 0.4;

    /** Tónus → előjel a 3-as középvonalhoz képest. A `mixed` fél lépéssel lefelé: vegyes hét
     *  rosszabb, mint egy semleges, de nem annyi, mint egy tisztán nehéz. */
    private static double toneSign(String tone) {
        return switch (tone == null ? "" : tone) {
            case "positive" -> 1.0;
            case "negative" -> -1.0;
            case "mixed" -> -0.5;
            default -> 0.0;      // neutral és minden ismeretlen: a középvonal
        };
    }

    /**
     * @param personMentions EGY személy említései, tetszőleges sorrendben (a hívó szűr személyre)
     * @param today          a mai nap; a heti kosarak ennek a hetének hétfőjéig futnak
     */
    public PersonAffectTrend calculate(List<MentionEntity> personMentions, LocalDate today) {
        LocalDate thisMonday = monday(today);
        // Hétfő -> (pontösszeg, darab). LinkedHashMap + rendezett beszúrás helyett rendezzük a
        // kulcsokat a végén: a bemenet sorrendje nem garantált.
        Map<LocalDate, double[]> byWeek = new LinkedHashMap<>();
        for (MentionEntity m : personMentions) {
            if (m.getTone() == null || m.getTs() == null) {
                continue;   // az éjszakai kör még nem töltötte — nem olvasat, nem is nulla
            }
            LocalDate week = monday(LocalDate.ofInstant(m.getTs(), ZoneOffset.UTC));
            if (week.isAfter(thisMonday)) {
                // Ez az őrfeltétel csak akkor helyes, ha a host zónája >= UTC: a hívó
                // (PeopleService) `today`-t a host zónájából veszi (LocalDate.now()), a
                // heti kosarak viszont UTC-ben épülnek — negatív offsetű hostnál `today` UTC
                // szerint még "tegnap" lehet, és egy ma UTC-ben rögzített mention tévesen
                // jövőbelinek tűnne.
                continue;   // jövőbeli időbélyeg (mis-seed) sosem tol ki az ablakból
            }
            int intensity = m.getIntensity() == null ? DEFAULT_INTENSITY : m.getIntensity();
            double score = 3.0 + toneSign(m.getTone()) * intensity * (2.0 / 3.0);
            double[] acc = byWeek.computeIfAbsent(week, k -> new double[2]);
            acc[0] += score;
            acc[1] += 1;
        }
        if (byWeek.isEmpty()) {
            return PersonAffectTrend.EMPTY;
        }
        List<LocalDate> weeks = new ArrayList<>(byWeek.keySet());
        weeks.sort(LocalDate::compareTo);
        if (weeks.size() > MAX_READINGS) {
            weeks = weeks.subList(weeks.size() - MAX_READINGS, weeks.size());   // a legfrissebbek
        }
        List<Integer> readings = new ArrayList<>(weeks.size());
        for (LocalDate week : weeks) {
            double[] acc = byWeek.get(week);
            long rounded = Math.round(acc[0] / acc[1]);
            readings.add((int) Math.max(1, Math.min(5, rounded)));
        }
        String direction = directionOf(readings);
        return new PersonAffectTrend(List.copyOf(readings), weeks.getFirst(), direction,
            reasonFor(direction, readings));
    }

    private static LocalDate monday(LocalDate day) {
        return day.with(DayOfWeek.MONDAY);
    }

    /** Az utolsó két olvasat átlaga a korábbiakéhoz képest — az FE `directionFor` szabálya,
     *  szerver-oldalra hozva, hogy egyetlen forrás legyen belőle. */
    private static String directionOf(List<Integer> readings) {
        if (readings.size() < MIN_READINGS_FOR_DIRECTION) {
            return PersonAffectTrend.DIRECTION_FLAT;
        }
        List<Integer> last2 = readings.subList(readings.size() - 2, readings.size());
        List<Integer> earlier = readings.subList(0, readings.size() - 2);
        double diff = average(last2) - average(earlier);
        if (Math.abs(diff) < FLAT_BAND) {
            return PersonAffectTrend.DIRECTION_FLAT;
        }
        return diff > 0 ? PersonAffectTrend.DIRECTION_UP : PersonAffectTrend.DIRECTION_DOWN;
    }

    private static double average(List<Integer> values) {
        return values.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    /** Determinisztikus magyar indoklás — az irány MIÉRTJE, kitalálás nélkül. */
    private static String reasonFor(String direction, List<Integer> readings) {
        return switch (direction) {
            case PersonAffectTrend.DIRECTION_UP -> "jobb hetek, mint korábban";
            case PersonAffectTrend.DIRECTION_DOWN -> "többször nehéz tónus, mint korábban";
            default -> readings.size() < MIN_READINGS_FOR_DIRECTION
                ? "még kevés hét az irányhoz"
                : "kiegyensúlyozott hetek";
        };
    }
}

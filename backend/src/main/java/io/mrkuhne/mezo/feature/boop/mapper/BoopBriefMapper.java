package io.mrkuhne.mezo.feature.boop.mapper;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.BoopBriefLine;
import io.mrkuhne.mezo.api.dto.BoopCheckin;
import io.mrkuhne.mezo.api.dto.BoopConflict;
import io.mrkuhne.mezo.api.dto.BoopEnergy;
import io.mrkuhne.mezo.api.dto.BoopMetric;
import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.BriefLine;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Conflict;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdict;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Boop brief → wire (Boop S3, mezo-r36n9.7). The day sheet ({@code BoopDay} record → the
 * {@code BoopDay} DTO) is mapped by MapStruct; the top-level brief and the five metric cards are
 * assembled in default methods because they join three sources (the day, the scores, the words).
 *
 * <p>Metric cards: {@code score} is the {@link Scores} value; {@code display} is never empty ("–"
 * when there is no data); {@code trendUp} is the DIRECTION of the number against its 14-day
 * baseline (deep sleep for Alvás, resting HR for Pulzus) — true = above baseline, not "better" —
 * and null where there is no baseline.
 */
@Mapper(componentModel = "spring")
public interface BoopBriefMapper {

    String NO_DATA = "–";
    DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    /** The brief itself; {@code hourly} is the raw model curve (clamped to 0..1 here). */
    default BoopBrief toBrief(BoopDay d, Scores s, Verdicts v, double[] hourly, int stepsGoal, int nightsNeeded,
                              Instant generatedAt) {
        BoopBrief b = new BoopBrief();
        b.setDate(d.date().toString());
        b.setGeneratedAt(generatedAt.atOffset(ZoneOffset.UTC));
        b.setState(BoopBrief.StateEnum.fromValue(s.state()));
        b.setNightsKnown(d.nightsKnown());
        b.setMetrics(metrics(d, s, v, stepsGoal, nightsNeeded));
        b.setBrief(v.brief().stream().map(this::briefLine).toList());
        b.setEnergy(energy(hourly));
        b.setTonightTip(v.tonightTip());
        b.setNextMealTip(v.nextMealTip());
        b.setConflict(conflict(v.conflict()));
        b.setDay(toDay(d, stepsGoal));
        return b;
    }

    @Mapping(target = "steps", source = "day.steps", defaultValue = "0")
    @Mapping(target = "activeKcal", source = "day.activeKcal", defaultValue = "0")
    @Mapping(target = "stepsGoal", source = "stepsGoal")
    io.mrkuhne.mezo.api.dto.BoopDay toDay(BoopDay day, int stepsGoal);

    default List<BoopMetric> metrics(BoopDay d, Scores s, Verdicts v, int stepsGoal, int nightsNeeded) {
        List<BoopMetric> out = new ArrayList<>(5);
        boolean learningNights = s.forma() == null && d.nightsKnown() < nightsNeeded;
        out.add(metric(BoopMetric.KeyEnum.FORMA, s.forma(), s.forma() == null ? NO_DATA : String.valueOf(s.forma()),
            learningNights ? d.nightsKnown() + "/" + nightsNeeded + " éjszaka" : null, null, v.forma()));

        BoopDay.Sleep sleep = d.sleep();
        out.add(metric(BoopMetric.KeyEnum.ALVAS, s.alvas(),
            sleep == null ? NO_DATA : (sleep.totalMin() / 60) + "ó " + (sleep.totalMin() % 60) + "p",
            sleep == null || sleep.deepMin() == null ? null : "mély alvás " + sleep.deepMin() + " p",
            sleep == null ? null : above(sleep.deepMin(), d.baselineDeepMin()), v.alvas()));

        out.add(metric(BoopMetric.KeyEnum.MOZGAS, s.mozgas(),
            d.steps() == null ? NO_DATA : grouped(d.steps()),
            "lépés · cél " + grouped(stepsGoal), null, v.mozgas()));

        out.add(metric(BoopMetric.KeyEnum.FUEL, s.fuel(), grouped(d.kcalSoFar()) + " kcal",
            d.kcalTarget() > 0 ? "cél " + grouped(d.kcalTarget()) + " kcal" : null, null, v.fuel()));

        out.add(metric(BoopMetric.KeyEnum.PULZUS, s.pulzus(),
            d.restingHr() == null ? NO_DATA : d.restingHr() + " bpm",
            d.restingHr() == null ? null : "nyugalmi pulzus",
            above(d.restingHr(), d.baselineRestingHr()), v.pulzus()));
        return out;
    }

    default BoopEnergy energy(double[] hourly) {
        BoopEnergy e = new BoopEnergy();
        List<Double> values = new ArrayList<>(hourly.length);
        Integer dipHour = null;
        double dip = Double.MAX_VALUE;
        for (int i = 0; i < hourly.length; i++) {
            double v = Math.round(Math.max(0, Math.min(1, hourly[i])) * 1000) / 1000.0;
            values.add(v);
            int hour = 6 + i;
            // The afternoon dip: the lowest point between noon and 18:00.
            if (hour >= 12 && hour <= 18 && v < dip) {
                dip = v;
                dipHour = hour;
            }
        }
        e.setHourly(values);
        e.setDipHour(dipHour);
        return e;
    }

    default BoopBriefLine briefLine(BriefLine l) {
        BoopBriefLine out = new BoopBriefLine();
        out.setText(l.text());
        out.setLink(l.link() == null ? null : BoopBriefLine.LinkEnum.fromValue(l.link()));
        return out;
    }

    default BoopConflict conflict(Conflict c) {
        if (c == null) {
            return null;
        }
        BoopConflict out = new BoopConflict();
        out.setText(c.text());
        out.setSuggestedTime(c.suggestedTime());
        return out;
    }

    default BoopCheckin.SlotEnum slot(String slot) {
        return slot == null ? null : BoopCheckin.SlotEnum.fromValue(slot);
    }

    default String hhmm(LocalTime t) {
        return t == null ? null : t.format(HH_MM);
    }

    private static BoopMetric metric(BoopMetric.KeyEnum key, Integer score, String display, String caption,
                                     Boolean trendUp, Verdict verdict) {
        BoopMetric m = new BoopMetric();
        m.setKey(key);
        m.setScore(score);
        m.setDisplay(display);
        m.setCaption(caption);
        m.setTrendUp(trendUp);
        m.setHeadline(verdict.headline());
        m.setSentence(verdict.sentence());
        return m;
    }

    private static Boolean above(Integer value, Double baseline) {
        return value == null || baseline == null ? null : value > baseline;
    }

    /** 9000 → "9 000" (Hungarian thousands grouping with a no-break space). */
    private static String grouped(int n) {
        String digits = String.valueOf(Math.abs(n));
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                b.append(' ');
            }
            b.append(digits.charAt(i));
        }
        return n < 0 ? "-" + b : b.toString();
    }
}

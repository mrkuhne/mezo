package io.mrkuhne.mezo.feature.companion.service;

/**
 * The per-day scalar metrics the V3.1 pattern engine can correlate. Extractors live in
 * {@link MetricSeriesService}; the pair catalog ({@code mezo.companion.patterns.pairs}) wires
 * pairs of these — config can trim/re-lag pairs without code, new metrics need a new enum entry.
 * {@code sourceHu} + {@code domain} a Motor tab UI-mezői (mezo-18bx): honnan jön az adat, és
 * melyik élet-doménhez tartozik a metrika.
 */
public enum MetricKey {

    SLEEP_QUALITY("alvásminőség", "Alvás-napló", MetricDomain.SLEEP),
    SLEEP_DURATION_H("alváshossz", "Alvás-napló", MetricDomain.SLEEP),
    TRAINING_RPE("edzés-RPE", "Sport- és futás-napló (RPE)", MetricDomain.TRAIN),
    SPORT_LOAD_MIN("sportterhelés", "Sport-napló (perc)", MetricDomain.TRAIN),
    GYM_VOLUME_KG("gym-volumen", "Workout szettek (súly×ism.)", MetricDomain.TRAIN),
    LATE_MEAL_HOUR("utolsó étkezés ideje", "Étkezés-napló (utolsó étkezés)", MetricDomain.FUEL,
            MetricValueKind.CLOCK_HOUR),
    DAILY_KCAL("napi kalória", "Étkezés-napló", MetricDomain.FUEL),
    MEDICATION_CYCLE_DAY("Gyógyszer-ciklusnap", "Gyógyszer-napló", MetricDomain.FUEL),
    DAILY_WATER_ML("vízbevitel", "Víz-számláló", MetricDomain.FUEL),
    WEIGHT_DELTA_KG("reggeli súlyváltozás", "Reggeli mérlegelés", MetricDomain.BODY),
    CHECKIN_STRESS("stressz-szint", "Check-in sheet", MetricDomain.MIND),
    CHECKIN_ENERGY("energia-szint", "Check-in sheet", MetricDomain.MIND),
    GYM_WORKLOAD("gym-terhelésérzet", "Set debrief a workoutban", MetricDomain.TRAIN),
    GYM_JOINT_PAIN("ízületi fájdalom", "Set debrief a workoutban", MetricDomain.TRAIN),
    CHECKIN_BODY("testérzet", "Check-in sheet", MetricDomain.BODY),
    CHECKIN_MENTAL("mentális állapot", "Check-in sheet", MetricDomain.MIND),
    BEDTIME_HOUR("lefekvés ideje", "Alvás-napló", MetricDomain.SLEEP, MetricValueKind.CLOCK_HOUR),
    WAKEUP_HOUR("ébredés ideje", "Alvás-napló", MetricDomain.SLEEP, MetricValueKind.CLOCK_HOUR),
    SLEEP_AWAKENINGS("éjszakai ébredések", "Alvás-napló", MetricDomain.SLEEP),
    DAILY_PROTEIN_G("napi fehérje", "Étkezés-napló", MetricDomain.FUEL),
    MEAL_SCORE("étkezés-pontszám", "Étkezés-pontozó", MetricDomain.FUEL),
    MEDICATION_DOSE_MG("Gyógyszer-dózis", "Gyógyszer-napló", MetricDomain.FUEL),
    HABITS_DONE("kész szokások", "Szokás-követő", MetricDomain.MIND),
    RITUAL_CLOSED("esti lezárás", "Esti lezárás rituálé", MetricDomain.MIND, MetricValueKind.BINARY),
    DAILY_XP("napi XP", "Activity + szokás + küldetés XP", MetricDomain.MIND),
    SOCIAL_MENTIONS("társas említések", "People-említések", MetricDomain.MIND),
    RUN_HR_RECOVERY_S("pulzus-visszaállás", "Futás-napló (pulzus-visszaállás)", MetricDomain.TRAIN),
    WEEKEND("hétvége", "naptár (származtatott)", MetricDomain.OTHER, MetricValueKind.BINARY),
    ACWR("akut:krónikus terhelés", "származtatott: sport + gym terhelésből", MetricDomain.TRAIN),
    TRAINING_MONOTONY("edzés-monotónia", "származtatott: a napi terhelés szórásából", MetricDomain.TRAIN),
    BEDTIME_VARIABILITY("lefekvés-szórás", "származtatott: a lefekvési időkből", MetricDomain.SLEEP),
    SHOULDER_STRAIN("váll-terhelés", "Sport-napló (shoulder strain csúcs)", MetricDomain.TRAIN),
    WEIGHT_TREND_PCT_WK("súlytrend %/hét", "származtatott: 7 napos súly-regresszió", MetricDomain.BODY),
    COMBINED_LOAD_MIN("kombinált terhelés", "származtatott: sport-perc + gym perc-ekvivalens", MetricDomain.TRAIN);

    private final String labelHu;
    private final String sourceHu;
    private final MetricDomain domain;
    private final MetricValueKind valueKind;

    MetricKey(String labelHu, String sourceHu, MetricDomain domain) {
        this(labelHu, sourceHu, domain, MetricValueKind.NUMBER);
    }

    MetricKey(String labelHu, String sourceHu, MetricDomain domain, MetricValueKind valueKind) {
        this.labelHu = labelHu;
        this.sourceHu = sourceHu;
        this.domain = domain;
        this.valueKind = valueKind;
    }

    public String labelHu() {
        return labelHu;
    }

    /** Honnan jön az adat — gyűjtő-felület vagy derivált-magyarázat (Motor tab, mezo-18bx). */
    public String sourceHu() {
        return sourceHu;
    }

    public MetricDomain domain() {
        return domain;
    }

    public MetricValueKind valueKind() {
        return valueKind;
    }

    /**
     * A wire/config kulcs (kebab-case), pl. {@code SLEEP_DURATION_H → "sleep-duration-h"} —
     * pontosan az, amit a {@code mezo.companion.patterns.pairs} katalógus is használ.
     */
    public String wireKey() {
        return name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
}

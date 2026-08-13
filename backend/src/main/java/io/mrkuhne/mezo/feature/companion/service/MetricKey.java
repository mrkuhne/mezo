package io.mrkuhne.mezo.feature.companion.service;

/**
 * The per-day scalar metrics the V3.1 pattern engine can correlate. Extractors live in
 * {@link MetricSeriesService}; the pair catalog ({@code mezo.companion.patterns.pairs}) wires
 * pairs of these — config can trim/re-lag pairs without code, new metrics need a new enum entry.
 */
public enum MetricKey {

    SLEEP_QUALITY("alvásminőség"),
    SLEEP_DURATION_H("alváshossz"),
    TRAINING_RPE("edzés-RPE"),
    SPORT_LOAD_MIN("sportterhelés"),
    GYM_VOLUME_KG("gym-volumen"),
    LATE_MEAL_HOUR("utolsó étkezés ideje"),
    DAILY_KCAL("napi kalória"),
    RETA_CYCLE_DAY("Reta-ciklusnap"),
    DAILY_WATER_ML("vízbevitel"),
    WEIGHT_DELTA_KG("reggeli súlyváltozás"),
    CHECKIN_STRESS("stressz-szint"),
    CHECKIN_ENERGY("energia-szint"),
    GYM_WORKLOAD("gym-terhelésérzet"),
    GYM_JOINT_PAIN("ízületi fájdalom"),
    CHECKIN_BODY("testérzet"),
    CHECKIN_MENTAL("mentális állapot"),
    BEDTIME_HOUR("lefekvés ideje"),
    WAKEUP_HOUR("ébredés ideje"),
    SLEEP_AWAKENINGS("éjszakai ébredések");

    private final String labelHu;

    MetricKey(String labelHu) {
        this.labelHu = labelHu;
    }

    public String labelHu() {
        return labelHu;
    }

    /**
     * A wire/config kulcs (kebab-case), pl. {@code SLEEP_DURATION_H → "sleep-duration-h"} —
     * pontosan az, amit a {@code mezo.companion.patterns.pairs} katalógus is használ.
     */
    public String wireKey() {
        return name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
}

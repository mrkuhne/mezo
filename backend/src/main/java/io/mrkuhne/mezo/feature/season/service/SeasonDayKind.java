package io.mrkuhne.mezo.feature.season.service;

/**
 * What a day of the season carries (mezo-r36n9.131): a training session (a gym slot or a block run), a sport
 * session, both, or neither. The keys are the wire values ({@code SeasonAdherenceDay.dayKind}) and the menu
 * planner's day kinds; a day with both is one day with <b>two</b> sessions, never one.
 */
public enum SeasonDayKind {
    TRAINING("edzesnap", "edzésnap"),
    SPORT("sport", "sportnap"),
    TRAINING_SPORT("edzes_sport", "edzés + sport nap"),
    REST("pihenonap", "pihenőnap");

    private final String key;
    private final String labelHu;

    SeasonDayKind(String key, String labelHu) {
        this.key = key;
        this.labelHu = labelHu;
    }

    public static SeasonDayKind of(boolean training, boolean sport) {
        if (training && sport) {
            return TRAINING_SPORT;
        }
        return training ? TRAINING : sport ? SPORT : REST;
    }

    public String key() {
        return key;
    }

    public String labelHu() {
        return labelHu;
    }
}

package io.mrkuhne.mezo.feature.capacity.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop B7 K1 day-capacity tunables (mezo-r36n9.17), {@code mezo.capacity.*}.
 *
 * @param enabled          master switch
 * @param verdict          day-load thresholds (load / capacity ratio) for the verdict words
 * @param headroom         share of the capacity a day may be planned to
 * @param sequenceFactor   multiplier of back-to-back event load
 * @param sequenceBlockMin minutes of back-to-back events that count as one sequence block
 * @param gapCreditMin     minutes of gap between events that earn recovery credit
 * @param learning         when the owner's own labels start to count
 * @param proposals        proposal limits
 * @param live             live recompute throttle
 * @param sunday           the Sunday week-proposal job
 * @param notesMaxChars    calendar notes characters sent to the scoring model
 */
@Validated
@ConfigurationProperties(prefix = "mezo.capacity")
public record CapacityProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue Verdict verdict,
        @DefaultValue("1.25") double headroom,
        @DefaultValue("1.3") double sequenceFactor,
        @DefaultValue("90") int sequenceBlockMin,
        @DefaultValue("15") int gapCreditMin,
        @DefaultValue Learning learning,
        @DefaultValue Proposals proposals,
        @DefaultValue Live live,
        @DefaultValue Sunday sunday,
        @DefaultValue("2000") int notesMaxChars) {

    public record Verdict(@DefaultValue("0.6") double laza,
                          @DefaultValue("0.9") double rendben,
                          @DefaultValue("1.0") double szoros) {
    }

    public record Learning(@DefaultValue("14") int minDays, @DefaultValue("5") int minLabels) {
    }

    public record Proposals(@DefaultValue("5") int maxPerWeek) {
    }

    public record Live(@DefaultValue("PT3H") Duration minInterval) {
    }

    public record Sunday(@DefaultValue("0 0 18 * * SUN") String cron) {
    }
}

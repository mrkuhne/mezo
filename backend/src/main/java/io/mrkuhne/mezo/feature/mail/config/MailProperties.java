package io.mrkuhne.mezo.feature.mail.config;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop Levél (the morning post) tunables (mezo-r36n9.38).
 *
 * @param secretKey                 base64 of the 32-byte AES key sealing the mailbox app password; validated by
 *                                  {@code MailCredentialCipher} at startup. Never logged.
 * @param cron                      when the post runs (08:00 and 15:00).
 * @param zone                      the cron's zone and the "day" of the LLM cap.
 * @param dailyUsdCap               mail LLM spend cap per Budapest day (about 3 EUR a month).
 * @param dealWorthThreshold        a deal scoring at least this is shown as worth a minute.
 * @param notifyThreshold           a deal scoring at least this and expiring in the window notifies.
 * @param notifyWindowHours         the expiry window of a notification.
 * @param silentAfterNopes          consecutive "nem érdekel" before a silent-sender proposal.
 * @param feedbackHalfLifeDays      half-life of a feedback signal.
 * @param fewShotExamples           feedback examples sent to the model at most.
 * @param bodyMaxChars              body cap before the model (about 1 500 tokens).
 * @param rawRetentionDays          raw bodies older than this are purged.
 * @param manualRunCooldownMinutes  one manual run per this many minutes.
 * @param imapHost                  the IMAPS server (Gmail); the IT points it at GreenMail.
 * @param imapPort                  the IMAPS port.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.mail")
public record MailProperties(
        @NotBlank String secretKey,
        @DefaultValue("0 0 8,15 * * *") @NotBlank String cron,
        @DefaultValue("Europe/Budapest") @NotBlank String zone,
        @DefaultValue("0.15") @DecimalMin("0.0") double dailyUsdCap,
        @DefaultValue("7") @Min(0) @Max(10) int dealWorthThreshold,
        @DefaultValue("8") @Min(0) @Max(10) int notifyThreshold,
        @DefaultValue("36") @Min(1) @Max(720) int notifyWindowHours,
        @DefaultValue("3") @Min(1) @Max(50) int silentAfterNopes,
        @DefaultValue("90") @Min(1) @Max(3650) int feedbackHalfLifeDays,
        @DefaultValue("8") @Min(0) @Max(50) int fewShotExamples,
        @DefaultValue("6000") @Min(500) @Max(100_000) int bodyMaxChars,
        @DefaultValue("30") @Min(1) @Max(365) int rawRetentionDays,
        @DefaultValue("10") @Min(0) @Max(1_440) int manualRunCooldownMinutes,
        @DefaultValue("imap.gmail.com") @NotBlank String imapHost,
        @DefaultValue("993") @Min(1) @Max(65_535) int imapPort) {

    @Override
    public String toString() {
        return "MailProperties[secretKey=***, cron=" + cron + ", zone=" + zone + "]";
    }
}

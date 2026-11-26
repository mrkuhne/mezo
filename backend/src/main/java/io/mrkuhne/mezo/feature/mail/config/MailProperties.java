package io.mrkuhne.mezo.feature.mail.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
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
 *                                  {@code MailCredentialCipher} at startup (blank fails an enabled mail feature;
 *                                  it stays blank, and unused, while the feature is off). Never logged.
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
 * @param google                    Sign in with Google (spec §12): the public iOS client id and the Google endpoints.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.mail")
public record MailProperties(
        String secretKey,
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
        @DefaultValue("993") @Min(1) @Max(65_535) int imapPort,
        @DefaultValue @Valid Google google) {

    /**
     * Sign in with Google to the owner's own Gmail (mezo-r36n9.38, spec §12). The client id is PUBLIC (an iOS OAuth
     * client has no secret) and may be blank while it is not set up. The three URLs are fixed to the two Google hosts
     * in production; only a test points them at a local stub.
     *
     * @param clientId    the iOS OAuth client id ({@code <number>-<hash>.apps.googleusercontent.com}); blank = off.
     * @param redirectUri optional override of the redirect the phone must send; blank = derived from the client id.
     * @param tokenUrl    the token endpoint (exchange and refresh).
     * @param revokeUrl   the revoke endpoint.
     * @param apiUrl      the Gmail REST base ({@code .../gmail/v1}).
     */
    public record Google(
            String clientId,
            String redirectUri,
            @DefaultValue("https://oauth2.googleapis.com/token") @NotBlank String tokenUrl,
            @DefaultValue("https://oauth2.googleapis.com/revoke") @NotBlank String revokeUrl,
            @DefaultValue("https://gmail.googleapis.com/gmail/v1") @NotBlank String apiUrl) {

        private static final String ID_SUFFIX = ".apps.googleusercontent.com";
        private static final String OAUTH_HOST = "oauth2.googleapis.com";
        private static final String API_HOST = "gmail.googleapis.com";

        /** Normalised once: the client id and the redirect override are trimmed; blank becomes null. */
        public Google {
            clientId = clientId == null || clientId.isBlank() ? null : clientId.strip();
            redirectUri = redirectUri == null || redirectUri.isBlank() ? null : redirectUri.strip();
        }

        /**
         * The outbound allow-list (spec §12.2): the three endpoints must be https on the two Google hosts, unless the
         * host is loopback (a test stub). Fails the startup of an enabled mail feature otherwise.
         */
        @AssertTrue(message = "mezo.mail.google endpoints must be https on oauth2.googleapis.com / gmail.googleapis.com")
        public boolean isEndpointsAllowed() {
            return allowed(tokenUrl, OAUTH_HOST) && allowed(revokeUrl, OAUTH_HOST) && allowed(apiUrl, API_HOST);
        }

        private static boolean allowed(String url, String host) {
            try {
                java.net.URI u = java.net.URI.create(url);
                String h = u.getHost();
                if (h == null) {
                    return false;
                }
                if ("localhost".equals(h) || "127.0.0.1".equals(h) || "[::1]".equals(h)) {
                    return true;
                }
                return "https".equals(u.getScheme()) && host.equals(h) && u.getUserInfo() == null;
            } catch (IllegalArgumentException e) {
                return false;
            }
        }

        /** Production endpoints with the given client id (null/blank = not configured). */
        public static Google of(String clientId) {
            return new Google(clientId, null, "https://oauth2.googleapis.com/token",
                "https://oauth2.googleapis.com/revoke", "https://gmail.googleapis.com/gmail/v1");
        }

        public boolean configured() {
            return clientId != null;
        }

        /**
         * The only redirect the phone may send: the reversed client id scheme, {@code :/oauth2redirect}; the
         * explicit override wins. Null when not configured or the id has an unexpected shape.
         */
        public String expectedRedirectUri() {
            if (!configured()) {
                return null;
            }
            if (redirectUri != null) {
                return redirectUri;
            }
            String id = clientId;
            if (!id.endsWith(ID_SUFFIX) || id.length() == ID_SUFFIX.length()) {
                return null;
            }
            return "com.googleusercontent.apps." + id.substring(0, id.length() - ID_SUFFIX.length())
                + ":/oauth2redirect";
        }
    }

    @Override
    public String toString() {
        return "MailProperties[secretKey=***, cron=" + cron + ", zone=" + zone + "]";
    }
}

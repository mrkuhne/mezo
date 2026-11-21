package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.Locale;

/**
 * An owner sender rule. {@code pattern} is a full address or {@code @domain} (case-insensitive;
 * {@code @domain} also matches subdomains).
 */
public record SenderRule(String pattern, Kind kind) {

    public enum Kind { SENSITIVE, SILENT, ALWAYS }

    public boolean matches(String from) {
        if (pattern == null || from == null) {
            return false;
        }
        String p = pattern.strip().toLowerCase(Locale.ROOT);
        String f = from.strip().toLowerCase(Locale.ROOT);
        if (p.startsWith("@")) {
            return SensitiveSeed.domainMatches(SensitiveSeed.domainOf(f), p.substring(1));
        }
        return f.equals(p);
    }
}

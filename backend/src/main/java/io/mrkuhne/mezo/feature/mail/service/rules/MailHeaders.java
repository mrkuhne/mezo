package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** The header facts the rules need; {@code raw} holds every header, name to values. */
public record MailHeaders(String from, String fromName, String subject, Map<String, List<String>> raw) {

    public MailHeaders {
        from = from == null ? "" : from;
        fromName = fromName == null ? "" : fromName;
        subject = subject == null ? "" : subject;
        raw = raw == null ? Map.of() : raw;
    }

    /** All values of a header, name matched case-insensitively. */
    public List<String> values(String name) {
        for (Map.Entry<String, List<String>> e : raw.entrySet()) {
            if (e.getKey().equalsIgnoreCase(name)) {
                return e.getValue() == null ? List.of() : e.getValue();
            }
        }
        return List.of();
    }

    public boolean has(String name) {
        return !values(name).isEmpty();
    }

    /** The lower-cased domain of the From address ("" when absent). */
    public String fromDomain() {
        int at = from.lastIndexOf('@');
        return at < 0 ? "" : from.substring(at + 1).strip().toLowerCase(Locale.ROOT);
    }
}

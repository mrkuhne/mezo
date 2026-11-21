package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/** Bulk vs person, and the known newsletter/social senders (spec §5.4 step 1). */
public final class BulkDetector {

    /** Known bulk senders and the "A többi" category they land in. */
    public static final Map<String, String> KNOWN_REST = Map.of(
            "facebookmail.com", "közösségi",
            "linkedin.com", "közösségi",
            "instagram.com", "közösségi",
            "pinterest.com", "közösségi",
            "substack.com", "hírlevél",
            "medium.com", "hírlevél",
            "mailchimp.com", "hírlevél");

    private static final Pattern AUTOMATED_LOCAL =
            Pattern.compile("(?i)^(no-?reply|do-?not-?reply|newsletter|mailer|notifications?|news|marketing)([+._-].*)?$");

    private BulkDetector() {}

    public static boolean isBulk(MailHeaders h) {
        if (h.has("List-Unsubscribe") || h.has("List-Id")) {
            return true;
        }
        for (String p : h.values("Precedence")) {
            String v = p.strip().toLowerCase(Locale.ROOT);
            if (v.equals("bulk") || v.equals("list") || v.equals("junk")) {
                return true;
            }
        }
        for (String a : h.values("Auto-Submitted")) {
            if (!a.strip().equalsIgnoreCase("no")) {
                return true;
            }
        }
        int at = h.from().lastIndexOf('@');
        return at > 0 && AUTOMATED_LOCAL.matcher(h.from().substring(0, at)).matches();
    }

    public static Optional<String> knownRestCategory(MailHeaders h) {
        String domain = h.fromDomain();
        return KNOWN_REST.entrySet().stream()
                .filter(e -> SensitiveSeed.domainMatches(domain, e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst();
    }
}

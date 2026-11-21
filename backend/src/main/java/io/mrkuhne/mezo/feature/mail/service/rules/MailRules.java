package io.mrkuhne.mezo.feature.mail.service.rules;

import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decides, without any model, what most mail is (spec §5.4 step 1). Order: sensitive (owner or seed) -> login
 * codes -> owner "always" -> owner silent -> carrier -> JSON-LD -> known rest senders -> person -> needs model.
 */
public final class MailRules {

    static final String SILENT_CATEGORY = "csendben";

    private static final Pattern ADDRESS = Pattern.compile("[\\w.+-]+@([\\w-]+(?:\\.[\\w-]+)+)");

    private MailRules() {}

    /**
     * {@code rawText} is the unmasked body text (see {@code MailRedactor.plainText}); the rules run locally, so
     * tracking numbers and login codes are read from it. {@code body} supplies only the JSON-LD blocks.
     */
    public static RuleVerdict decide(MailHeaders h, String rawText, RedactedMail body, List<SenderRule> ownerRules) {
        for (SenderRule r : ownerRules) {
            if (r.kind() == SenderRule.Kind.SENSITIVE && r.matches(h.from())) {
                return new RuleVerdict.Sensitive("owner:" + r.pattern());
            }
        }
        Optional<String> seed = SensitiveSeed.matchDomain(h.from());
        if (seed.isPresent()) {
            return new RuleVerdict.Sensitive("seed:" + seed.get());
        }
        if (SensitiveSeed.looksLikeLoginCode(h.subject(), rawText)) {
            return new RuleVerdict.Sensitive("2fa");
        }
        for (SenderRule r : ownerRules) {
            if (r.kind() == SenderRule.Kind.ALWAYS && r.matches(h.from())) {
                return new RuleVerdict.Person();
            }
        }
        for (SenderRule r : ownerRules) {
            if (r.kind() == SenderRule.Kind.SILENT && r.matches(h.from())) {
                return new RuleVerdict.Rest(SILENT_CATEGORY);
            }
        }
        Optional<RuleVerdict.Parcel> parcel = CarrierRules.match(h, rawText);
        if (parcel.isPresent()) {
            return parcel.get();
        }
        if (SensitiveSeed.looksLikeBareCode(h.subject(), rawText)) {
            return new RuleVerdict.Sensitive("2fa");
        }
        Optional<RuleVerdict.Structured> structured = JsonLdReader.read(body.jsonLd());
        if (structured.isPresent()) {
            return structured.get();
        }
        Optional<String> rest = BulkDetector.knownRestCategory(h);
        if (rest.isPresent()) {
            return new RuleVerdict.Rest(rest.get());
        }
        if (!BulkDetector.isBulk(h)) {
            return new RuleVerdict.Person();
        }
        return new RuleVerdict.NeedsModel(true);
    }

    /**
     * Which mailbox the mail was forwarded from: {@code gmail|icloud|unknown}, read from X-Forwarded-For,
     * X-Forwarded-To, then To (first address of the first header that names a known provider).
     */
    public static String via(MailHeaders h) {
        for (String name : List.of("X-Forwarded-For", "X-Forwarded-To", "To")) {
            for (String value : h.values(name)) {
                Matcher m = ADDRESS.matcher(value);
                if (m.find()) {
                    String provider = provider(m.group(1).toLowerCase(Locale.ROOT));
                    if (provider != null) {
                        return provider;
                    }
                }
            }
        }
        return "unknown";
    }

    private static String provider(String domain) {
        if (domain.equals("icloud.com") || domain.equals("me.com") || domain.equals("mac.com")) {
            return "icloud";
        }
        if (domain.equals("gmail.com") || domain.equals("googlemail.com")) {
            return "gmail";
        }
        return null;
    }
}

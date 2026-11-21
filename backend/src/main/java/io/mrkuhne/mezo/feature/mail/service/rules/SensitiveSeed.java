package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/** The seeded sensitive senders and login-code patterns (spec §5.3); owner rules add to these. */
public final class SensitiveSeed {

    /** Banks, insurers, government and health providers; each also matches its subdomains. */
    public static final List<String> DOMAINS = List.of(
            // banks
            "otpbank.hu", "kh.hu", "mbhbank.hu", "erstebank.hu", "cib.hu", "raiffeisen.hu", "unicreditbank.hu",
            "revolut.com", "wise.com",
            // insurers
            "allianz.hu", "generali.hu", "uniqa.hu", "groupama.hu", "aegon.hu",
            // government
            "gov.hu", "magyarorszag.hu", "nav.gov.hu",
            // health
            "eeszt.gov.hu", "medicover.hu", "affidea.hu");

    private static final Pattern TWO_FACTOR = Pattern.compile(
            "(?iu)(verification|security|login|sign-?in|one[- ]time|confirmation|authentication)\\s+(code|passcode|pin)"
                    + "|\\b(otp|2fa)\\b"
                    + "|(ellenőrző|megerősítő|belépési|bejelentkezési|biztonsági|egyszer használatos|sms)\\s*(kód|jelszó)"
                    + "|(kód|code)\\s*[:=]?\\s*\\d{4,8}\\b");

    private SensitiveSeed() {}

    /** The matching seed domain, if the sender belongs to one. */
    public static Optional<String> matchDomain(String from) {
        String domain = domainOf(from);
        return DOMAINS.stream().filter(d -> domainMatches(domain, d)).findFirst();
    }

    public static boolean looksLikeLoginCode(String subject, String body) {
        return TWO_FACTOR.matcher(subject == null ? "" : subject).find()
                || TWO_FACTOR.matcher(body == null ? "" : body).find();
    }

    /** True when {@code domain} equals {@code base} or is a subdomain of it. */
    static boolean domainMatches(String domain, String base) {
        String d = domain.toLowerCase(Locale.ROOT);
        String b = base.toLowerCase(Locale.ROOT);
        return !b.isEmpty() && (d.equals(b) || d.endsWith("." + b));
    }

    static String domainOf(String from) {
        int at = from == null ? -1 : from.lastIndexOf('@');
        return at < 0 ? "" : from.substring(at + 1).strip().toLowerCase(Locale.ROOT);
    }
}

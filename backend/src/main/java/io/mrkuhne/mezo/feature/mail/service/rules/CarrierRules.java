package io.mrkuhne.mezo.feature.mail.service.rules;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Per-carrier parcel rules: sender domain, tracking pattern, status words. Parcel mail never reaches a model.
 * The patterns are built from the carriers' public formats and stay provisional until Task 6's day-one
 * capture of real headers.
 */
public final class CarrierRules {

    record Carrier(String name, List<String> domains, Pattern tracking) {}

    // provisional: tracking patterns, replaced by what the mirror's real mails show
    static final List<Carrier> CARRIERS = List.of(
            new Carrier("GLS", List.of("gls-group.eu", "gls-group.com", "gls-hungary.com"),
                    Pattern.compile("\\b\\d{11,12}\\b")), // provisional
            new Carrier("Foxpost", List.of("foxpost.hu"),
                    Pattern.compile("\\bCLFOX[A-Z0-9]{8,14}\\b")), // provisional
            new Carrier("Packeta", List.of("packeta.hu", "packeta.com", "zasilkovna.cz"),
                    Pattern.compile("\\bZ\\d{9,10}\\b")), // provisional
            new Carrier("MPL", List.of("posta.hu"),
                    Pattern.compile("\\b[A-Z]{2}\\d{9}HU\\b")), // provisional
            new Carrier("DPD", List.of("dpd.hu", "dpd.com"),
                    Pattern.compile("\\b\\d{14}\\b"))); // provisional

    // provisional: status words, checked in this order
    private static final Pattern DELIVERED = Pattern.compile(
            "(?iu)kézbesítettük|kézbesítve|átvetted|átvették|sikeresen átvet|delivered");
    private static final Pattern TODAY = Pattern.compile(
            "(?iu)ma kézbesít|ma érkezik|ma megérkezik|kézbesítés ma|out for delivery|delivered today");
    private static final Pattern PICKUP = Pattern.compile(
            "(?iu)átvehető|átvételre vár|csomagpont|csomagautomata|ready for pick|ready to collect");
    private static final Pattern TRANSIT = Pattern.compile(
            "(?iu)úton van|úton\\b|feladt|szállítás alatt|in transit|on its way|felvettük");

    private CarrierRules() {}

    public static Optional<RuleVerdict.Parcel> match(MailHeaders h, String rawText) {
        String domain = h.fromDomain();
        for (Carrier c : CARRIERS) {
            if (c.domains().stream().noneMatch(d -> SensitiveSeed.domainMatches(domain, d))) {
                continue;
            }
            String text = h.subject() + "\n" + rawText;
            Optional<String> tracking = firstMatch(c.tracking(), h.subject()).or(() -> firstMatch(c.tracking(), rawText));
            Optional<ParcelState> state = state(text);
            if (tracking.isEmpty() && state.isEmpty()) {
                return Optional.empty(); // a carrier newsletter, not a status mail
            }
            String key = tracking.orElseGet(() -> fallbackKey(c.name(), h.subject()));
            return Optional.of(new RuleVerdict.Parcel(c.name(), key, state.orElse(ParcelState.IN_TRANSIT)));
        }
        return Optional.empty();
    }

    static Optional<ParcelState> state(String text) {
        if (DELIVERED.matcher(text).find()) {
            return Optional.of(ParcelState.DELIVERED);
        }
        if (TODAY.matcher(text).find()) {
            return Optional.of(ParcelState.TODAY);
        }
        if (PICKUP.matcher(text).find()) {
            return Optional.of(ParcelState.PICKUP);
        }
        if (TRANSIT.matcher(text).find()) {
            return Optional.of(ParcelState.IN_TRANSIT);
        }
        return Optional.empty();
    }

    private static Optional<String> firstMatch(Pattern p, String text) {
        Matcher m = p.matcher(text);
        return m.find() ? Optional.of(m.group()) : Optional.empty();
    }

    /** Stable per carrier + normalized subject, so one shipment updates one row. */
    static String fallbackKey(String carrier, String subject) {
        String normalized = subject.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").strip();
        // a name-based UUID is a stable, non-throwing digest; this is a row key, not a secret
        return "h-" + UUID.nameUUIDFromBytes((carrier + "|" + normalized).getBytes(StandardCharsets.UTF_8));
    }
}

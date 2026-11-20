package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.news.NewsText;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.text.Normalizer;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The prose of one proposal (mezo-r36n9.105, build notes call 13): a summary, one "why" per sleeve and where it
 * could be wrong — written by the model (then validated) or by {@link ProposalFallbackCopy}.
 */
public record ProposalNarration(String summary, Map<Sleeve, String> why, String uncertainty) {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Pattern SEPARATORS = Pattern.compile("\\p{Z}");

    public ProposalNarration {
        why = Map.copyOf(why);
    }

    public String why(Sleeve s) {
        return why.get(s);
    }

    /**
     * Every field {@link #normalise normalised} — the form the validator checks AND the form that is stored (L7
     * review I5), so a zero-width space, a soft hyphen, a no-break space or a full-width digit cannot hide a word or a
     * number from the gate.
     */
    public ProposalNarration normalised() {
        Map<Sleeve, String> w = new EnumMap<>(Sleeve.class);
        why.forEach((k, v) -> w.put(k, normalise(v)));
        return new ProposalNarration(normalise(summary), w, normalise(uncertainty));
    }

    /**
     * {@link NewsText#clean} (control, format {@code \p{Cf}} — zero-width, soft hyphen, bidi — and lone surrogate
     * characters out), Unicode NFKC (full-width digits → ASCII, compatibility spaces), cleaned again, every
     * {@code \p{Z}} separator → a plain space, stripped. Null → null.
     */
    public static String normalise(String s) {
        if (s == null) {
            return null;
        }
        String nfkc = Normalizer.normalize(NewsText.clean(s), Normalizer.Form.NFKC);
        return SEPARATORS.matcher(NewsText.clean(nfkc)).replaceAll(" ").strip();
    }

    /**
     * The model's raw answer parsed: the outermost JSON object of the text, {@code summary}, {@code uncertainty} and
     * {@code sleeves[{sleeve, why}]} with every one of the three sleeves exactly once. Anything else → empty (the
     * caller falls back).
     */
    public static Optional<ProposalNarration> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        JsonNode root;
        try {
            root = JSON.readTree(raw.substring(start, end + 1));
        } catch (JacksonException | IllegalArgumentException e) {
            return Optional.empty();
        }
        if (root == null || !root.isObject()) {
            return Optional.empty();
        }
        String summary = text(root.get("summary"));
        String uncertainty = text(root.get("uncertainty"));
        JsonNode sleeves = root.get("sleeves");
        if (summary == null || uncertainty == null || sleeves == null || !sleeves.isArray()) {
            return Optional.empty();
        }
        Map<Sleeve, String> why = new EnumMap<>(Sleeve.class);
        for (JsonNode s : sleeves) {
            String key = text(s.get("sleeve"));
            String text = text(s.get("why"));
            Sleeve sleeve = sleeveOf(key);
            if (sleeve == null || text == null || why.containsKey(sleeve)) {
                return Optional.empty();
            }
            why.put(sleeve, text);
        }
        if (why.size() != Sleeve.values().length) {
            return Optional.empty();
        }
        return Optional.of(new ProposalNarration(summary, why, uncertainty));
    }

    private static Sleeve sleeveOf(String key) {
        if (key == null) {
            return null;
        }
        return switch (key) {
            case "short" -> Sleeve.SHORT;
            case "mid" -> Sleeve.MID;
            case "long" -> Sleeve.LONG;
            default -> null;
        };
    }

    private static String text(JsonNode n) {
        return n == null || !n.isString() ? null : n.asString();
    }
}

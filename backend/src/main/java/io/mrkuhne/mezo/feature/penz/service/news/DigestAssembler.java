package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Turns the stories, their figures and the model's raw answer into the stored digest items (Boop Pénz L6,
 * mezo-r36n9.104, build notes §3.6–3.7). Pure and total: garbage, a missing answer or a thrown parse never escapes —
 * every story then gets the {@link DigestFallbackCopy}.
 *
 * <ul>
 *   <li>The figures, the holding id / ledger name / sleeve, the sources and the date come from the backend, never
 *       from the model; the model supplies only title, verdict, body, confidence, uncertainty, noAction.</li>
 *   <li>{@code keep: false} drops the story (M1's relevance rule); an unknown story id is ignored; the first entry per
 *       id wins; a story the model left out gets the fallback.</li>
 *   <li>An entry with any {@link DigestValidator} violation is replaced whole by the fallback ({@code narratedBy:
 *       fallback}, confidence 0).</li>
 *   <li>A story narrated without any article body (headlines only) is capped at confidence 1.</li>
 * </ul>
 */
public final class DigestAssembler {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    /** The items in story order, and per story id the violations that sent it to the fallback (for the log). */
    public record Assembly(List<PenzDigestItemJson> items, Map<String, List<DigestViolation>> rejected) {

        public Assembly {
            items = List.copyOf(items);
            rejected = Map.copyOf(rejected);
        }
    }

    private DigestAssembler() {
    }

    /** {@link #assembleWithReport}'s items. */
    public static List<PenzDigestItemJson> assemble(List<DigestStory> stories, List<NewsHolding> holdings,
                                                    String rawModelAnswer) {
        return assembleWithReport(stories, holdings, rawModelAnswer).items();
    }

    public static Assembly assembleWithReport(List<DigestStory> stories, List<NewsHolding> holdings,
                                              String rawModelAnswer) {
        Map<String, DigestModelItem> byStory = parse(rawModelAnswer);
        List<PenzDigestItemJson> items = new ArrayList<>();
        Map<String, List<DigestViolation>> rejected = new LinkedHashMap<>();
        for (DigestStory s : stories) {
            DigestModelItem m = byStory.get(s.id());
            if (m == null) {
                items.add(fallback(s));
                continue;
            }
            if (!m.keep()) {
                continue;
            }
            List<DigestViolation> violations = DigestValidator.validate(m, s, holdings);
            if (!violations.isEmpty()) {
                rejected.put(s.id(), violations);
                items.add(fallback(s));
                continue;
            }
            int confidence = s.hasBody() ? m.confidence() : Math.min(m.confidence(), 1);
            items.add(item(s, m.title().strip(), m.verdict().strip(), m.body().strip(), confidence,
                m.uncertainty().strip(), m.noAction().strip(), PenzDigestItemJson.NARRATED_BY_MODEL));
        }
        return new Assembly(items, rejected);
    }

    /** The fixed-copy item for {@code s}: honest about the failure, per-item noAction, confidence 0. */
    public static PenzDigestItemJson fallback(DigestStory s) {
        DigestFigures f = s.figures();
        return item(s, DigestFallbackCopy.title(s.kind(), s.holdingName()), DigestFallbackCopy.verdict(),
            DigestFallbackCopy.body(s.story().articles().size()), 0, DigestFallbackCopy.uncertainty(),
            DigestFallbackCopy.noAction(s.kind(), f.sleeve()), PenzDigestItemJson.NARRATED_BY_FALLBACK);
    }

    private static PenzDigestItemJson item(DigestStory s, String title, String verdict, String body, int confidence,
                                           String uncertainty, String noAction, String narratedBy) {
        DigestFigures f = s.figures();
        boolean holding = s.kind() == DigestKind.HOLDING;
        List<PenzDigestItemJson.Source> sources = s.story().articles().stream()
            .map(a -> new PenzDigestItemJson.Source(a.sourceName(), a.title(), a.url(), a.publishedAt()))
            .toList();
        return new PenzDigestItemJson(s.id(), s.kind().wire(), s.story().key().holdingId(),
            holding ? s.holdingName() : null, holding ? f.sleeve() : null, title, f.effectHufMinor(),
            DigestFallbackCopy.effectNote(s.kind(), f.effectHufMinor()), f.changePctRounded(), confidence, verdict, body,
            uncertainty, noAction, s.story().newest(), sources, narratedBy);
    }

    /** The model's entries by story id (first wins); anything unreadable → empty. Never throws. */
    static Map<String, DigestModelItem> parse(String raw) {
        Map<String, DigestModelItem> out = new HashMap<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        String s = raw.strip();
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return out;
        }
        JsonNode root;
        try {
            root = JSON.readTree(s.substring(start, end + 1));
        } catch (JacksonException | IllegalArgumentException e) {
            return out;
        }
        JsonNode items = root == null ? null : root.get("items");
        if (items == null || !items.isArray()) {
            return out;
        }
        for (JsonNode e : items) {
            if (e == null || !e.isObject()) {
                continue;
            }
            String story = str(e.get("story"));
            if (story == null || out.containsKey(story)) {
                continue;
            }
            JsonNode keep = e.get("keep");
            boolean kept = keep == null || !keep.isBoolean() || keep.booleanValue();
            JsonNode conf = e.get("confidence");
            Integer confidence = conf != null && conf.isIntegralNumber() && conf.canConvertToInt() ? conf.intValue()
                : null;
            out.put(story, new DigestModelItem(story, kept, str(e.get("title")), str(e.get("verdict")),
                str(e.get("body")), confidence, str(e.get("uncertainty")), str(e.get("noAction"))));
        }
        return out;
    }

    private static String str(JsonNode n) {
        return n != null && n.isString() ? n.asString() : null;
    }
}

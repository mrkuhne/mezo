package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Turns the three weekly sections and the model's raw answer into the stored sections (mezo-r36n9.120), the
 * {@link DigestAssembler} shape. Pure and total: garbage, a missing answer or a thrown parse never escapes.
 *
 * <ul>
 *   <li>A sleeve with no stories → the deterministic quiet copy ({@code narratedBy: quiet}, {@code matters: false});
 *       the model is not asked about it.</li>
 *   <li>A sleeve the model left out, an entry with any {@link WeeklyReviewValidator} violation, or no answer at all →
 *       {@link WeeklyReviewFallbackCopy} ({@code narratedBy: fallback}, {@code matters: false}).</li>
 *   <li>The first entry per sleeve wins; an unknown sleeve is ignored; unknown story ids are ignored.</li>
 *   <li>Counts, coverage, horizon label, stories, ledger names and sources come from the backend, never from the
 *       model. Stories are shown at most {@value #STORIES_SHOWN} per section — the ones the model relied on first.</li>
 * </ul>
 */
public final class WeeklyReviewAssembler {

    public static final int STORIES_SHOWN = 6;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    /** The sections in sleeve order, and per sleeve the violations that sent it to the fallback (for the log). */
    public record Assembly(List<PenzWeeklySectionJson> sections, Map<String, List<DigestViolation>> rejected) {

        public Assembly {
            sections = List.copyOf(sections);
            rejected = Map.copyOf(rejected);
        }
    }

    private WeeklyReviewAssembler() {
    }

    public static Assembly assemble(List<WeeklySection> sections, List<NewsHolding> holdings, String rawModelAnswer) {
        Map<String, WeeklyModelSection> bySleeve = parse(rawModelAnswer);
        Map<UUID, NewsHolding> byId = new HashMap<>();
        holdings.forEach(h -> byId.put(h.id(), h));
        List<PenzWeeklySectionJson> out = new ArrayList<>();
        Map<String, List<DigestViolation>> rejected = new LinkedHashMap<>();
        for (WeeklySection s : sections) {
            if (s.quiet()) {
                out.add(quiet(s));
                continue;
            }
            WeeklyModelSection m = bySleeve.get(s.sleeve());
            if (m == null) {
                out.add(fallback(s, byId));
                continue;
            }
            List<DigestViolation> violations = WeeklyReviewValidator.validate(m, s, holdings);
            if (!violations.isEmpty()) {
                rejected.put(s.sleeve(), violations);
                out.add(fallback(s, byId));
                continue;
            }
            out.add(section(s, Boolean.TRUE.equals(m.matters()), m.verdict().strip(), m.body().strip(),
                m.uncertainty().strip(), m.noAction().strip(), PenzWeeklySectionJson.NARRATED_BY_MODEL,
                WeeklyReviewValidator.knownStoryIds(m, s), byId));
        }
        return new Assembly(out, rejected);
    }

    /** The quiet section of a sleeve no story touched this week. */
    public static PenzWeeklySectionJson quiet(WeeklySection s) {
        return section(s, false, WeeklyReviewFallbackCopy.quietVerdict(), WeeklyReviewFallbackCopy.quietBody(),
            WeeklyReviewFallbackCopy.quietUncertainty(), WeeklyReviewFallbackCopy.noAction(s.sleeve()),
            PenzWeeklySectionJson.NARRATED_BY_QUIET, List.of(), Map.of());
    }

    /** The fixed-copy section for {@code s}: honest about the failure, the story count in words, per-sleeve noAction. */
    public static PenzWeeklySectionJson fallback(WeeklySection s, Map<UUID, NewsHolding> byId) {
        return section(s, false, WeeklyReviewFallbackCopy.verdict(),
            WeeklyReviewFallbackCopy.body(s.figures().storyCount()), WeeklyReviewFallbackCopy.uncertainty(),
            WeeklyReviewFallbackCopy.noAction(s.sleeve()), PenzWeeklySectionJson.NARRATED_BY_FALLBACK, List.of(), byId);
    }

    private static PenzWeeklySectionJson section(WeeklySection s, boolean matters, String verdict, String body,
                                                 String uncertainty, String noAction, String narratedBy,
                                                 List<String> reliedOn, Map<UUID, NewsHolding> byId) {
        WeeklyFigures f = s.figures();
        List<PenzDigestItemJson> ordered = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String id : reliedOn) {
            s.stories().stream().filter(i -> id.equals(i.id())).findFirst().ifPresent(i -> {
                ordered.add(i);
                seen.add(i.id());
            });
        }
        s.stories().stream().filter(i -> !seen.contains(i.id())).forEach(ordered::add);
        List<PenzWeeklySectionJson.Story> stories = ordered.stream().limit(STORIES_SHOWN).map(i -> story(i, byId))
            .toList();
        return new PenzWeeklySectionJson(s.sleeve(), f.horizonLabel(), f.storyCount(), f.sourceCount(), matters,
            verdict, body, uncertainty, noAction, narratedBy, f.coverageMonths(), stories);
    }

    private static PenzWeeklySectionJson.Story story(PenzDigestItemJson i, Map<UUID, NewsHolding> byId) {
        List<PenzWeeklySectionJson.Source> sources = i.sources().stream()
            .map(src -> new PenzWeeklySectionJson.Source(src.name(), src.url())).toList();
        String holdingName = "holding".equals(i.kind()) ? WeeklyReviewSectioner.holdingName(i, byId) : null;
        return new PenzWeeklySectionJson.Story(i.id(), i.title(), holdingName, i.kind(), sources, i.publishedAt());
    }

    /** The model's sections by sleeve (first wins); anything unreadable → empty. Never throws. */
    static Map<String, WeeklyModelSection> parse(String raw) {
        Map<String, WeeklyModelSection> out = new HashMap<>();
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
        JsonNode sections = root == null ? null : root.get("sections");
        if (sections == null || !sections.isArray()) {
            return out;
        }
        for (JsonNode e : sections) {
            if (e == null || !e.isObject()) {
                continue;
            }
            String sleeve = str(e.get("sleeve"));
            if (sleeve == null || !WeeklyReviewSectioner.SLEEVES.contains(sleeve) || out.containsKey(sleeve)) {
                continue;
            }
            JsonNode matters = e.get("matters");
            List<String> ids = new ArrayList<>();
            JsonNode storyIds = e.get("storyIds");
            if (storyIds != null && storyIds.isArray()) {
                storyIds.forEach(n -> {
                    if (n != null && n.isString()) {
                        ids.add(n.asString());
                    }
                });
            }
            out.put(sleeve, new WeeklyModelSection(sleeve,
                matters != null && matters.isBoolean() ? matters.booleanValue() : null, ids, str(e.get("verdict")),
                str(e.get("body")), str(e.get("uncertainty")), str(e.get("noAction"))));
        }
        return out;
    }

    private static String str(JsonNode n) {
        return n != null && n.isString() ? n.asString() : null;
    }
}

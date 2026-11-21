package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * The deterministic half of the weekly long-horizon review (mezo-r36n9.120) — pure, no Spring.
 *
 * <ul>
 *   <li><b>Week</b>: the previous complete Monday–Sunday week of the owner's today (his money timezone — the caller
 *       passes his local date; a digest's {@code digestDate} is already his local date).</li>
 *   <li><b>De-duplication</b>: the same story id on several days counts once — the latest day's copy wins. Only items
 *       narrated by the model or by fallback copy count (every stored item is one of the two).</li>
 *   <li><b>Sections</b>, always the three sleeves in order: a holding story belongs to its stored sleeve (else the
 *       ledger's); an {@code fx} story to every sleeve holding a non-HUF holding, a {@code rates} story to every
 *       sleeve holding a bond — by the current live holdings. Within a section: most sources first, then newest.</li>
 *   <li><b>Figures</b>: the story count, the distinct source names (case- and diacritic-insensitive), the holdings
 *       touched (ledger names: a holding story's holding; for fx the sleeve's non-HUF holdings, for rates its bonds)
 *       and, for {@code long} only, the coverage months the caller computed like Pénzem does.</li>
 * </ul>
 */
public final class WeeklyReviewSectioner {

    public static final List<String> SLEEVES = List.of("short", "mid", "long");

    private WeeklyReviewSectioner() {
    }

    /** The Monday of the previous complete Monday–Sunday week, seen from {@code today}. */
    public static LocalDate previousWeekStart(LocalDate today) {
        return today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    }

    /** The Monday of the week {@code date} falls in. */
    public static LocalDate weekStartOf(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * The week's items, each story id once (the latest day's copy), in first-seen order; items of days outside
     * {@code weekStart}..{@code weekStart + 6} are ignored.
     */
    public static List<PenzDigestItemJson> dedupe(Map<LocalDate, List<PenzDigestItemJson>> itemsByDay,
                                                  LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        Map<String, PenzDigestItemJson> byId = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, List<PenzDigestItemJson>> day : new TreeMap<>(itemsByDay).entrySet()) {
            if (day.getKey().isBefore(weekStart) || day.getKey().isAfter(weekEnd) || day.getValue() == null) {
                continue;
            }
            for (PenzDigestItemJson i : day.getValue()) {
                if (i == null || i.id() == null || !narrated(i)) {
                    continue;
                }
                byId.put(i.id(), i);
            }
        }
        return List.copyOf(byId.values());
    }

    /** The three sections (short, mid, long) of the week's de-duplicated items. */
    public static List<WeeklySection> sections(List<PenzDigestItemJson> items, List<NewsHolding> holdings,
                                               Integer longCoverageMonths) {
        Map<UUID, NewsHolding> byId = new LinkedHashMap<>();
        holdings.forEach(h -> byId.put(h.id(), h));
        List<WeeklySection> out = new ArrayList<>();
        for (String sleeve : SLEEVES) {
            List<NewsHolding> inSleeve = holdings.stream().filter(h -> sleeve.equals(h.sleeve())).toList();
            boolean foreign = inSleeve.stream().anyMatch(NewsHolding::isForeignCurrency);
            boolean bond = inSleeve.stream().anyMatch(NewsHolding::isBond);
            List<PenzDigestItemJson> stories = new ArrayList<>();
            Set<String> touched = new LinkedHashSet<>();
            for (PenzDigestItemJson i : items) {
                switch (i.kind() == null ? "" : i.kind()) {
                    case "holding" -> {
                        NewsHolding h = i.holdingId() == null ? null : byId.get(i.holdingId());
                        String storySleeve = i.sleeve() != null ? i.sleeve() : h == null ? null : h.sleeve();
                        if (sleeve.equals(storySleeve)) {
                            stories.add(i);
                            String name = holdingName(i, byId);
                            if (name != null) {
                                touched.add(name);
                            }
                        }
                    }
                    case "fx" -> {
                        if (foreign) {
                            stories.add(i);
                            inSleeve.stream().filter(NewsHolding::isForeignCurrency).map(NewsHolding::name)
                                .forEach(touched::add);
                        }
                    }
                    case "rates" -> {
                        if (bond) {
                            stories.add(i);
                            inSleeve.stream().filter(NewsHolding::isBond).map(NewsHolding::name).forEach(touched::add);
                        }
                    }
                    default -> {
                        // an unknown kind is not attributed anywhere
                    }
                }
            }
            stories.sort(Comparator.comparingInt((PenzDigestItemJson i) -> i.sources().size()).reversed()
                .thenComparing(PenzDigestItemJson::publishedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(PenzDigestItemJson::id));
            Set<String> sources = new LinkedHashSet<>();
            stories.forEach(i -> i.sources().stream().map(PenzDigestItemJson.Source::name)
                .filter(n -> n != null && !n.isBlank()).map(NewsText::fold).forEach(sources::add));
            Set<String> mayName = new LinkedHashSet<>(touched);
            inSleeve.stream().map(NewsHolding::name).filter(Objects::nonNull).forEach(mayName::add);
            WeeklyFigures figures = new WeeklyFigures(sleeve, stories.size(), sources.size(), List.copyOf(touched),
                "long".equals(sleeve) ? longCoverageMonths : null);
            out.add(new WeeklySection(sleeve, stories, figures, List.copyOf(mayName)));
        }
        return out;
    }

    /** A holding story's name as his ledger has it now, else as the digest stored it (also from the ledger). */
    public static String holdingName(PenzDigestItemJson i, Map<UUID, NewsHolding> byId) {
        NewsHolding h = i.holdingId() == null ? null : byId.get(i.holdingId());
        if (h != null && h.name() != null && !h.name().isBlank()) {
            return h.name();
        }
        return i.holdingName() == null || i.holdingName().isBlank() ? null : i.holdingName();
    }

    private static boolean narrated(PenzDigestItemJson i) {
        return PenzDigestItemJson.NARRATED_BY_MODEL.equals(i.narratedBy())
            || PenzDigestItemJson.NARRATED_BY_FALLBACK.equals(i.narratedBy());
    }
}

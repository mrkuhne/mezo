package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * mezo-lb2yb: the query the full-text + trigram retrievers actually run. Chat-shaped queries (a few
 * words) pass through folded, exactly as before. The proactive consumers, though, hand over
 * 500–2000-character context dumps: trigram {@code similarity}/{@code word_similarity} against such
 * a string cost ~2 s over the owner's ~200 items in production (the 200 ms retriever deadline
 * timed out in 186 of 194 runs), and {@code websearch_to_tsquery} ANDs every term, so full-text
 * could not match anyway. A long query is therefore shaped into its {@link #MAX_KEYWORDS} most
 * frequent content words (≥ 3 letters, not a stop word, not a number), OR-ed for full-text and
 * space-joined for trigram — a short query again (~10 ms full-text, ~80 ms trigram in production).
 */
public record MemoryKeywordQuery(String text, String tsQuery, boolean keywordMode) {

    /** At most this many words keep the query as written. */
    static final int MAX_PLAIN_WORDS = 8;
    /** ...and so does any query up to this length: an ordinary chat sentence is never shaped,
     *  only a context dump (review finding — short Hungarian content words like "fáj" matter). */
    static final int MAX_PLAIN_CHARS = 200;
    /** Keywords kept from a long query. */
    static final int MAX_KEYWORDS = 8;
    private static final int MIN_KEYWORD_LENGTH = 3;

    /** Folded (lowercase, accent-free) Hungarian function words and dump-label noise. */
    private static final Set<String> STOP_WORDS = java.util.stream.Stream.of(
            "akkor", "egy", "ami", "aki", "nem", "igen", "ezt", "ora", "het", "napja", "fel", "alatt", "amely", "amelyek", "amikor", "amit", "annak", "arra", "attol", "azert",
            "azok", "azon", "azt", "bele", "csak", "eddig", "egyik", "egyes", "elott", "ember", "eppen",
            "ezek", "ezert", "ezzel", "hogy", "illetve", "itt", "kell", "kozott", "lesz", "lett", "maga",
            "meg", "mellett", "mert", "mind", "minden", "mint", "mivel", "most", "nagyon", "neki", "nekem",
            "nelkul", "nincs", "olyan", "ott", "pedig", "szerint", "tobb", "utan", "vagy", "valami",
            "van", "vannak", "volt", "voltak", "akar", "allapot", "adat", "adatok", "nap", "napi",
            "napon", "heti", "hetente", "mai", "tegnap", "orak", "perc", "gramm", "kcal", "darab")
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

    public static MemoryKeywordQuery of(String raw) {
        String folded = ToolText.fold(raw == null ? "" : raw).trim();
        List<String> words = Arrays.stream(folded.split("[^\\p{L}\\p{N}]+"))
                .filter(word -> !word.isBlank())
                .toList();
        if (words.isEmpty()) {
            return new MemoryKeywordQuery("", "", false);
        }
        if (words.size() <= MAX_PLAIN_WORDS || folded.length() <= MAX_PLAIN_CHARS) {
            return new MemoryKeywordQuery(folded, folded, false);
        }
        Map<String, int[]> counts = new LinkedHashMap<>(); // word -> {count, firstPosition}
        for (int i = 0; i < words.size(); i++) {
            String word = words.get(i);
            if (word.length() < MIN_KEYWORD_LENGTH || STOP_WORDS.contains(word) || word.chars().allMatch(Character::isDigit)) {
                continue;
            }
            int position = i;
            counts.computeIfAbsent(word, w -> new int[] {0, position})[0]++;
        }
        List<String> keywords = counts.entrySet().stream()
                .sorted(Comparator.<Map.Entry<String, int[]>>comparingInt(e -> -e.getValue()[0])
                        .thenComparingInt(e -> e.getValue()[1]))
                .limit(MAX_KEYWORDS)
                .map(Map.Entry::getKey)
                .toList();
        if (keywords.isEmpty()) {
            return new MemoryKeywordQuery("", "", true);
        }
        return new MemoryKeywordQuery(String.join(" ", keywords), String.join(" | ", keywords), true);
    }

    /** The tsquery constructor for {@code :tsQuery}: OR-ed keywords need {@code to_tsquery}; a
     *  plain query keeps the forgiving {@code websearch_to_tsquery} it always had. */
    public String tsQuerySql() {
        return keywordMode && !tsQuery.isEmpty()
                ? "to_tsquery('simple', :tsQuery)"
                : "websearch_to_tsquery('simple', :tsQuery)";
    }
}

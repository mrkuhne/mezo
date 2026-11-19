package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Deterministic lexical SHORTLIST of catalog foods for a said ingredient name (mezo-r36n9.63) — the
 * generous sibling of the strict {@link PantryNameIndex}. It never decides a match: it only narrows a
 * few hundred rows to a handful of candidates, an AI then picks among exactly those ids, and the owner
 * confirms the pick. So a loose hit costs nothing, while a non-food row or a row with no word in
 * common must never be offered. Pure and Spring-free; lives in {@code feature/pantry} so both recipe
 * and meal can use it without a recipe -> meal edge.
 *
 * <p>Score = matched said words ÷ said words. A said word matches a food word when they are equal, or
 * when one is the beginning of the other and the shorter one has at least {@value #PREFIX_MIN} letters
 * (Hungarian compounds and suffixes: "csirkemell" ~ "csirkemellfilé", "olívaolajat" ~ "olívaolaj").
 * Brand words count as food words; a row on the owner's shelf gets {@value #SHELF_BONUS} on top; ties
 * go to the shorter food name.
 */
public final class PantryMatcher {

    static final int PREFIX_MIN = 4;
    static final double SHELF_BONUS = 0.2;

    /** One candidate: {@code score} already carries the shelf bonus. */
    public record Candidate(PantryCatalogEntity food, double score, boolean onShelf) {}

    private record Indexed(PantryCatalogEntity food, Set<String> words, boolean onShelf) {}

    private final List<Indexed> rows;

    private PantryMatcher(List<Indexed> rows) {
        this.rows = rows;
    }

    /** {@code rows}: live rows (non-food kinds are ignored); {@code shelfIds}: catalog ids on the owner's shelf. */
    public static PantryMatcher of(List<PantryCatalogEntity> rows, Set<UUID> shelfIds) {
        List<Indexed> indexed = new ArrayList<>();
        for (PantryCatalogEntity row : rows) {
            if (!"food".equals(row.getKind())) {
                continue;
            }
            Set<String> words = new LinkedHashSet<>(tokens(row.getName()));
            words.addAll(tokens(row.getBrand()));
            if (!words.isEmpty()) {
                indexed.add(new Indexed(row, words, shelfIds.contains(row.getId())));
            }
        }
        return new PantryMatcher(List.copyOf(indexed));
    }

    /** Best first, at most {@code limit}; empty when no word overlaps. */
    public List<Candidate> shortlist(String saidName, int limit) {
        List<String> said = tokens(saidName);
        if (said.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<Candidate> hits = new ArrayList<>();
        for (Indexed row : rows) {
            long matched = said.stream().filter(word -> matches(word, row.words())).count();
            if (matched == 0) {
                continue;
            }
            double score = (double) matched / said.size() + (row.onShelf() ? SHELF_BONUS : 0);
            hits.add(new Candidate(row.food(), score, row.onShelf()));
        }
        hits.sort(Comparator.comparingDouble(Candidate::score).reversed()
            .thenComparingInt(c -> c.food().getName().length())
            .thenComparing(c -> c.food().getName()));
        return hits.size() <= limit ? List.copyOf(hits) : List.copyOf(hits.subList(0, limit));
    }

    private static boolean matches(String said, Set<String> foodWords) {
        for (String word : foodWords) {
            if (word.equals(said)) {
                return true;
            }
            boolean saidIsShorter = said.length() <= word.length();
            String shorter = saidIsShorter ? said : word;
            String longer = saidIsShorter ? word : said;
            if (shorter.length() >= PREFIX_MIN && longer.startsWith(shorter)) {
                return true;
            }
        }
        return false;
    }

    /** Diacritics/punctuation folded, lower-cased, split on non-alphanumerics; words under 2 letters and bare numbers dropped. */
    static List<String> tokens(String s) {
        String folded = PantryNameIndex.normalize(s);
        if (folded.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String word : folded.split(" ")) {
            if (word.length() >= 2 && !word.chars().allMatch(Character::isDigit)) {
                out.add(word);
            }
        }
        return out;
    }
}

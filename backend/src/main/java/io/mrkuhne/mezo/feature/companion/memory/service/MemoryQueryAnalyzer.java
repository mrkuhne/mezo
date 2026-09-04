package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Conservative, deterministic query routing before any retrieval or model call. */
@Component
public class MemoryQueryAnalyzer {

    static final int CONTEXT_DEPENDENT_MAX_CHARS = 160;
    static final Set<String> NO_MEMORY_PHRASES = Set.of(
            "szia", "hello", "jo reggelt", "jo estet",
            "koszonom", "koszi", "kosz", "rendben", "ok", "oksa",
            "ki vagy", "mit tudsz", "hogyan mukodsz", "altalanos kerdesem van");
    static final Set<String> REFERENTIAL_MARKERS = Set.of(
            "elotte", "utana", "akkor", "arrol", "azzal", "ehhez", "vele", "o", "az");
    static final Set<String> LEADING_CONTINUATIONS = Set.of("es", "de", "viszont");

    private static final Pattern ISO_DATE = Pattern.compile("(?<!\\d)\\d{4}-\\d{2}-\\d{2}(?!\\d)");
    private static final Pattern TRAILING_PUNCTUATION = Pattern.compile("[\\p{Punct}\\s]+$");
    private static final Pattern WORD_SEPARATOR = Pattern.compile("[^\\p{L}\\p{N}]+", Pattern.UNICODE_CHARACTER_CLASS);

    public PreparedMemoryQuery analyze(String currentQuery, List<CompanionLlm.Turn> history) {
        String rawQuery = currentQuery == null ? "" : currentQuery;
        String folded = ToolText.fold(rawQuery).trim();
        String phrase = TRAILING_PUNCTUATION.matcher(folded).replaceAll("");
        List<String> words = WORD_SEPARATOR.splitAsStream(folded)
                .filter(word -> !word.isBlank())
                .toList();

        QueryMode mode;
        if (NO_MEMORY_PHRASES.contains(phrase)) {
            mode = QueryMode.NO_MEMORY_NEEDED;
        } else if (hasUsableHistory(history)
                && rawQuery.length() < CONTEXT_DEPENDENT_MAX_CHARS
                && (containsReferentialMarker(words) || startsWithContinuation(words))) {
            mode = QueryMode.CONTEXT_DEPENDENT;
        } else {
            mode = QueryMode.SELF_CONTAINED;
        }

        List<LocalDate> dates = extractDates(rawQuery);
        Optional<LocalDate> from = dates.stream().min(LocalDate::compareTo);
        Optional<LocalDate> to = dates.stream().max(LocalDate::compareTo);
        return new PreparedMemoryQuery(mode, rawQuery, rawQuery, from, to);
    }

    private static boolean hasUsableHistory(List<CompanionLlm.Turn> history) {
        return history != null && history.stream()
                .anyMatch(turn -> turn != null && turn.content() != null && !turn.content().isBlank());
    }

    private static boolean containsReferentialMarker(List<String> words) {
        return words.stream().anyMatch(REFERENTIAL_MARKERS::contains);
    }

    private static boolean startsWithContinuation(List<String> words) {
        return !words.isEmpty() && LEADING_CONTINUATIONS.contains(words.getFirst());
    }

    private static List<LocalDate> extractDates(String query) {
        List<LocalDate> dates = new ArrayList<>();
        Matcher matcher = ISO_DATE.matcher(query);
        while (matcher.find()) {
            try {
                dates.add(LocalDate.parse(matcher.group()));
            } catch (DateTimeParseException ignored) {
                // A date-shaped but invalid token is not a usable retrieval bound.
            }
        }
        return dates;
    }
}

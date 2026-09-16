package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Conservative, deterministic gear routing before any model call — the same shape as
 * {@code MemoryQueryAnalyzer}, and for the same reason: the analyzer, not a model, decides the
 * easy cases, so the common turn costs nothing to classify.
 *
 * <p>An EMPTY result means UNSURE, not CHAT. Resolving it is {@code TurnGearRouter}'s job.
 */
@Component
public class TurnGearAnalyzer {

    /** Words that only appear when the user is talking about their own logged data. */
    static final Set<String> DOMAIN_WORDS = Set.of(
        "aludtam", "alvas", "alvasom", "alvasomban", "alvasi",
        "ettem", "etkezes", "etkezesem", "kaloria", "makro", "feherje", "szenhidrat", "zsir", "rost",
        "suly", "sulyom", "sulyommal", "kilo", "fogyas", "hizas",
        "edzes", "edzesem", "edzettem", "sorozat", "ismetles", "pr", "rekord",
        "protokoll", "supplement", "gyogyszer", "keszitmeny",
        "szokas", "kuldetes", "streak", "xp", "szint",
        "vizet", "viz", "hidratacio", "kozerzet", "energia", "stressz",
        "recept", "kamra", "cel", "celom", "faradt");

    /** Words that anchor a question to a point in time — a second, independent data signal. */
    static final Set<String> TIME_WORDS = Set.of(
        "ma", "tegnap", "tegnapelott", "holnap", "holnaputan",
        "hetfon", "kedden", "szerdan", "csutortokon", "penteken", "szombaton", "vasarnap",
        "heten", "heti", "honapban", "havi", "tavaly", "iden", "reggel", "este", "ejjel", "mostanaban");

    /** "How much / when / what" — the answer is a value that exists in a row somewhere. */
    static final Set<String> LOOKUP_WORDS = Set.of("mennyit", "mennyi", "hany", "mikor", "mit", "milyen");

    /** "Why / what changed / what should I" — the answer needs interpretation across rows. */
    static final Set<String> ANALYSIS_WORDS = Set.of("miert", "valtozott", "valtozas", "csinaljak",
        "tegyek", "erdemes", "osszefugges", "trend", "okozza", "magyarazza");

    /** Explicit user override — always the top gear, no classifier call (spec §2 G3). */
    static final Set<String> DEEPER_LOOK_PHRASES = Set.of("alaposabban", "jobban", "reszletesen", "atgondolva");
    static final Set<String> DEEPER_LOOK_VERBS = Set.of("nezd", "nezzuk", "gondold", "gondoljuk", "vizsgald");

    /**
     * Modal and auxiliary verbs that, when they follow "at", indicate that "at" is NOT part
     * of a phrasal verb but instead a preposition in a grammatical construction.
     */
    static final Set<String> NON_PHRASAL_POST_AT_VERBS = Set.of("kell", "lehet", "szabad", "kene");

    private static final Pattern ISO_DATE = Pattern.compile("(?<!\\d)\\d{4}-\\d{2}-\\d{2}(?!\\d)");
    private static final Pattern WORD_SEPARATOR =
        Pattern.compile("[^\\p{L}\\p{N}]+", Pattern.UNICODE_CHARACTER_CLASS);

    public Optional<TurnGear> analyze(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return Optional.of(TurnGear.CHAT);
        }
        String folded = ToolText.fold(userMessage);
        List<String> words = WORD_SEPARATOR.splitAsStream(folded)
            .filter(word -> !word.isBlank())
            .toList();

        if (isDeeperLookRequest(words)) {
            return Optional.of(TurnGear.ANALYSIS);
        }
        boolean refersToData = words.stream().anyMatch(DOMAIN_WORDS::contains)
            || words.stream().anyMatch(TIME_WORDS::contains)
            || ISO_DATE.matcher(userMessage).find();
        if (!refersToData) {
            return Optional.of(TurnGear.CHAT);
        }
        boolean analysisShape = words.stream().anyMatch(ANALYSIS_WORDS::contains);
        boolean lookupShape = words.stream().anyMatch(LOOKUP_WORDS::contains);
        if (analysisShape) {
            return Optional.of(TurnGear.ANALYSIS);
        }
        if (lookupShape) {
            return Optional.of(TurnGear.LOOKUP);
        }
        // Refers to data but carries no question shape: the rules genuinely cannot tell.
        return Optional.empty();
    }

    private static boolean isDeeperLookRequest(List<String> words) {
        // Check for verb + "at" adjacency (bigram like "gondold at")
        // but exclude cases where a non-phrasal verb follows (e.g., "nezd, at kell..." where
        // "kell" indicates "at" is a preposition, not part of a phrasal verb)
        boolean hasVerbAtBigram = false;
        for (int i = 0; i < words.size() - 1; i++) {
            if (DEEPER_LOOK_VERBS.contains(words.get(i)) && "at".equals(words.get(i + 1))) {
                // Check if the word after "at" is a non-phrasal verb that would indicate
                // "at" is not part of a phrasal verb construction
                if (i + 2 < words.size() && NON_PHRASAL_POST_AT_VERBS.contains(words.get(i + 2))) {
                    // This is not a phrasal verb (e.g., "nézd, at kell mennem...")
                    continue;
                }
                hasVerbAtBigram = true;
                break;
            }
        }

        // Check for multi-word phrases (existing logic: verb + separate phrase)
        boolean hasVerbAndPhrase = words.stream().anyMatch(DEEPER_LOOK_VERBS::contains)
            && words.stream().anyMatch(DEEPER_LOOK_PHRASES::contains);

        return hasVerbAtBigram || hasVerbAndPhrase;
    }
}

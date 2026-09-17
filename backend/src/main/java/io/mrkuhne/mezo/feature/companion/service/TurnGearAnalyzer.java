package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Conservative, deterministic gear routing before any model call — the same shape as
 * {@code MemoryQueryAnalyzer}, and for the same reason: the analyzer, not a model, decides the
 * easy cases, so the common turn costs nothing to classify.
 *
 * <p>An EMPTY result means UNSURE, not CHAT. Resolving it is {@code TurnGearRouter}'s job.
 *
 * <p>Gated on the companion switch for consistency with its only consumer,
 * {@code TurnGearRouter}. The class itself is dependency-free and is also used as a plain object
 * ({@code FakeCompanionLlm}, the fixture guard), which the condition does not affect.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TurnGearAnalyzer {

    /**
     * Word BEGINNINGS that only appear when the user is talking about their own logged data.
     *
     * <p>Hungarian is agglutinative: "súly" arrives as {@code sulyt}, {@code sulyom},
     * {@code sulyommal}, {@code sulyomrol}. An exact-match set therefore misses most real
     * sentences — 19 of the 42 tool-selection eval questions classified as CHAT before this set
     * existed ({@code TurnGearAnalyzerEvalCorpusTest} is the guard). Matching on a prefix costs one
     * thing: an unrelated word that happens to start the same way flips the turn to data-bearing.
     * That direction is the safe one — it spends a heavier gear, it never strips a turn's tools.
     *
     * <p><b>Never add a supplement, medicine or exercise NAME here.</b> "Mit gondolsz a
     * kreatinról?" is a general-knowledge question about a substance, not a question about the
     * user's own log, and it must stay CHAT ({@code TurnGearAnalyzerTest}). Stems shorter than
     * four characters are also kept out — they match half the dictionary; those words live in
     * {@link #DOMAIN_WORDS} instead, matched exactly.
     */
    static final Set<String> DOMAIN_STEMS = Set.of(
        // sleep
        "alvas", "aludt", "alszom", "kipihen", "ebredes", "lefekves",
        // food, meals, pantry, recipes
        "ettem", "etkez", "eves", "kaja", "kaloria", "makro", "feherje", "szenhidrat", "etrend",
        "vacsora", "ebed", "reggeliz", "falat", "adag", "foz", "recept", "kamra", "szekreny",
        "huto", "elelmiszer",
        // body composition
        "suly", "kilo", "fogy", "hiz", "merleg",
        // training
        "edzes", "edzet", "edzo", "ismetl", "sorozat", "rekord", "fut", "guggol", "fekvenyomas",
        // protocols and doses (the user's own course — never the substance's name)
        "protokoll", "kura", "fecskend", "kapszul", "pilul", "tabletta", "gyogyszer",
        "keszitmeny", "beszedt",
        // habits, quests, progression
        "szokas", "kuldetes", "streak", "jelveny", "fejlod",
        // wellbeing and the log itself
        "hidratacio", "kozerzet", "energia", "stressz", "adat", "celj");

    /**
     * Word beginnings that anchor a question to a point in time — a second, independent data
     * signal. {@code het} covers heten/heti/hetre/hetrol/hetemet, {@code nap} covers
     * napon/napja/napi/naponta.
     */
    static final Set<String> TIME_STEMS = Set.of(
        "mai", "het", "nap", "ejjel", "este", "reggel", "delutan", "honap",
        "tegnap", "holnap", "tavaly", "iden",
        "hetfo", "kedd", "szerda", "csutortok", "pentek", "szombat", "vasarnap");

    /** "How much / how many / when" with their suffixed forms — mennyire, hanyadik, mikortol. */
    static final Set<String> LOOKUP_STEMS = Set.of("mennyi", "hany", "mikor", "milyen");

    /** "Why / what changed / what should I do", suffixed forms included. */
    static final Set<String> ANALYSIS_STEMS = Set.of(
        "miert", "valtoz", "csinal", "tegy", "erdemes", "osszefugg", "trend", "okoz", "magyaraz");

    /**
     * Words matched EXACTLY, because they are too short to be safe prefixes ({@code pr},
     * {@code viz} would swallow {@code vizsgald}, {@code cel} would swallow {@code cella}) or
     * because a longer word starting the same way means something else.
     */
    static final Set<String> DOMAIN_WORDS = Set.of(
        "aludtam", "alvas", "alvasom", "alvasomban", "alvasi",
        "ettem", "etkezes", "etkezesem", "kaloria", "makro", "feherje", "szenhidrat", "zsir", "rost",
        "suly", "sulyom", "sulyommal", "kilo", "fogyas", "hizas",
        "edzes", "edzesem", "edzettem", "sorozat", "ismetles", "pr", "rekord",
        "protokoll", "supplement", "gyogyszer", "keszitmeny",
        "szokas", "kuldetes", "streak", "xp", "szint",
        "vizet", "viz", "hidratacio", "kozerzet", "energia", "stressz",
        "recept", "kamra", "cel", "celom", "faradt");

    /** The exactly-matched time words — {@code ma} is two characters and prefixes everything. */
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
        boolean refersToData = matches(words, DOMAIN_WORDS, DOMAIN_STEMS)
            || matches(words, TIME_WORDS, TIME_STEMS)
            || ISO_DATE.matcher(userMessage).find();
        if (!refersToData) {
            return Optional.of(TurnGear.CHAT);
        }
        boolean analysisShape = matches(words, ANALYSIS_WORDS, ANALYSIS_STEMS);
        boolean lookupShape = matches(words, LOOKUP_WORDS, LOOKUP_STEMS);
        if (analysisShape) {
            return Optional.of(TurnGear.ANALYSIS);
        }
        if (lookupShape) {
            return Optional.of(TurnGear.LOOKUP);
        }
        // Refers to data but carries no question shape: the rules genuinely cannot tell.
        return Optional.empty();
    }

    /**
     * A signal fires when any word of the message is in {@code exact}, or BEGINS with one of
     * {@code stems} — the cheap stand-in for a Hungarian stemmer this rule set needs and does not
     * have. Both halves are checked in one pass per word.
     */
    private static boolean matches(List<String> words, Set<String> exact, Set<String> stems) {
        return words.stream().anyMatch(word ->
            exact.contains(word) || stems.stream().anyMatch(word::startsWith));
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

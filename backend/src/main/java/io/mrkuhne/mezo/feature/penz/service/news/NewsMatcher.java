package io.mrkuhne.mezo.feature.penz.service.news;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The deterministic article → holding / macro match of the digest (Boop Pénz L6, mezo-r36n9.104, build notes §3.2).
 * No model decides what is relevant to him: an article counts only when its title or summary names one of his
 * holdings' terms, or a macro term that moves something he owns.
 *
 * <h2>Holding terms ({@link #termsFor})</h2>
 * <ul>
 *   <li>the symbol root ({@code OTP.BD} → {@code OTP}, {@code BTC-USD} → {@code BTC}); an FX pair ({@code =X}) or a
 *       root under 3 characters gives none;</li>
 *   <li>the distinctive words of the name, 3+ characters, minus {@link #GENERIC_WORDS} — legal forms, fund wrappers,
 *       issuers and index families ({@code ETF}, {@code Nyrt}, {@code UCITS}, {@code Vanguard}, {@code MSCI}) and the
 *       broad words {@code world} / {@code világ}, which would match half the business news of a day;</li>
 *   <li>the owner's own {@code newsTerms}, as written.</li>
 * </ul>
 * Cash holdings have no news. Matching is whole-word, case- and diacritic-insensitive; a term of 4+ characters may
 * carry a Hungarian case ending ({@code Richternél}); the symbol root never does ({@code PLDBX} is not {@code PLDB}).
 *
 * <h2>Macro</h2>
 * {@code fx} only when he holds something not in HUF: an exchange-pair term ({@code EUR/HUF}, {@code forintárfolyam}),
 * or {@code forint}/{@code HUF} together with a currency-move word — Hungarian news names forint amounts all the time,
 * so the bare word is not enough. {@code rates} only when he holds a bond: {@code MNB}, {@code alapkamat},
 * {@code kamatdöntés}, {@code interest rate}, …
 *
 * <h2>Window</h2>
 * The last {@link #WINDOW} (36 h); an undated article never matches (its age is unknown).
 */
public final class NewsMatcher {

    public static final Duration WINDOW = Duration.ofHours(36);
    /** Clock skew tolerated on a feed's publication stamp. */
    private static final Duration FUTURE_SKEW = Duration.ofMinutes(10);

    static final Set<String> GENERIC_WORDS = Set.of(
        "etf", "etc", "etn", "bank", "plc", "nyrt", "zrt", "inc", "ucits", "acc", "dist", "class", "fund", "alap",
        "befektetesi", "index", "world", "vilag", "all", "the", "and", "ltd", "corp", "group", "holding", "holdings",
        "usd", "eur", "huf", "gbp", "chf", "msci", "ftse", "stoxx", "core", "global", "emerging", "markets", "market",
        "equity", "bond", "bonds", "government", "treasury", "magyar", "allampapir", "kotveny", "premium", "plusz",
        "bonusz", "reszveny", "vanguard", "ishares", "xtrackers", "amundi", "spdr", "invesco", "lyxor", "portfolio",
        "growth", "value", "dividend", "total", "international", "europe", "european", "usa", "america", "tech",
        "technology", "energy", "fix", "kamatozasu", "allam");

    private static final Set<String> CRYPTO_QUOTE_SUFFIXES = Set.of("USD", "EUR", "HUF", "GBP", "USDT", "USDC");

    private static final List<String> FX_PAIR_TERMS = List.of(
        "eur/huf", "eurhuf", "usd/huf", "usdhuf", "chf/huf", "gbp/huf", "forintarfolyam", "devizaarfolyam",
        "euro-forint", "euro–forint");
    private static final List<String> FX_CURRENCY_TERMS = List.of("forint", "huf");
    private static final List<String> FX_MOVE_TERMS = List.of(
        "arfolyam", "erosod", "gyengul", "exchange rate", "currency", "weaken", "strengthen",
        "firm", "slid", "slump", "rall", "depreciat", "appreciat");
    private static final List<String> RATES_TERMS = List.of(
        "mnb", "jegybank", "alapkamat", "kamatdontes", "monetaris tanacs", "kamatcsokkentes", "kamatemeles",
        "iranyado kamat", "kamatszint", "interest rate", "rate decision", "rate cut", "rate hike", "base rate");

    private NewsMatcher() {
    }

    /** The holding's match terms in display case (symbol root, name words, news terms), de-duplicated. */
    public static List<String> termsFor(NewsHolding h) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        if ("cash".equals(h.assetType())) {
            return out;
        }
        String root = symbolRoot(h.symbol());
        if (root != null) {
            add(out, seen, root);
        }
        if (h.name() != null) {
            for (String word : h.name().split("[^\\p{L}\\p{N}]+")) {
                String folded = NewsText.fold(word);
                if (folded.length() >= 3 && !folded.chars().allMatch(Character::isDigit)
                    && !GENERIC_WORDS.contains(folded)) {
                    add(out, seen, word);
                }
            }
        }
        for (String t : h.newsTerms()) {
            if (t != null && NewsText.fold(t).length() >= 2) {
                add(out, seen, t.strip());
            }
        }
        return out;
    }

    private static void add(List<String> out, Set<String> seen, String term) {
        if (seen.add(NewsText.fold(term))) {
            out.add(term);
        }
    }

    /** {@code OTP.BD} → {@code OTP}; {@code BTC-USD} → {@code BTC}; {@code EURHUF=X} or a short root → null. */
    static String symbolRoot(String symbol) {
        if (symbol == null || symbol.isBlank() || symbol.contains("=")) {
            return null;
        }
        String s = symbol.strip().toUpperCase(java.util.Locale.ROOT);
        int dot = s.indexOf('.');
        if (dot >= 0) {
            s = s.substring(0, dot);
        }
        int dash = s.lastIndexOf('-');
        if (dash > 0 && CRYPTO_QUOTE_SUFFIXES.contains(s.substring(dash + 1))) {
            s = s.substring(0, dash);
        }
        return s.length() >= 3 && s.chars().allMatch(Character::isLetterOrDigit) ? s : null;
    }

    /**
     * The candidates per key, in holding order then {@code fx}, {@code rates}; keys with no article are left out. An
     * article may count for several keys (a story naming two holdings, or a holding and the forint).
     */
    public static Map<StoryKey, List<NewsArticle>> match(List<NewsArticle> articles, List<NewsHolding> holdings,
                                                         Instant now) {
        Map<StoryKey, List<NewsArticle>> out = new LinkedHashMap<>();
        List<NewsArticle> recent = articles.stream()
            .filter(a -> a.publishedAt() != null
                && !a.publishedAt().isBefore(now.minus(WINDOW))
                && !a.publishedAt().isAfter(now.plus(FUTURE_SKEW)))
            .toList();
        for (NewsHolding h : holdings) {
            List<String> terms = termsFor(h).stream().map(NewsText::fold).toList();
            if (terms.isEmpty()) {
                continue;
            }
            String root = symbolRoot(h.symbol());
            String foldedRoot = root == null ? null : NewsText.fold(root);
            List<NewsArticle> hits = recent.stream()
                .filter(a -> terms.stream().anyMatch(t -> NewsText.containsTerm(text(a), t, !t.equals(foldedRoot))))
                .toList();
            if (!hits.isEmpty()) {
                out.merge(StoryKey.holding(h.id()), new ArrayList<>(hits), (x, y) -> {
                    x.addAll(y);
                    return x;
                });
            }
        }
        boolean foreign = holdings.stream().anyMatch(NewsHolding::isForeignCurrency);
        if (foreign) {
            List<NewsArticle> fx = recent.stream().filter(NewsMatcher::isFx).toList();
            if (!fx.isEmpty()) {
                out.put(StoryKey.fx(), fx);
            }
        }
        boolean bond = holdings.stream().anyMatch(NewsHolding::isBond);
        if (bond) {
            List<NewsArticle> rates = recent.stream()
                .filter(a -> RATES_TERMS.stream().anyMatch(t -> NewsText.containsTerm(text(a), t, true)))
                .toList();
            if (!rates.isEmpty()) {
                out.put(StoryKey.rates(), rates);
            }
        }
        return out;
    }

    static boolean isFx(NewsArticle a) {
        String t = text(a);
        if (FX_PAIR_TERMS.stream().anyMatch(p -> NewsText.containsTerm(t, p, true))) {
            return true;
        }
        return FX_CURRENCY_TERMS.stream().anyMatch(c -> NewsText.containsTerm(t, c, true))
            && FX_MOVE_TERMS.stream().anyMatch(w -> NewsText.containsStem(t, w));
    }

    private static String text(NewsArticle a) {
        return NewsText.fold((a.title() == null ? "" : a.title()) + " " + (a.summary() == null ? "" : a.summary()));
    }
}

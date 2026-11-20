package io.mrkuhne.mezo.feature.penz.service.news;

/**
 * The fixed Hungarian copy of the digest (Boop Pénz L6, mezo-r36n9.104): the {@code effectNote} under every figure,
 * and the honest stand-in for an item whose narration failed validation or never came (model down). The stand-in
 * says plainly that Boop could not summarise the story reliably, names how many sources wrote about it, sets
 * confidence to 0, and still gives a <b>per-item</b> reason why there is nothing to do — a 10+ year holding, a
 * 1–3 year one and a currency move are left alone for different reasons (spec §5.6: one sentence for all is a lie).
 * Every string here follows the §6 boundaries and passes {@link DigestValidator} (counts are written in words).
 */
public final class DigestFallbackCopy {

    public static final String NOTE_HOLDING = "a te részeden";
    public static final String NOTE_FX = "forintban mérve";
    public static final String NOTE_RATES_UNCHANGED = "változatlan hozam";
    public static final String NOTE_RATES = "a kamatozó részeden";

    static final String VERDICT =
        "Most nem tudtam megbízhatóan összefoglalni ezt a hírt, ezért nem írok róla saját olvasatot.";
    static final String UNCERTAINTY =
        "Ez nem elemzés: a forrásokat most nem tudtam megbízhatóan összeolvasni, ezért csak megmutatom őket. "
            + "A forintösszeg a te tételeidből számolt tény, a miértje viszont a cikkekben van, és azt nem ellenőriztem.";

    static final String NO_ACTION_LONG =
        "Ez a pénz 10+ évre szól: egy napi hír nem ok a lépésre, és nem is küldelek sehova.";
    static final String NO_ACTION_MID =
        "Ez a rész 5–10 évre szól, a terve egy hírtől nem változik — nincs vele most teendőd.";
    static final String NO_ACTION_SHORT =
        "Ez a rövid távú rész a saját menetrendje szerint fut tovább; egy hír miatt nem kell hozzányúlnod.";
    static final String NO_ACTION_HOLDING =
        "Egy hír önmagában nem ok a lépésre; a tételed úgy fut tovább, ahogy eddig.";
    static final String NO_ACTION_FX =
        "Árfolyammozgás, nem befektetési esemény: ha a forint visszafordul, a különbség magától visszajön.";
    static final String NO_ACTION_RATES =
        "A kamatdöntés tájékoztatás: a kamatozó papírjaid a saját feltételeik szerint futnak tovább.";

    private static final String[] COUNT_WORDS = {"nulla", "egy", "két", "három", "négy", "öt", "hat"};

    private DigestFallbackCopy() {
    }

    /** What the effect figure is measured on (fixed copy, never the model's). */
    public static String effectNote(DigestKind kind, long effectHufMinor) {
        return switch (kind) {
            case HOLDING -> NOTE_HOLDING;
            case FX -> NOTE_FX;
            case RATES -> effectHufMinor == 0 ? NOTE_RATES_UNCHANGED : NOTE_RATES;
        };
    }

    /** {@code <ledger name>: friss hír} / {@code Forintárfolyam: friss hír} / {@code Kamatok: friss hír}. */
    public static String title(DigestKind kind, String holdingName) {
        return switch (kind) {
            case HOLDING -> (holdingName == null || holdingName.isBlank() ? "A tételed" : holdingName.strip())
                + ": friss hír";
            case FX -> "Forintárfolyam: friss hír";
            case RATES -> "Kamatok: friss hír";
        };
    }

    public static String verdict() {
        return VERDICT;
    }

    /** Names how many sources wrote about it, in words (one … six). */
    public static String body(int sourceCount) {
        String sources = sourceCount <= 1
            ? "Egy forrás írt róla"
            : capitalize(countWord(sourceCount)) + " forrás írt róla";
        return sources + "; a címeket és a linkeket lent találod. Most nem tudtam megbízhatóan összefoglalni, mit "
            + "jelent, ezért inkább nem írok róla saját olvasatot, mint hogy félrevezesselek.";
    }

    public static String uncertainty() {
        return UNCERTAINTY;
    }

    /** The per-kind / per-sleeve reason why there is nothing to do. */
    public static String noAction(DigestKind kind, String sleeve) {
        return switch (kind) {
            case FX -> NO_ACTION_FX;
            case RATES -> NO_ACTION_RATES;
            case HOLDING -> {
                if ("long".equals(sleeve)) {
                    yield NO_ACTION_LONG;
                }
                if ("mid".equals(sleeve)) {
                    yield NO_ACTION_MID;
                }
                if ("short".equals(sleeve)) {
                    yield NO_ACTION_SHORT;
                }
                yield NO_ACTION_HOLDING;
            }
        };
    }

    private static String countWord(int n) {
        return n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : "több";
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}

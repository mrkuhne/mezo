package io.mrkuhne.mezo.feature.penz.service.news;

/**
 * The fixed Hungarian copy of the weekly long-horizon review (mezo-r36n9.120): the honest stand-in for a section whose
 * narration failed validation or never came, and the quiet copy of a sleeve no story touched this week. The stand-in
 * says plainly that Boop could not summarise the week reliably, names how many stories touched the sleeve (in words,
 * like {@link DigestFallbackCopy}) and still gives a <b>per-sleeve</b> reason why there is nothing to do — 10+ years,
 * 5–10 years and 1–3 years are left alone for different reasons. Every string follows the §6 boundaries and passes
 * {@link WeeklyReviewValidator}.
 */
public final class WeeklyReviewFallbackCopy {

    static final String VERDICT =
        "Ezt a hetet most nem tudtam megbízhatóan összefoglalni, ezért nem írok róla saját olvasatot.";
    static final String UNCERTAINTY =
        "Ez nem elemzés: a hét híreit most nem tudtam megbízhatóan összeolvasni, ezért csak megmutatom őket. "
            + "Hogy valamelyik tartósan számít-e, azt nem ellenőriztem.";

    static final String QUIET_VERDICT = "Ezen a héten nem jelent meg hír, ami ezt a részt érintette volna.";
    static final String QUIET_BODY =
        "Csendes hét volt ennél a résznél: a napi összefoglalókba nem került róla történet, így nincs mit mérlegelnem.";
    static final String QUIET_UNCERTAINTY =
        "Csak azokat a híreket látom, amik a napi összefoglalókba bekerültek; ami onnan kimaradt, arról nem tudok.";

    static final String NO_ACTION_LONG =
        "Ez a pénz 10+ évre szól: a terve évtizedekben gondolkodik, egy hét hírei nem írják át — nincs vele teendőd.";
    static final String NO_ACTION_MID =
        "Ez a rész 5–10 évre szól; a terve egy hét alatt nem változik, nincs vele most teendőd.";
    static final String NO_ACTION_SHORT =
        "Ez a rövid távú, 1–3 éves rész a saját menetrendje szerint fut; egy hét hírei miatt nem kell hozzányúlnod.";

    private static final String[] COUNT_WORDS = {"nulla", "egy", "két", "három", "négy", "öt", "hat"};

    private WeeklyReviewFallbackCopy() {
    }

    public static String verdict() {
        return VERDICT;
    }

    /** Names how many stories touched the sleeve, in words (one … six, then "hatnál több"). */
    public static String body(int storyCount) {
        String count = storyCount <= 1 ? "Egy hír" : storyCount < COUNT_WORDS.length
            ? capitalize(COUNT_WORDS[storyCount]) + " hír" : "Hatnál több hír";
        return count + " érintette ezt a részt a héten; a címeket és a forrásokat lent találod. Most nem tudtam "
            + "megbízhatóan összeolvasni, mit jelentenek hosszabb távon, ezért inkább nem írok róluk saját olvasatot, "
            + "mint hogy félrevezesselek.";
    }

    public static String uncertainty() {
        return UNCERTAINTY;
    }

    public static String quietVerdict() {
        return QUIET_VERDICT;
    }

    public static String quietBody() {
        return QUIET_BODY;
    }

    public static String quietUncertainty() {
        return QUIET_UNCERTAINTY;
    }

    /** The per-sleeve reason why there is nothing to do (fallback and quiet alike). */
    public static String noAction(String sleeve) {
        return switch (sleeve == null ? "" : sleeve) {
            case "long" -> NO_ACTION_LONG;
            case "mid" -> NO_ACTION_MID;
            default -> NO_ACTION_SHORT;
        };
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}

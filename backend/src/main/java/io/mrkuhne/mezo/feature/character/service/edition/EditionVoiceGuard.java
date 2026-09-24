package io.mrkuhne.mezo.feature.character.service.edition;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A tény-őr (Task 12, csapatfal II. spec 2026-09-24 §3.4): eldönti, hogy egy karakterhangon írt
 * poszt kimehet-e a falra. Tiszta függvény, állapot nélkül — a modell kimenetét soha nem javítja,
 * csak MINŐSÍTI; a bukás következménye a hívónál ({@link EditionVoiceWriter}) az, hogy a poszt a
 * nyers rekordszöveggel és {@code voiced=false}-szal jelenik meg (ADR 0049: inkább száraz, mint
 * kitalált).
 *
 * <p>Négy szabály, ebben a sorrendben:
 * <ol>
 *   <li><b>{@value #NUMBER}</b> — a szövegben csak olyan szám állhat, ami a jelölt {@code facts}
 *       listájában vagy a rekord szövegében is szerepel (a tizedesvessző ponttá normalizálva, így a
 *       „7,5 óra" ugyanaz, mint a rekord „7.5 óra"-ja). Ez az egyetlen szabály, ami a
 *       hallucinációt közvetlenül fogja meg.</li>
 *   <li><b>{@value #SENTENCES}</b> — 2–4 mondat (a mondathatár mondatvégi írásjel + szóköz/vég,
 *       ezért a „7.5" NEM mondathatár).</li>
 *   <li><b>{@value #EMOJI}</b> — minden emoji a karakter saját készletéből; a Szkeptikusnak egy
 *       sem jár.</li>
 *   <li><b>{@value #JARGON}</b> — a hangkönyv tiltólistája (spec §2/7). A „deficit" szándékosan
 *       NINCS benne: a magyar köznyelvben él.</li>
 * </ol>
 */
public final class EditionVoiceGuard {

    public static final String NUMBER = "number";
    public static final String SENTENCES = "sentences";
    public static final String EMOJI = "emoji";
    public static final String JARGON = "jargon";

    private static final int MIN_SENTENCES = 2;
    private static final int MAX_SENTENCES = 4;

    private static final Pattern NUMBERS = Pattern.compile("\\d+(?:[.,]\\d+)?");

    /** Mondathatár: mondatvégi írásjel(ek), amit szóköz vagy a szöveg vége követ — a tizedespont
     *  („7.5") így nem vág mondatot. */
    private static final Pattern SENTENCE_BREAK = Pattern.compile("[.!?…]+(?=\\s|$)");

    /** Emoji-grafém: piktografikus kódpont vagy egyéb szimbólum. A variációs szelektort (U+FE0F)
     *  és a ZWJ-t (U+200D) előbb leválasztjuk, így a „🍽️" a bázis „🍽"-ként mérkőzik a készlettel. */
    private static final Pattern EMOJI_CHAR = Pattern.compile("[\\p{IsExtended_Pictographic}\\p{So}]");

    private static final char VARIATION_SELECTOR = '️';
    private static final char ZERO_WIDTH_JOINER = '‍';

    /** Szaknyelv-tiltólista (spec §2/7 + a tutorial hang-lint töve), kisbetűs részsztring-egyezés. */
    static final List<String> FORBIDDEN = List.of(
            "intake", "7-day", "korreláció", "szignifikáns", "p-érték", "r=", "±", "baseline", "trend line");

    private EditionVoiceGuard() {
    }

    /**
     * @return üres, ha a szöveg kimehet; különben a bukás oka ({@value #NUMBER},
     *         {@value #SENTENCES}, {@value #EMOJI}, {@value #JARGON}).
     */
    public static Optional<String> check(TeamCharacter who, String body, List<String> facts, String recordText) {
        if (body == null || body.isBlank()) {
            return Optional.of(SENTENCES);
        }
        Optional<String> content = checkTitle(who, body, facts, recordText);
        if (content.isPresent()) {
            return content;
        }
        int sentences = sentenceCount(body);
        return sentences < MIN_SENTENCES || sentences > MAX_SENTENCES ? Optional.of(SENTENCES) : Optional.empty();
    }

    /**
     * Ugyanaz a három tartalmi szabály a mondatszám NÉLKÜL — ez a CÍM őre: egy cím egyetlen
     * töredék, a 2–4 mondatos szabály értelmetlen rá, de a kitalált szám, az idegen emoji és a
     * szaknyelv ott is ugyanúgy tilos (a fal a címet is kiírja).
     *
     * @return üres, ha a cím kimehet; különben {@value #NUMBER}, {@value #EMOJI} vagy {@value #JARGON}.
     */
    public static Optional<String> checkTitle(TeamCharacter who, String text, List<String> facts, String recordText) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Set<String> allowed = numbersIn(String.join(" ", facts == null ? List.of() : facts)
                + " " + (recordText == null ? "" : recordText));
        for (String number : numbersIn(text)) {
            if (!allowed.contains(number)) {
                return Optional.of(NUMBER);
            }
        }
        Matcher emoji = EMOJI_CHAR.matcher(stripJoiners(text));
        while (emoji.find()) {
            if (!who.emoji().contains(emoji.group())) {
                return Optional.of(EMOJI);
            }
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String word : FORBIDDEN) {
            if (lower.contains(word)) {
                return Optional.of(JARGON);
            }
        }
        return Optional.empty();
    }

    /** A szöveg számai, tizedesvesszővel-ponttal egységesítve. */
    private static Set<String> numbersIn(String text) {
        Set<String> out = new HashSet<>();
        Matcher matcher = NUMBERS.matcher(text);
        while (matcher.find()) {
            out.add(matcher.group().replace(',', '.'));
        }
        return out;
    }

    private static int sentenceCount(String body) {
        return (int) SENTENCE_BREAK.splitAsStream(body).filter(part -> !part.isBlank()).count();
    }

    private static String stripJoiners(String body) {
        return body.replace(String.valueOf(VARIATION_SELECTOR), "")
                .replace(String.valueOf(ZERO_WIDTH_JOINER), "");
    }
}

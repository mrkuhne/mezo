package io.mrkuhne.mezo.feature.character.service.edition;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Az 5 boop + a Szkeptikus (spec 2026-09-24 §3.4). A FE `logic/team.ts` tükre — a két tábla
 *  eset-listáját a TeamCharacterTest és a team.test.ts ugyanúgy rögzíti.
 *
 *  <p>H3 (mezo-a9bo7.14) óta a hang is itt él: a megjelenített név, a terület, a saját
 *  emoji-készlet és egy mondatba sűrített hang-szabály (hangnem + tiltás) a
 *  {@code docs/features/insights.md} §2.0a hangkönyvéből. Ez a négyes a generátor-prompt
 *  karakter-blokkjának ({@link EditionVoiceWriter}) és a tény-őrnek ({@link EditionVoiceGuard})
 *  a bemenete: a nevek FE-n a MEGJELENÍTÉSÉRT, itt a HANGÉRT élnek.
 *
 *  <p>Az emoji-készlet a BÁZIS kódpontokat tárolja, variációs szelektor (U+FE0F) NÉLKÜL — a
 *  {@link EditionVoiceGuard} ugyanígy normalizálja a generált szöveget, így a „🍽️" és a „🍽"
 *  ugyanaz az emoji. */
public enum TeamCharacter {

    SZUNYA("Szunya", "alvás", Set.of("🌙"),
            "Nyugodt, kicsit titokzatos éjszakai figyelő: az időzítést veszed észre, nem az összeget, "
                    + "és soha nem korholsz a lefekvés miatt."),
    MOCOR("Mocor", "mozgás", Set.of("⚡", "💪"),
            "Energikus, de nem hajcsár: a terhelést, a változatosságot és a naplózási fegyelmet nézed — "
                    + "a nyomulás és a bűntudatkeltés tilos."),
    FALAT("Falat", "étkezés", Set.of("🍽", "🥦", "🍳"),
            "Kíváncsi ínyenc: tányért soha nem pontozol, azt keresed, ami bevált, hogy megismételhető legyen."),
    DERU("Derű", "közérzet", Set.of("🌤"),
            "Meleg hangú és a legadatéhesebb: a saját szavait kéred egy-egy rövid bejelentkezésben, "
                    + "és korán szólsz, ha valami mozgatja a közérzetét."),
    MEZO("Mezo", "a csapat", Set.of("📔", "✅", "👋", "🔍"),
            "Az arany házigazda: te hívod össze a konzíliumot és elmagyarázod, hogyan tanul a csapat — "
                    + "kioktatás és tananyag nélkül."),
    SZKEPTIKUS("Szkeptikus", "", Set.of(),
            "Száraz, emoji nélküli ellenhang: mindig a másik magyarázatot kínálod — a falra soha nem posztolsz.");

    private static final Map<String, TeamCharacter> PERSONA = Map.of(
            "szomnologus", SZUNYA, "edzo", MOCOR, "drill", MOCOR, "taplalkozo", FALAT,
            "pszichologus", DERU, "doki", DERU, "antropologus", MEZO, "mezo", MEZO, "szkeptikus", SZKEPTIKUS);
    private static final Map<String, TeamCharacter> DOMAIN = Map.of(
            "sleep", SZUNYA, "train", MOCOR, "fuel", FALAT, "mind", DERU, "body", DERU, "other", MEZO);

    private final String displayName;
    private final String area;
    private final Set<String> emoji;
    private final String voice;

    TeamCharacter(String displayName, String area, Set<String> emoji, String voice) {
        this.displayName = displayName;
        this.area = area;
        this.emoji = emoji;
        this.voice = voice;
    }

    public String key() { return name().toLowerCase(Locale.ROOT); }
    public boolean postable() { return this != SZKEPTIKUS; }
    /** A karakter neve úgy, ahogy a falon megjelenik (a FE `TEAM[…].name` tükre). */
    public String displayName() { return displayName; }
    /** A terület, amiért felel — a Szkeptikusnak nincs, ezért üres. */
    public String area() { return area; }
    /** A karakter SAJÁT emoji-készlete, bázis kódpontokként (U+FE0F nélkül). */
    public Set<String> emoji() { return emoji; }
    /** A hangja egy mondatban: hangnem + tiltás (hangkönyv, `insights.md` §2.0a). */
    public String voice() { return voice; }

    public static TeamCharacter forPersona(String expertKey) { return PERSONA.getOrDefault(expertKey, MEZO); }
    public static TeamCharacter forMetricDomain(String domain) { return DOMAIN.getOrDefault(domain, MEZO); }
    public static TeamCharacter postableOr(TeamCharacter c) { return c.postable() ? c : MEZO; }
}

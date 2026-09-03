package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * The profiling team (Karakter spec §3): 7 named domain experts, each the owner of one CORE
 * dimension. The persona text is the expert's SYSTEM-prompt voice for the nightly observation
 * pass (S2); the konzílium (S3) reuses these same personas. Mezo (integrátor) stays out of this
 * catalog; the Szkeptikus is an S3 verdict role AND, since round 4, the observer/proposer of the
 * META dimension — it lives here as {@link #SKEPTIC}, deliberately outside {@link #EXPERTS} so
 * the Csapat page and the maturity ring keep their seven-expert shape.
 */
public final class CharacterExpertCatalog {

    /**
     * {@code role}, {@code voiceLine} and {@code watch} are the user-facing Csapat-page copy —
     * VERBATIM from the design prototype's {@code CSAPAT} array
     * ({@code docs/design_2.0/prototypes/src/karakter-body.html}). {@code systemPersona} stays the
     * separate LLM-facing text; the two are deliberately not derived from one another.
     */
    public record Expert(String key, String displayName, String primaryDimensionKey,
                         String systemPersona, String role, String voiceLine, List<String> watch) {}

    public static final List<Expert> EXPERTS = List.of(
            new Expert("doki", "Doki", "physical", """
                    Te vagy Doki, {{NÉV}} profilozó csapatának orvos szakértője. Tárgyilagos, \
                    orvosi hangon fogalmazol, röviden. A testkompozíciót, egészségjeleket, \
                    súlytrendet és a gyógyszerciklus jeleit figyeled. Sosem diagnosztizálsz, \
                    csak megfigyelsz; érzékeny témát tükörként, kérdésként fogalmazol meg.""",
                    "orvos", "Tárgyilagos, orvosi hangon, röviden fogalmaz.",
                    List.of("testkompozíció, egészségjelek", "súlytrend", "gyógyszerciklus jelei")),
            new Expert("edzo", "Edző", "athletic", """
                    Te vagy az Edző, {{NÉV}} profilozó csapatának sportszakértője. Direkt vagy, \
                    számokban beszélsz. Az edzésprofilt, erősségeket-gyengeségeket, RIR-kalibrációt \
                    és a niggle-mintázatokat figyeled.""",
                    "edzés", "Direkt, számokban beszél.",
                    List.of("edzésprofil, erősségek-gyengeségek", "RIR-kalibráció", "niggle-mintázatok")),
            new Expert("taplalkozo", "Táplálkozó", "nutrition", """
                    Te vagy a Táplálkozó, {{NÉV}} profilozó csapatának táplálkozási szakértője. \
                    Gyakorlatias és ítélkezésmentes vagy. Az étkezési mintákat, a kajához való \
                    viszonyt és a logolt vs valós bevitel eltéréseit figyeled.""",
                    "táplálkozás", "Gyakorlatias, ítélkezésmentes.",
                    List.of("étkezési minták", "kajához való viszony", "logolt vs valós bevitel eltérése")),
            new Expert("szomnologus", "Szomnológus", "recovery", """
                    Te vagy a Szomnológus, {{NÉV}} profilozó csapatának alvás- és regenerációs \
                    szakértője. Halk, precíz hangon írsz. Az alvásminőséget, ritmust és a \
                    regenerációs jeleket figyeled.""",
                    "alvás & regeneráció", "Halk, precíz hangon ír.",
                    List.of("alvásminőség és -ritmus", "regenerációs jelek")),
            new Expert("pszichologus", "Pszichológus", "mental", """
                    Te vagy a Pszichológus, {{NÉV}} profilozó csapatának mentális szakértője. \
                    Meleg, kérdező hangon írsz. Hangulati mintázatokat, stresszorokat és a napló \
                    érzelmi jeleit figyeled. Érzékeny megfigyelést mindig tükörként, sosem \
                    diagnózisként fogalmazol meg.""",
                    "mentális", "Meleg, kérdező hangon ír.",
                    List.of("hangulati mintázatok", "stresszorok", "a napló érzelmi jelei")),
            new Expert("drill", "Drill", "discipline", """
                    Te vagy Drill, {{NÉV}} profilozó csapatának fegyelem-szakértője. Szigorú de \
                    fair hangon írsz. A logolási fegyelmet, kihagyásokat, streak-viselkedést és \
                    az ígéret–teljesítés rést figyeled. Sosem szégyenítesz.""",
                    "fegyelem", "Szigorú, de fair — sosem szégyenít.",
                    List.of("logolási fegyelem, kihagyások", "streak-viselkedés", "ígéret–teljesítés rés")),
            new Expert("antropologus", "Antropológus", "life", """
                    Te vagy az Antropológus, {{NÉV}} profilozó csapatának élet- és \
                    kapcsolat-szakértője. Megfigyelő, narratív hangon írsz. Életeseményeket, \
                    embereket, hétköznap–hétvége mintákat és kontextust figyelsz.""",
                    "élet & kapcsolatok", "Megfigyelő, narratív hangon ír.",
                    List.of("életesemények, emberek", "hétköznap–hétvége minták", "kontextus")));

    /** The Szkeptikus as OBSERVER and PROPOSER of the META dimension (round-4 spec §4.2). Its
     *  verdict-round persona lives in {@code KonziliumVerdictRound}; this persona is the one that
     *  writes observations from the szkeptikus-owned detectors and proposes self-audit claims.
     *  {@code role}/{@code voiceLine}/{@code watch} are the Csapat-page copy, verbatim from
     *  {@code CharacterService.experts()} as it stood before round 4. */
    public static final Expert SKEPTIC = new Expert("szkeptikus", "Szkeptikus", "self-audit", """
            Te vagy a Szkeptikus, {{NÉV}} profilozó csapatának kritikus tagja. Száraz, tárgyilagos \
            hangon írsz. Most a társ önvizsgálatát írod: a jelek Mezo saját javaslatainak, \
            predikcióinak és questjeinek találati arányáról szólnak. Mindig a rendszerről állíts, \
            sosem a felhasználó ({{NÉV}}) tulajdonságáról — egy elutasított javaslat a javaslat minőségéről szól, \
            nem arról, aki elutasította. A Tudástár-döntéseket tükörként, ÉRZÉKENY jelöléssel \
            fogalmazd, sosem ítélkezve.""",
            "Szkeptikus", "Száraz kontrás hang.",
            List.of("minden javaslatot megtámad, mielőtt a dossziéba kerül — gyenge "
                    + "bizonyíték, túlzott általánosítás, egy adatpontból levont következtetés."));

    public static Expert byKey(String key) {
        if (SKEPTIC.key().equals(key)) {
            return SKEPTIC;
        }
        return EXPERTS.stream().filter(e -> e.key().equals(key)).findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_UNKNOWN_EXPERT").build(), HttpStatus.INTERNAL_SERVER_ERROR));
    }

    private CharacterExpertCatalog() {}
}

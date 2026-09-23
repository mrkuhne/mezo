package io.mrkuhne.mezo.feature.proactive.service;

/** Per-kind editorial purpose; deterministic delivery rules remain in the callers. */
public final class FeedMessagePrompts {
    private FeedMessagePrompts() { }
    public static String task(String kind) {
        return switch (kind) {
            case "morning" -> "Készíts fel a mai napra az aktuális helyzet és előzmények alapján. "
                    + "Ne sorold fel az irreleváns adathiányokat; régi alvást vagy súlyt ne állíts frissnek.";
            case "weight" -> "A most rögzített súlyt értelmezd a méréssor és korábbi beszélgetések tükrében. "
                    + "Különítsd el a nyers értéket, a simítást és a pontos időablakhoz tartozó irányt.";
            case "sleep" -> "Az épp rögzített éjszakát kapcsold az alvás előzményeihez, a mai terheléshez "
                    + "és releváns élethelyzethez; különítsd el a tervet a teljesített edzéstől.";
            case "midday" -> "Kövesd a reggeli szándékok és a mai események alakulását. "
                    + "A hiányzó napló nem mulasztás; ne ismételd meg a reggeli tanácsot változatlanul.";
            case "evening" -> "Vedd észre, mi történt és mi változott a nap folyamán. "
                    + "Ne ítéld lezártnak azt, ami még folyamatban van.";
            case "people" -> "A megadott heti emberkép legyen a kiinduló megfigyelés. "
                    + "Az említés hiánya nem bizonyít elhanyagolt kapcsolatot. Kapcsolódj releváns előzményhez.";
            case "advice" -> "A kiválasztott TÉNYEK és JAVASLATOK alapján személyesítsd a tanácsot. "
                    + "Más terület segíthet megérteni, de új teendőt vagy végrehajtható műveletet ne találj ki. "
                    + "Számjegyek nélkül fogalmazz: a pontos számok a kártya ténylistájában láthatók. "
                    + "Gyógyszeradag módosítását ne javasold.";
            case "hydration" -> "A hidratációs ellenőrzés naplózott mennyiségeit értelmezd a napban. "
                    + "A napló nem a biztosan megivott teljes mennyiség. Ne ismételj közeli napi üzenetet.";
            default -> throw new IllegalArgumentException("Unsupported feed kind: " + kind);
        };
    }
}

package io.mrkuhne.mezo.feature.penz.service.news;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Invented holdings, stories and model answers for the digest tests (mezo-r36n9.104). No real holding or money. */
final class DigestFixtures {

    static final Instant NOW = Instant.parse("2026-11-20T06:30:00Z");

    static final UUID WORLD_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    static final UUID PELDA_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
    static final UUID BOND_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a3");

    static final NewsHolding WORLD = new NewsHolding(WORLD_ID, "Mintavilág ETF", "MNTW.DE", "EUR", "etf", "long",
        List.of());
    static final NewsHolding PELDA = new NewsHolding(PELDA_ID, "Példabank Nyrt", "PLDB.BD", "HUF", "stock", "mid",
        List.of());
    static final NewsHolding BOND = new NewsHolding(BOND_ID, "Kitalált Kötvény 2031/A", null, "HUF", "bond", "short",
        List.of());
    static final List<NewsHolding> HOLDINGS = List.of(WORLD, PELDA, BOND);

    /** The world-ETF story: −18 400 Ft, −1,1%, worth 1 240 000 Ft, 10+ év. */
    static final DigestFigures WORLD_FIGURES = new DigestFigures(DigestKind.HOLDING, "long", -1_840_000L,
        new BigDecimal("-1.12"), 124_000_000L);
    static final DigestFigures FX_FIGURES = new DigestFigures(DigestKind.FX, null, -720_000L, new BigDecimal("-0.6"),
        null);
    static final DigestFigures RATES_FIGURES = new DigestFigures(DigestKind.RATES, null, 0L, null, null);

    static final String GOOD_TITLE = "A világ-ETF-ed 1,1%-ot csökkent";
    static final String GOOD_VERDICT = "Egy rövid mozgás a 10+ éves pénznél nem jelent sokat: a te részeden 18 400 Ft.";
    static final String GOOD_BODY = "A mozgás a kamatvárakozások átárazódásából jött, nem egyetlen cégből.\n\n"
        + "Az alapod a piaccal együtt mozgott, ahogy ilyenkor szokott. *Ezt a számot a te tételeidből számoltuk.*";
    static final String GOOD_UNCERTAINTY = "Az ár tény, a miértje elemzői értelmezés, és a források sem értenek egyet.";
    static final String GOOD_NO_ACTION = "Ez a pénz 10+ évre szól; egy rövid mozgás nem ok a lépésre.";

    private DigestFixtures() {
    }

    static NewsArticle article(String n, String source, String title, String summary) {
        return new NewsArticle("https://www.cnbc.com/" + n, source, title, summary, NOW.minusSeconds(3600));
    }

    static DigestStory worldStory(String body) {
        NewsArticle a = article("w1", "Példa Hírek", "Global equities slip on rate outlook", "Stocks fell.");
        Story s = new Story("holding-aaaaaaaaaa", StoryKey.holding(WORLD_ID), List.of(a), 1);
        return new DigestStory(s, WORLD.name(), WORLD_FIGURES, body == null ? Map.of() : Map.of(a.url(), body));
    }

    static DigestStory fxStory() {
        NewsArticle a = article("f1", "Minta Napló", "Erősödött a forint", null);
        NewsArticle b = article("f2", "Másik Lap", "Forint firms against euro", null);
        Story s = new Story("fx-bbbbbbbbbb", StoryKey.fx(), List.of(a, b), 2);
        return new DigestStory(s, null, FX_FIGURES, Map.of());
    }

    static DigestStory ratesStory() {
        NewsArticle a = article("r1", "Példa Hírek", "A jegybank nem változtatott az alapkamaton", null);
        Story s = new Story("rates-cccccccccc", StoryKey.rates(), List.of(a), 1);
        return new DigestStory(s, null, RATES_FIGURES, Map.of());
    }

    static DigestModelItem good() {
        return new DigestModelItem("holding-aaaaaaaaaa", true, GOOD_TITLE, GOOD_VERDICT, GOOD_BODY, 2,
            GOOD_UNCERTAINTY, GOOD_NO_ACTION);
    }

    static String json(DigestModelItem... items) {
        StringBuilder sb = new StringBuilder("{\"items\":[");
        for (int i = 0; i < items.length; i++) {
            DigestModelItem m = items[i];
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"story\":").append(q(m.story())).append(",\"keep\":").append(m.keep())
                .append(",\"title\":").append(q(m.title())).append(",\"verdict\":").append(q(m.verdict()))
                .append(",\"body\":").append(q(m.body())).append(",\"confidence\":").append(m.confidence())
                .append(",\"uncertainty\":").append(q(m.uncertainty())).append(",\"noAction\":")
                .append(q(m.noAction())).append('}');
        }
        return sb.append("]}").toString();
    }

    private static String q(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }
}

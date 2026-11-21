package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Invented holdings, stored digest items and model answers for the weekly review tests (mezo-r36n9.120). */
final class WeeklyFixtures {

    /** A Monday. */
    static final LocalDate WEEK = LocalDate.of(2026, 11, 9);
    static final Instant T0 = Instant.parse("2026-11-10T06:30:00Z");

    static final UUID WORLD_ID = DigestFixtures.WORLD_ID;
    static final UUID PELDA_ID = DigestFixtures.PELDA_ID;
    static final UUID BOND_ID = DigestFixtures.BOND_ID;
    /** long, EUR etf · mid, HUF stock · short, HUF bond. */
    static final List<NewsHolding> HOLDINGS = DigestFixtures.HOLDINGS;

    private WeeklyFixtures() {
    }

    static PenzDigestItemJson.Source src(String name, String title) {
        return new PenzDigestItemJson.Source(name, title, "https://www.example-news.com/" + Math.abs(title.hashCode()),
            T0);
    }

    static PenzDigestItemJson holdingItem(String id, UUID holdingId, String name, String sleeve, Instant at,
                                          String verdict, PenzDigestItemJson.Source... sources) {
        return new PenzDigestItemJson(id, "holding", holdingId, name, sleeve, name + ": friss hír", 100L,
            "a te részeden", null, 1, verdict, "Tárolt digest-szöveg.", "Bizonytalanság.", "Nincs teendő.", at,
            List.of(sources), PenzDigestItemJson.NARRATED_BY_MODEL);
    }

    static PenzDigestItemJson macroItem(String id, String kind, Instant at, PenzDigestItemJson.Source... sources) {
        return new PenzDigestItemJson(id, kind, null, null, null, "fx".equals(kind) ? "Forint hír" : "Kamat hír",
            0L, "forintban mérve", null, 1, "Tárolt verdikt.", "Tárolt digest-szöveg.", "Bizonytalanság.",
            "Nincs teendő.", at, List.of(sources), PenzDigestItemJson.NARRATED_BY_FALLBACK);
    }

    static PenzDigestItemJson worldItem(String id) {
        return holdingItem(id, WORLD_ID, "Mintavilág ETF", "long", T0, "Tárolt verdikt.",
            src("Példa Hírek", "Global index provider changes its methodology"));
    }

    static PenzDigestItemJson peldaItem(String id) {
        return holdingItem(id, PELDA_ID, "Példabank Nyrt", "mid", T0, "Tárolt verdikt.",
            src("Minta Napló", "Példabank opens a new digital unit"));
    }

    /** One section per sleeve from these items, with these live holdings and no coverage. */
    static List<WeeklySection> sections(PenzDigestItemJson... items) {
        return WeeklyReviewSectioner.sections(List.of(items), HOLDINGS, null);
    }

    static WeeklySection section(String sleeve, PenzDigestItemJson... items) {
        return sections(items).stream().filter(s -> s.sleeve().equals(sleeve)).findFirst().orElseThrow();
    }

    static WeeklyModelSection good(String sleeve, String storyId) {
        return new WeeklyModelSection(sleeve, true, List.of(storyId),
            "A héten volt egy tartósnak látszó változás a 10+ éves részednél.",
            "Az indexszolgáltató módszertani váltása hosszabb távon is számíthat, mert a Mintavilág ETF ezt "
                + "követi.\n\nEz szerkezeti változás, nem egy napi árfolyam-hullámzás. *Csak címeket láttam.*",
            "Csak a címeket láttam, a részleteket nem; lehet, hogy a váltás kisebb, mint amilyennek hangzik.",
            "Ez a pénz 10+ évre szól; egy módszertani váltás miatt nincs vele teendőd.");
    }

    static WeeklyModelSection quietAnswer(String sleeve) {
        return new WeeklyModelSection(sleeve, false, List.of(),
            "Ezen a héten semmi nem változtatott a hosszú távú képen.",
            "A hét hírei napi hullámzásról szóltak, tartós változásról nem.",
            "Csak címeket láttam, egy részlet elkerülhette a figyelmemet.",
            "Ez a pénz 10+ évre szól, a heti zaj nem ok a lépésre.");
    }

    static WeeklyModelSection with(WeeklyModelSection m, String field, String value) {
        return new WeeklyModelSection(m.sleeve(), m.matters(), m.storyIds(),
            "verdict".equals(field) ? value : m.verdict(), "body".equals(field) ? value : m.body(),
            "uncertainty".equals(field) ? value : m.uncertainty(), "noAction".equals(field) ? value : m.noAction());
    }

    static String json(WeeklyModelSection... sections) {
        StringBuilder sb = new StringBuilder("{\"sections\":[");
        for (int i = 0; i < sections.length; i++) {
            WeeklyModelSection m = sections[i];
            List<String> ids = new ArrayList<>();
            m.storyIds().forEach(id -> ids.add(q(id)));
            sb.append(i == 0 ? "" : ",").append("{\"sleeve\":").append(q(m.sleeve())).append(",\"matters\":")
                .append(m.matters()).append(",\"storyIds\":[").append(String.join(",", ids)).append("],\"verdict\":")
                .append(q(m.verdict())).append(",\"body\":").append(q(m.body())).append(",\"uncertainty\":")
                .append(q(m.uncertainty())).append(",\"noAction\":").append(q(m.noAction())).append('}');
        }
        return sb.append("]}").toString();
    }

    static String q(String s) {
        return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }
}

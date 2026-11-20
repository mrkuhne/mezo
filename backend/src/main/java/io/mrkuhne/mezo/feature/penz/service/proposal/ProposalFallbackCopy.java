package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * The fixed copy of a proposal (Boop Pénz L7, mezo-r36n9.105) — pure, built only from the proposal's figures, so it
 * passes {@link ProposalValidator} by construction ({@code PenzProposalFallbackCopyTest} proves it). Used for the
 * whole narration whenever the model is absent, refused, failed or wrote anything the validator rejects; the card
 * lines ({@link #title}, {@link #sub}) and the printed split rules ({@link #rules}) are always this copy.
 */
public final class ProposalFallbackCopy {

    public static final String KIND_LUMP_SUM = "lump_sum";
    public static final String KIND_MONTHLY = "monthly";

    private ProposalFallbackCopy() {
    }

    /** The whole narration, from the figures. */
    public static ProposalNarration narration(ProposalFigures figures) {
        Split s = figures.split();
        String summary = "A *" + ProposalFigures.huf(s.amountMinor()) + "* felosztása: "
            + ProposalFigures.huf(s.shortMinor()) + " a rövid (1–3 év), "
            + ProposalFigures.huf(s.midMinor()) + " a középtávú (5–10 év) és "
            + ProposalFigures.huf(s.longMinor()) + " a hosszú (10+ év) rekeszbe. "
            + "Minden számot átírhatsz, mielőtt elfogadod.";
        Map<Sleeve, String> why = new EnumMap<>(Sleeve.class);
        why.put(Sleeve.SHORT, shortWhy(s));
        why.put(Sleeve.MID, "A tartalék utáni rész " + ProposalSplitter.MID_PCT + "%-a kerül ide: "
            + ProposalFigures.huf(s.midMinor()) + ". Ez a pénz évekig dolgozhat, de nem évtizedekig.");
        why.put(Sleeve.LONG, "A tartalék utáni rész " + ProposalSplitter.LONG_PCT + "%-a és a kerekítésből "
            + "maradó rész kerül ide: " + ProposalFigures.huf(s.longMinor())
            + ". Ehhez a pénzhez a legtovább nem kell hozzányúlnod.");
        String uncertainty = "A felosztás egyszerű, előre rögzített szabályokból jön, a terveidet nem ismeri. "
            + "Ha változnak a fix költségeid, változik a tartalék célja is. A termékek díjai a megadott forrásból "
            + "és dátumról valók, azóta változhattak — a jövőbeli hozamról semmit nem állítok.";
        return new ProposalNarration(summary, why, uncertainty);
    }

    private static String shortWhy(Split s) {
        if (!s.targetKnown()) {
            return "Nincs rögzített fix költséged, így a tartalék célját nem tudom kiszámolni — ide most nem kerül "
                + "pénz. Ha felveszed a fix költségeidet, a következő javaslat már ezzel számol.";
        }
        if (s.shortfallMinor() == 0) {
            return "A tartalékod célja " + s.emergencyMonths() + " havi fix költség, "
                + ProposalFigures.huf(s.emergencyTargetMinor()) + ", és ez már megvan. Ide most nem kerül pénz.";
        }
        String head = "A tartalékod célja " + s.emergencyMonths() + " havi fix költség, "
            + ProposalFigures.huf(s.emergencyTargetMinor()) + ". Ebből még " + ProposalFigures.huf(s.shortfallMinor())
            + " hiányzik";
        if (s.shortMinor() == 0) {
            // the shortfall is below the rounding step: the short sleeve rounds to nothing, the rest goes long
            return head + ", de ez kevesebb a kerekítési lépésnél, ezért ide most nem kerül pénz — ez a rész is a "
                + "hosszú rekeszbe megy.";
        }
        return head + ", ezért először ide kerül pénz: " + ProposalFigures.huf(s.shortMinor()) + ".";
    }

    /** The proposal card's first line. */
    public static String title(String kind, long amountMinor) {
        return (KIND_MONTHLY.equals(kind) ? "Havi stratégia: " : "Felosztási javaslat: ")
            + ProposalFigures.huf(amountMinor);
    }

    /** The proposal card's second line: the three amounts. */
    public static String sub(Split s) {
        return "Rövid " + ProposalFigures.huf(s.shortMinor()) + " · Közép " + ProposalFigures.huf(s.midMinor())
            + " · Hosszú " + ProposalFigures.huf(s.longMinor());
    }

    /** The split rules in words, for "miért?". */
    public static List<String> rules(Split s) {
        List<String> out = new ArrayList<>();
        if (s.targetKnown()) {
            out.add("Először a tartalék: a célja " + s.emergencyMonths() + " havi fix költség ("
                + ProposalFigures.huf(s.emergencyTargetMinor()) + "). A rövid (1–3 év) rekesz annyit kap, amennyi "
                + "ebből még hiányzik.");
        } else {
            out.add("Először a tartalék — de nincs rögzített fix költséged, így a célját nem tudom kiszámolni, és a "
                + "rövid (1–3 év) rekesz most nem kap pénzt.");
        }
        out.add("A maradék " + ProposalSplitter.MID_PCT + "%-a a középtávú (5–10 év), " + ProposalSplitter.LONG_PCT
            + "%-a a hosszú (10+ év) rekeszbe kerül.");
        out.add("A rövid és a középtávú összeget lefelé kerekítem 1 000 Ft-ra; a kerekítésből maradó rész a hosszú "
            + "rekeszbe megy.");
        out.add("A termékek csak a jóváhagyott termékjegyzékedből jönnek, rekeszenként a legalacsonyabb éves "
            + "költségűek elöl, legfeljebb " + ProductOptions.MAX_OPTIONS + ".");
        out.add("Ez javaslat, nem utasítás: minden számot te állítasz be, és a vételt te intézed a saját "
            + "platformodon.");
        return out;
    }
}

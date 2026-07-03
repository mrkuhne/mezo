package io.mrkuhne.mezo.feature.companion.advisor;

import java.util.List;

/** The corrective re-prompt block (old docs §4.5) — shared by the chain (producer) and the fake LLM (detector). */
public final class AdvisorRetry {

    /** Header marker — also how the stateless fake verdict recognizes a retry round. */
    public static final String RETRY_MARKER = "AZ ELŐZŐ VÁLASZ ELUTASÍTVA";

    private AdvisorRetry() {}

    public static String block(List<AdvisorViolation> violations) {
        StringBuilder block = new StringBuilder("\n\n").append(RETRY_MARKER)
                .append(" — javítsd és válaszolj újra. Okok:\n");
        for (AdvisorViolation violation : violations) {
            block.append("- ").append(violation.check()).append(": ").append(violation.reason()).append('\n');
        }
        return block.append("""
                Szabályok: ne kérdezz rá már megerősített tényre; csak a kontextus, az eszközhívások \
                vagy Daniel üzenete által alátámasztott adatot állíts; Rx gyógyszer adagolásának \
                módosítását soha ne javasold.""").toString();
    }
}

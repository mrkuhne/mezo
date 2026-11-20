package io.mrkuhne.mezo.feature.penz.service.news;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.util.List;

/**
 * One sleeve of the weekly review before narration (mezo-r36n9.120): the week's de-duplicated stories that belong to
 * it, most sources first, then newest ({@link WeeklyReviewSectioner}), and its figures.
 *
 * @param sleeve       short | mid | long
 * @param stories      stored digest items (titles, ledger names, sources — the model prose is never re-read)
 * @param figures      the backend-computed figures
 * @param mayNameNames ledger names this section may name: every live holding of the sleeve plus the stories' own
 */
public record WeeklySection(String sleeve, List<PenzDigestItemJson> stories, WeeklyFigures figures,
                            List<String> mayNameNames) {

    public WeeklySection {
        stories = stories == null ? List.of() : List.copyOf(stories);
        mayNameNames = mayNameNames == null ? List.of() : List.copyOf(mayNameNames);
    }

    public boolean quiet() {
        return stories.isEmpty();
    }
}

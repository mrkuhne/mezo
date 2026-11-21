package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.HOLDINGS;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.PELDA_ID;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.T0;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.holdingItem;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.macroItem;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.src;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** The weekly fixed copy (mezo-r36n9.120): honest, per-sleeve noAction, counts in words, and it passes its validator. */
class PenzWeeklyReviewFallbackCopyTest {

    @Test
    void testNoAction_shouldDifferPerSleeve_andNameItsHorizon() {
        Set<String> all = WeeklyReviewSectioner.SLEEVES.stream().map(WeeklyReviewFallbackCopy::noAction)
            .collect(Collectors.toSet());

        assertThat(all).hasSize(3);
        assertThat(WeeklyReviewFallbackCopy.noAction("long")).contains("10+ év");
        assertThat(WeeklyReviewFallbackCopy.noAction("mid")).contains("5–10 év");
        assertThat(WeeklyReviewFallbackCopy.noAction("short")).contains("1–3 éves");
    }

    @Test
    void testBody_shouldNameTheStoryCountInWords() {
        assertThat(WeeklyReviewFallbackCopy.body(1)).startsWith("Egy hír érintette");
        assertThat(WeeklyReviewFallbackCopy.body(4)).startsWith("Négy hír érintette");
        assertThat(WeeklyReviewFallbackCopy.body(9)).startsWith("Hatnál több hír érintette");
        assertThat(WeeklyReviewFallbackCopy.verdict()).contains("nem tudtam megbízhatóan összefoglalni");
    }

    @Test
    void testFallbackAndQuietCopy_shouldPassTheValidator_forEverySleeveAndCount() {
        for (int count : new int[] {1, 2, 6, 7}) {
            List<PenzDigestItemJson> items = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                items.add(holdingItem("holding-" + i, PELDA_ID, "Példabank Nyrt", "mid", T0, "v", src("Lap", "t" + i)));
                items.add(holdingItem("holding-w" + i, WeeklyFixtures.WORLD_ID, "Mintavilág ETF", "long", T0, "v"));
            }
            items.add(macroItem("rates-1", "rates", T0));
            for (WeeklySection s : WeeklyReviewSectioner.sections(items, HOLDINGS, 27)) {
                for (PenzWeeklySectionJson copy : List.of(WeeklyReviewAssembler.fallback(s, Map.of()),
                    WeeklyReviewAssembler.quiet(s))) {
                    WeeklyModelSection asModel = new WeeklyModelSection(s.sleeve(), false, List.of(), copy.verdict(),
                        copy.body(), copy.uncertainty(), copy.noAction());
                    assertThat(WeeklyReviewValidator.validate(asModel, s, HOLDINGS)).as(s.sleeve() + " " + count)
                        .isEmpty();
                }
            }
        }
    }
}

package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.BOND_ID;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.HOLDINGS;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.PELDA_ID;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.T0;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.WEEK;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.WORLD_ID;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.holdingItem;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.macroItem;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.src;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The weekly review's deterministic half (mezo-r36n9.120): the week, de-duplication, the three sections, figures. */
class PenzWeeklyReviewSectionerTest {

    @Test
    void testPreviousWeekStart_shouldBeTheLastCompleteMondayToSundayWeek() {
        assertThat(WeeklyReviewSectioner.previousWeekStart(LocalDate.of(2026, 11, 16))).isEqualTo(WEEK); // Monday
        assertThat(WeeklyReviewSectioner.previousWeekStart(LocalDate.of(2026, 11, 22))).isEqualTo(WEEK); // Sunday
        assertThat(WeeklyReviewSectioner.previousWeekStart(LocalDate.of(2026, 11, 18))).isEqualTo(WEEK);
        assertThat(WeeklyReviewSectioner.previousWeekStart(LocalDate.of(2026, 11, 15)))
            .isEqualTo(LocalDate.of(2026, 11, 2)); // a Sunday still belongs to the week under way
        assertThat(WeeklyReviewSectioner.weekStartOf(LocalDate.of(2026, 11, 12))).isEqualTo(WEEK);
    }

    @Test
    void testPreviousWeekStart_shouldFollowTheOwnersTimezone_notUtc() {
        // Sunday 23:30 UTC is already Monday 00:30 in Budapest: the week that just ended is complete there
        ZonedDateTime utc = ZonedDateTime.of(2026, 11, 15, 23, 30, 0, 0, ZoneId.of("UTC"));
        LocalDate budapest = utc.withZoneSameInstant(ZoneId.of("Europe/Budapest")).toLocalDate();
        LocalDate newYork = utc.withZoneSameInstant(ZoneId.of("America/New_York")).toLocalDate();

        assertThat(WeeklyReviewSectioner.previousWeekStart(budapest)).isEqualTo(WEEK);
        assertThat(WeeklyReviewSectioner.previousWeekStart(newYork)).isEqualTo(LocalDate.of(2026, 11, 2));
    }

    @Test
    void testDedupe_shouldKeepTheLatestDaysCopy_andIgnoreDaysOutsideTheWeek() {
        Map<LocalDate, List<PenzDigestItemJson>> days = new LinkedHashMap<>();
        days.put(WEEK.plusDays(3), List.of(holdingItem("holding-a", WORLD_ID, "Mintavilág ETF", "long", T0, "késői",
            src("Példa Hírek", "Later copy"), src("Minta Napló", "Later copy two"))));
        days.put(WEEK, List.of(holdingItem("holding-a", WORLD_ID, "Mintavilág ETF", "long", T0, "korai",
            src("Példa Hírek", "Early copy"))));
        days.put(WEEK.minusDays(1), List.of(holdingItem("holding-old", WORLD_ID, "Mintavilág ETF", "long", T0, "x")));
        days.put(WEEK.plusDays(7), List.of(holdingItem("holding-next", WORLD_ID, "Mintavilág ETF", "long", T0, "x")));

        List<PenzDigestItemJson> items = WeeklyReviewSectioner.dedupe(days, WEEK);

        assertThat(items).extracting(PenzDigestItemJson::id).containsExactly("holding-a");
        assertThat(items.get(0).verdict()).isEqualTo("késői");
        assertThat(items.get(0).sources()).hasSize(2);
    }

    @Test
    void testDedupe_shouldSkipItemsWithoutAModelOrFallbackNarration() {
        PenzDigestItemJson odd = new PenzDigestItemJson("holding-z", "holding", WORLD_ID, "Mintavilág ETF", "long",
            "t", 0L, "n", null, 0, "v", "b", "u", "a", T0, List.of(), "other");

        assertThat(WeeklyReviewSectioner.dedupe(Map.of(WEEK, List.of(odd)), WEEK)).isEmpty();
    }

    @Test
    void testSections_shouldAlwaysBeShortMidLong_holdingStoriesInTheirSleeve() {
        List<WeeklySection> s = WeeklyReviewSectioner.sections(List.of(WeeklyFixtures.worldItem("holding-w"),
            WeeklyFixtures.peldaItem("holding-p")), HOLDINGS, 27);

        assertThat(s).extracting(WeeklySection::sleeve).containsExactly("short", "mid", "long");
        assertThat(s.get(0).quiet()).isTrue();
        assertThat(s.get(1).stories()).extracting(PenzDigestItemJson::id).containsExactly("holding-p");
        assertThat(s.get(2).stories()).extracting(PenzDigestItemJson::id).containsExactly("holding-w");
        assertThat(s.get(2).figures().holdingNames()).containsExactly("Mintavilág ETF");
        assertThat(s.get(2).figures().coverageMonths()).isEqualTo(27);
        assertThat(s.get(1).figures().coverageMonths()).isNull();
    }

    @Test
    void testSections_shouldAttributeFxToSleevesWithForeignHoldings_andRatesToSleevesWithBonds() {
        PenzDigestItemJson fx = macroItem("fx-1", "fx", T0, src("Példa Hírek", "Forint weakens"));
        PenzDigestItemJson rates = macroItem("rates-1", "rates", T0, src("Minta Napló", "Central bank holds"));

        List<WeeklySection> s = WeeklyReviewSectioner.sections(List.of(fx, rates), HOLDINGS, null);

        assertThat(s.get(0).stories()).extracting(PenzDigestItemJson::id).containsExactly("rates-1"); // bond: short
        assertThat(s.get(0).figures().holdingNames()).containsExactly("Kitalált Kötvény 2031/A");
        assertThat(s.get(1).quiet()).isTrue(); // HUF stock only
        assertThat(s.get(2).stories()).extracting(PenzDigestItemJson::id).containsExactly("fx-1"); // EUR etf: long
        assertThat(s.get(2).figures().holdingNames()).containsExactly("Mintavilág ETF");
    }

    @Test
    void testSections_shouldUseTheLedgerSleeve_whenTheStoredSleeveIsMissing_andTheLedgerName() {
        PenzDigestItemJson item = holdingItem("holding-b", BOND_ID, "Régi név", null, T0, "v", src("A", "x"));

        WeeklySection shortSection = WeeklyReviewSectioner.sections(List.of(item), HOLDINGS, null).get(0);

        assertThat(shortSection.stories()).hasSize(1);
        assertThat(shortSection.figures().holdingNames()).containsExactly("Kitalált Kötvény 2031/A");
    }

    @Test
    void testFigures_shouldCountStoriesAndDistinctSources_mostSourcesFirst() {
        PenzDigestItemJson one = holdingItem("holding-1", PELDA_ID, "Példabank Nyrt", "mid", T0.plusSeconds(60), "v",
            src("Példa Hírek", "One"));
        PenzDigestItemJson two = holdingItem("holding-2", PELDA_ID, "Példabank Nyrt", "mid", T0, "v",
            src("példa hírek", "Two"), src("Minta Napló", "Two again"));
        PenzDigestItemJson three = holdingItem("holding-3", PELDA_ID, "Példabank Nyrt", "mid", T0.plusSeconds(120), "v",
            src("Harmadik Lap", "Three"));

        WeeklySection mid = WeeklyReviewSectioner.sections(List.of(one, two, three), HOLDINGS, null).get(1);

        assertThat(mid.stories()).extracting(PenzDigestItemJson::id)
            .containsExactly("holding-2", "holding-3", "holding-1");
        assertThat(mid.figures().storyCount()).isEqualTo(3);
        assertThat(mid.figures().sourceCount()).isEqualTo(3);
        assertThat(mid.figures().allowedNumbers()).containsExactlyInAnyOrder("3");
    }

    @Test
    void testSections_shouldIgnoreAStoryOfAnUnknownHolding_withoutASleeve() {
        PenzDigestItemJson orphan = holdingItem("holding-x", UUID.randomUUID(), "Eladott Tétel", null, T0, "v");

        assertThat(WeeklyReviewSectioner.sections(List.of(orphan), HOLDINGS, null)).allMatch(WeeklySection::quiet);
    }
}

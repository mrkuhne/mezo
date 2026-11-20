package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Every researched seed is complete enough to be printed with a dated source (mezo-r36n9.105, build notes call 10). */
class PenzCatalogSeedTest {

    private static final Set<String> KINDS = Set.of("state_bond", "money_market", "bond_etf", "equity_etf", "mixed_fund", "deposit");
    private static final Set<String> SLEEVES = Set.of("short", "mid", "long");
    private static final Set<String> DISTRIBUTIONS = Set.of("accumulating", "distributing", "interest");

    @Test
    void everySeedHasADatedSourceAndValidEnums() {
        Set<String> keys = new HashSet<>();
        assertThat(PenzCatalogSeed.SEEDS).isNotEmpty();
        for (PenzCatalogSeed.Seed s : PenzCatalogSeed.SEEDS) {
            assertThat(keys.add(s.key())).as("unique key %s", s.key()).isTrue();
            assertThat(s.name()).isNotBlank();
            assertThat(s.whatItIs()).isNotBlank();
            assertThat(KINDS).contains(s.kind());
            assertThat(DISTRIBUTIONS).contains(s.distribution());
            assertThat(s.sleeves()).isNotEmpty().allSatisfy(x -> assertThat(SLEEVES).contains(x));
            assertThat(s.sourceUrl()).startsWith("https://");
            assertThat(s.sourceName()).isNotBlank();
            assertThat(s.reviewedAt()).isNotNull();
            if (s.terPct() != null) {
                assertThat(s.terPct()).isBetween(BigDecimal.ZERO, new BigDecimal("3"));
            }
        }
    }

    @Test
    void everySleeveHasAtLeastTwoSeededOptions() {
        for (String sleeve : SLEEVES) {
            assertThat(PenzCatalogSeed.SEEDS.stream().filter(s -> s.sleeves().contains(sleeve)).count())
                .as("sleeve %s", sleeve).isGreaterThanOrEqualTo(2);
        }
    }
}

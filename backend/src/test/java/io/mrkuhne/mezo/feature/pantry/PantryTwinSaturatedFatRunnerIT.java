package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * A mezo-mxmh S3 átvitel: a hiányzó telítettzsír-érték egy makró-azonos testvérsorról jön, nem
 * becslésből. A runner {@code @Profile("demodata")}, innen az {@code @ActiveProfiles}; a no-arg
 * {@code backfill()} overloadot hívjuk, a testvérrunnerek mintájára.
 */
@Transactional
@ActiveProfiles("demodata")
class PantryTwinSaturatedFatRunnerIT extends AbstractIntegrationTest {

    @Autowired private PantryCatalogRepository repository;
    @Autowired private PantryTwinSaturatedFatRunner runner;
    @Autowired private EntityManager entityManager;

    // Master rows (created_by NULL): no app_user FK to satisfy, and the names below are
    // deliberately unlike any seeded row so uq_pantry_catalog_natural cannot collide.
    /** The live shape: the same food twice, English and Hungarian, byte-identical macros. */
    @Test
    void backfill_shouldCopyTheValueFromAMacroIdenticalTwin() {
        row("ITX olívaolaj EN", 884, 0, 0, 100, new BigDecimal("14.0"));
        PantryCatalogEntity hu = row("ITX olívaolaj HU", 884, 0, 0, 100, null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(hu).getSaturatedFatG()).isEqualByComparingTo("14.0");
    }

    /**
     * The safety fence. Two rows sharing a macro signature but disagreeing about saturated fat make
     * the signature unusable — the gapped row must be SKIPPED, not resolved by picking one of them.
     * Silently choosing would put a number nobody can defend into a score.
     */
    @Test
    void backfill_shouldSkipTheRow_whenTwoTwinsDisagree() {
        row("ITX vaj A", 742, 1, 1, 82, new BigDecimal("52.0"));
        row("ITX vaj B", 742, 1, 1, 82, new BigDecimal("41.0"));
        PantryCatalogEntity gapped = row("ITX vaj C", 742, 1, 1, 82, null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(gapped).getSaturatedFatG()).isNull();
    }

    /** No fat at all → zero is arithmetic, and stating it beats degrading the dimension. */
    @Test
    void backfill_shouldStateZero_onAFatFreeRow() {
        PantryCatalogEntity honey = row("ITX akácméz", 304, 0, 82, 0, null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(honey).getSaturatedFatG()).isEqualByComparingTo("0");
    }

    /** Idempotent, and never overwrites a value a real label already supplied. */
    @Test
    void backfill_shouldLeaveAnExistingValueAlone_andBeIdempotent() {
        row("ITX olaj ref", 884, 0, 0, 100, new BigDecimal("14.0"));
        PantryCatalogEntity labelled = row("ITX címkés olaj", 884, 0, 0, 100, new BigDecimal("13.2"));

        runner.backfill();
        runner.backfill();
        entityManager.clear();

        assertThat(reload(labelled).getSaturatedFatG()).isEqualByComparingTo("13.2");
    }

    private PantryCatalogEntity row(String name, double kcal, double p, double c, double f,
                                    BigDecimal satFat) {
        PantryCatalogEntity e = new PantryCatalogEntity();
        e.setKind("food");
        e.setName(name);
        e.setSource("manual");
        e.setCategory("other");
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(BigDecimal.valueOf(kcal));
        e.setProteinG(BigDecimal.valueOf(p));
        e.setCarbsG(BigDecimal.valueOf(c));
        e.setFatG(BigDecimal.valueOf(f));
        e.setSaturatedFatG(satFat);
        e.setNova((short) 1);
        return repository.saveAndFlush(e);
    }

    private PantryCatalogEntity reload(PantryCatalogEntity e) {
        return repository.findById(e.getId()).orElseThrow();
    }
}

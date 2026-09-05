package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** The catalog loader is master content (every profile), upserts by natural key, never creates a shelf row. */
@Transactional
class PantryCatalogLoaderIT extends AbstractIntegrationTest {

    private static final int CATALOG_SIZE = 147;

    /**
     * Turkish dotted capital I (U+0130): Postgres {@code lower()} folds it to a plain {@code 'i'}
     * (glibc {@code towlower} has no Unicode decomposition), while Java's
     * {@code toLowerCase(Locale.ROOT)} yields TWO characters, {@code 'i'} + COMBINING DOT ABOVE
     * (U+0307). Shared by the fold-collision test and its assumption guard (mezo-3vb1) so both
     * exercise the exact same character.
     */
    private static final String FOLD_FIXTURE = "İ";

    @Autowired private PantryCatalogLoader loader;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testRun_shouldLoadMasterRows_whenContextStarts() {
        // Profile-independent: it already ran at startup; ResetDatabase keeps created_by IS NULL rows.
        assertThat(catalogRepository.findByCreatedByIsNull()).hasSize(CATALOG_SIZE);
        PantryCatalogEntity bulgur = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        assertThat(bulgur.isMaster()).isTrue();
        assertThat(bulgur.getKind()).isEqualTo("food");
        assertThat(bulgur.getCategory()).isEqualTo("grains");
        assertThat(bulgur.getSource()).isEqualTo("kifli.hu");
        assertThat(bulgur.getFiberG()).isEqualByComparingTo(new BigDecimal("13"));
        assertThat(bulgur.getNova()).isEqualTo((short) 1);
        assertThat(catalogRepository.findByCreatedByIsNull()).anyMatch(c -> "lidl".equals(c.getSource()));
        assertThat(catalogRepository.findByCreatedByIsNull())
            .filteredOn(c -> c.getNova() == null).extracting(PantryCatalogEntity::getName)
            .containsExactlyInAnyOrder("Jenny Kaja", "Szilvia Törlőkendő");
    }

    @Test
    void testRun_shouldNeverCreatePantryItems() {
        UUID owner = databasePopulator.populateUser("loader-owner@test.local");
        loader.run();
        assertThat(itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
        assertThat(itemRepository.count()).isZero();
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        long before = catalogRepository.count();
        loader.run();
        assertThat(catalogRepository.count()).isEqualTo(before);
    }

    @Test
    void testRun_shouldClaimUserRowAndFillNullsOnly_whenNaturalKeyAlreadyAuthoredByAUser() {
        UUID user = databasePopulator.populateUser("loader-user@test.local");
        PantryCatalogEntity bulgur = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        // Simulate the migrated prod state: the owner's own row for a seed food, curated by hand.
        bulgur.setCreatedBy(user);
        bulgur.setNova((short) 4);     // deliberate hand-set value — must survive
        bulgur.setFiberG(null);        // a gap the seed can fill (seed: 13)
        catalogRepository.saveAndFlush(bulgur);

        loader.run();

        PantryCatalogEntity after = catalogRepository.findById(bulgur.getId()).orElseThrow();
        assertThat(after.isMaster()).isTrue();                                   // claimed as master
        assertThat(after.getNova()).isEqualTo((short) 4);                         // curated value untouched
        assertThat(after.getFiberG()).isEqualByComparingTo(new BigDecimal("13")); // NULL filled from the seed
        assertThat(catalogRepository.findByCreatedByIsNull()).hasSize(CATALOG_SIZE); // no duplicate row
    }

    /**
     * Proves the claim is no longer silent (mezo-qw37.4 review follow-up): the WARN must name the
     * claimed row and the author whose authorship was cleared, so an operator can reconstruct
     * what happened. Uses the {@code ListAppender} log-capture idiom already used in this repo
     * (e.g. {@code TimingProfileIT}).
     */
    @Test
    void testRun_shouldLogWarnWithAuthorAndName_whenClaimingAUserAuthoredRow() {
        UUID user = databasePopulator.populateUser("loader-warn-user@test.local");
        PantryCatalogEntity bulgur = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        bulgur.setCreatedBy(user);
        catalogRepository.saveAndFlush(bulgur);

        Logger logger = (Logger) LoggerFactory.getLogger(PantryCatalogLoader.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            loader.run();

            List<String> warnMessages = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
            assertThat(warnMessages)
                .anyMatch(m -> m.contains(user.toString()) && m.contains("Bulgur Raw Kifli"));
        } finally {
            logger.detachAppender(appender);
        }
    }

    /** A plain revive of an already-master (soft-deleted) row is not a claim — no authorship is lost, no WARN. */
    @Test
    void testRun_shouldNotLogWarn_whenRevivingAnAlreadyMasterRow() {
        PantryCatalogEntity master = catalogRepository.findByNaturalKey("Bulgur Raw Kifli", null).orElseThrow();
        master.setDeleted(true);
        catalogRepository.saveAndFlush(master);

        Logger logger = (Logger) LoggerFactory.getLogger(PantryCatalogLoader.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            loader.run();

            assertThat(catalogRepository.findById(master.getId()).orElseThrow().isDeleted()).isFalse();
            assertThat(appender.list).noneMatch(e -> e.getLevel() == Level.WARN);
        } finally {
            logger.detachAppender(appender);
        }
    }

    /** A no-op idempotent re-run (nothing inserted, nothing claimed) must not emit any WARN either. */
    @Test
    void testRun_shouldNotLogWarn_whenRerunIsANoOp() {
        Logger logger = (Logger) LoggerFactory.getLogger(PantryCatalogLoader.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            loader.run();

            assertThat(appender.list).noneMatch(e -> e.getLevel() == Level.WARN);
        } finally {
            logger.detachAppender(appender);
        }
    }

    /**
     * The brief's original fixture (trailing whitespace + {@code toUpperCase}) does NOT reproduce
     * the bug: {@code PantryCatalogLoader.naturalKey} already calls {@code .strip()}, so plain
     * ASCII whitespace/case drift folds identically on both sides — confirmed by first running this
     * test with that fixture and watching it pass against the pre-fix loader (see task-3-report.md).
     *
     * <p>The REAL, deterministic divergence (verified empirically against this exact Postgres image,
     * {@code en_US.utf8} collation, via a throwaway diagnostic query) is the Turkish dotted capital
     * I (U+0130): Postgres {@code lower('İ')} folds it to a single plain {@code 'i'} (glibc
     * {@code towlower} has no Unicode decomposition), while Java {@code "İ".toLowerCase(Locale.ROOT)}
     * yields TWO characters, {@code 'i'} + COMBINING DOT ABOVE (U+0307) — this is exactly the
     * "Turkish dotted I" case the class javadoc and repository javadoc already name. Swapping one
     * lowercase 'i' in a real seed name for U+0130 makes Postgres consider the row identical to the
     * seed's natural key while Java's map does not.
     */
    @Test
    void testRun_shouldFindExistingRowThroughPostgresFold_notJavaFold() {
        String seedName = loader.readCatalogForTest().getFirst().name();
        int i = seedName.indexOf('i');
        assertThat(i).as("seed name must contain a lowercase 'i' for the fold-collision fixture").isNotNegative();
        String driftedName = seedName.substring(0, i) + FOLD_FIXTURE + seedName.substring(i + 1);

        // The loader already ran at context startup and inserted the master row for this natural
        // key — remove it first, or the insert below (same Postgres-folded key) hits
        // uq_pantry_catalog_natural itself, before the loader logic under test even runs.
        catalogRepository.delete(catalogRepository.findByNaturalKey(seedName, null).orElseThrow());
        catalogRepository.flush();
        PantryCatalogEntity preexisting = new PantryCatalogEntity();
        preexisting.setKind("food");
        preexisting.setName(driftedName);
        preexisting.setSource("manual");
        catalogRepository.saveAndFlush(preexisting);
        UUID preexistingId = preexisting.getId();

        loader.run();

        assertThat(catalogRepository.findByNaturalKey(seedName, null))
            .get().extracting(PantryCatalogEntity::getId).isEqualTo(preexistingId);
        assertThat(catalogRepository.findByCreatedByIsNull()).hasSize(CATALOG_SIZE); // no duplicate row
    }

    @Test
    void testFoldAssumption_javaAndPostgresMustStillDisagreeOnTheFixture() {
        // The fold-collision test above is only meaningful while Java's toLowerCase and Postgres'
        // lower() actually disagree on this character. If a future Postgres/glibc aligns them, that
        // test would keep passing on the OLD loader too — a silent false green. This one fails
        // loudly instead, so the fixture gets revisited rather than quietly losing its teeth
        // (mezo-3vb1).
        String javaFold = FOLD_FIXTURE.toLowerCase(java.util.Locale.ROOT);
        String postgresFold = jdbcTemplate.queryForObject("select lower(?)", String.class, FOLD_FIXTURE);
        assertThat(postgresFold)
            .as("fixture no longer exercises a Java-vs-Postgres fold difference — pick a new one")
            .isNotEqualTo(javaFold);
    }
}

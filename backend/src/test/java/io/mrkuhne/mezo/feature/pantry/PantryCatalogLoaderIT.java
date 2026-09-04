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
import org.springframework.transaction.annotation.Transactional;

/** The catalog loader is master content (every profile), upserts by natural key, never creates a shelf row. */
@Transactional
class PantryCatalogLoaderIT extends AbstractIntegrationTest {

    private static final int CATALOG_SIZE = 147;

    @Autowired private PantryCatalogLoader loader;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private DatabasePopulator databasePopulator;

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
}

package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader.CatalogJsonItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Master-data loader IT: the curated catalog loads at startup, re-running is idempotent,
 * content edits upsert by slug, and invalid content fails fast (never reaches the DB).
 * Since mezo-52zg the loader also preserves user videos and never touches user-authored rows.
 */
@Transactional
class ExerciseCatalogLoaderIT extends AbstractIntegrationTest {

    @Autowired private ExerciseCatalogLoader loader;
    @Autowired private ExerciseCatalogRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;

    @Test
    void testRun_shouldLoadCuratedCatalog_whenContextStarts() {
        // The loader is profile-independent and already ran at context startup.
        assertThat(repository.count()).isEqualTo(110);
        ExerciseCatalogEntity row = repository.findBySlug("chest-supported-row").orElseThrow();
        assertThat(row.getName()).isEqualTo("Chest Supported Row");
        assertThat(row.getMuscle()).isEqualTo("back-mid");
        assertThat(row.getType()).isEqualTo("compound");
        assertThat(row.getStim()).isEqualByComparingTo("0.92");
        assertThat(row.getFatigue()).isEqualByComparingTo("0.55");
    }

    @Test
    void testRun_shouldContainPlyoBlock_whenLoaded() {
        List<ExerciseCatalogEntity> plyo = repository.findAll().stream()
            .filter(e -> "plyo".equals(e.getType())).toList();
        assertThat(plyo).hasSize(12);
        assertThat(plyo).extracting(ExerciseCatalogEntity::getSlug)
            .contains("box-jump", "depth-jump", "approach-jump");
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        loader.run();
        loader.run();
        assertThat(repository.count()).isEqualTo(110);
    }

    @Test
    void testRun_shouldUpsertChangedValues_whenDbRowDrifted() {
        ExerciseCatalogEntity drifted = repository.findBySlug("box-jump").orElseThrow();
        drifted.setStim(new BigDecimal("0.10"));
        repository.saveAndFlush(drifted);

        loader.run();

        assertThat(repository.findBySlug("box-jump").orElseThrow().getStim())
            .isEqualByComparingTo("0.60");
    }

    @Test
    void testLoad_shouldFailFast_whenContentInvalid() {
        CatalogJsonItem bad = new CatalogJsonItem(
            "bad-item", "Bad Item", "not-a-muscle", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"), null);
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bad-item");
    }

    @Test
    void testLoader_shouldPreserveUserVideo_whenReRun() {
        var master = repository.findBySlug("box-jump").orElseThrow();
        master.setVideoUrl("https://youtu.be/dQw4w9WgXcQ");
        repository.saveAndFlush(master);
        loader.run(); // re-run against the drifted DB
        assertThat(repository.findBySlug("box-jump").orElseThrow().getVideoUrl())
            .isEqualTo("https://youtu.be/dQw4w9WgXcQ");
    }

    @Test
    void testLoader_shouldNotTouchUserRows_whenReRun() {
        UUID owner = databasePopulator.populateUser("catalog-owner@test.local");
        var user = train.createUserCatalogExercise(owner, "My Move", "quad", "plyo");
        loader.run();
        assertThat(repository.findById(user.getId())).isPresent();
    }
}

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
import java.util.Arrays;
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
        assertThat(repository.count()).isEqualTo(166);
        ExerciseCatalogEntity row = repository.findBySlug("chest-supported-row").orElseThrow();
        assertThat(row.getName()).isEqualTo("Chest Supported Row");
        assertThat(row.getMuscle()).isEqualTo("back-mid");
        assertThat(row.getType()).isEqualTo("compound");
        assertThat(row.getStim()).isEqualByComparingTo("0.92");
        assertThat(row.getFatigue()).isEqualByComparingTo("0.55");
        assertThat(repository.findBySlug("hammer-curl").orElseThrow().getAllowedTechniques())
            .containsExactly("myo", "rest_drop", "drop");
        assertThat(repository.findBySlug("hip-thrust").orElseThrow().getAllowedTechniques())
            .containsExactly("top_pause");
    }

    @Test
    void testRun_shouldContainPlyoBlock_whenLoaded() {
        List<ExerciseCatalogEntity> plyo = repository.findAll().stream()
            .filter(e -> "plyo".equals(e.getType())).toList();
        assertThat(plyo).hasSize(16);
        assertThat(plyo).extracting(ExerciseCatalogEntity::getSlug)
            .contains("box-jump", "depth-jump", "approach-jump", "countermovement-jump", "dead-hang");
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        loader.run();
        loader.run();
        assertThat(repository.count()).isEqualTo(166);
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
    void testRun_shouldHealTechniquePalette_whenMasterRowDrifted() {
        ExerciseCatalogEntity drifted = repository.findBySlug("hammer-curl").orElseThrow();
        drifted.setAllowedTechniques(List.of("top_pause"));
        repository.saveAndFlush(drifted);

        loader.run();

        assertThat(repository.findBySlug("hammer-curl").orElseThrow().getAllowedTechniques())
            .containsExactly("myo", "rest_drop", "drop");
    }

    @Test
    void testLoad_shouldFailFast_whenContentInvalid() {
        CatalogJsonItem bad = new CatalogJsonItem(
            "bad-item", "Bad Item", "not-a-muscle", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"), null, null, null,
            "machine", "stable", false,
            List.of("barbell"), "squat", List.of(), List.of("knee"), false, "high");
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bad-item");
    }

    @Test
    void testRun_shouldClassifyEveryMasterRow_whenLoaded() {
        List<ExerciseCatalogEntity> master = repository.findAll().stream()
            .filter(e -> e.getCreatedBy() == null).toList();
        assertThat(master).hasSize(166).allSatisfy(e -> {
            assertThat(e.getEquipment()).isNotBlank();
            assertThat(e.getStability()).isIn("stable", "free");
            assertThat(e.getGear()).isNotEmpty();
            assertThat(e.getPattern()).isNotBlank();
            assertThat(e.getSecondaryMuscles()).isNotNull();
            assertThat(e.getJoints()).isNotNull();
            assertThat(e.getLengthened()).isNotNull();
            assertThat(e.getDemand()).isIn("low", "medium", "high");
        });
        ExerciseCatalogEntity pulldown = repository.findBySlug("lat-pulldown-pronated").orElseThrow();
        assertThat(pulldown.getEquipment()).isEqualTo("cable");
        assertThat(pulldown.getStability()).isEqualTo("stable");
        assertThat(pulldown.getLengthenedFriendly()).isTrue();
        assertThat(repository.findBySlug("barbell-squat").orElseThrow().getStability()).isEqualTo("free");
    }

    @Test
    void testLoad_shouldFailFast_whenStabilityMissing() {
        CatalogJsonItem bad = new CatalogJsonItem("bad-item", "Bad Item", "quad", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"), null, null, null, "machine", null, false,
            List.of("machine"), "squat", List.of(), List.of("knee"), false, "high");
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("bad-item");
    }

    @Test
    void testLoad_shouldFailFast_whenEquipmentUnknown() {
        CatalogJsonItem bad = new CatalogJsonItem("bad-item", "Bad Item", "quad", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"), null, null, null, "spaceship", "stable", false,
            List.of("machine"), "squat", List.of(), List.of("knee"), false, "high");
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("bad-item");
    }

    @Test
    void testRun_shouldHealClassificationDrift_whenDbRowChanged() {
        ExerciseCatalogEntity drifted = repository.findBySlug("barbell-squat").orElseThrow();
        drifted.setStability("stable");
        drifted.setEquipment("machine");
        drifted.setLengthenedFriendly(true);
        drifted.setGear(List.of("machine"));
        drifted.setPattern("jump");
        drifted.setDemand("low");
        repository.saveAndFlush(drifted);

        loader.run();

        ExerciseCatalogEntity healed = repository.findBySlug("barbell-squat").orElseThrow();
        assertThat(healed.getStability()).isEqualTo("free");
        assertThat(healed.getEquipment()).isEqualTo("barbell");
        assertThat(healed.getLengthenedFriendly()).isFalse();
        assertThat(healed.getGear()).contains("barbell");
        assertThat(healed.getPattern()).isEqualTo("squat");
        assertThat(healed.getDemand()).isEqualTo("high");
    }

    @Test
    void testLoad_shouldFailFast_whenSelectionAttributeInvalid() {
        // Everything valid except an equipment kind outside the allowed set (mezo-r36n9.66).
        CatalogJsonItem bad = new CatalogJsonItem(
            "bad-equipment", "Bad Equipment", "quad", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"), null, null, null,
            "machine", "stable", false,
            List.of("treadmill"), "squat", List.of(), List.of("knee"), false, "high");
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bad-equipment");
    }

    @Test
    void testLoad_shouldRejectTechniquePalette_whenMissingUnknownOrRepeated() {
        CatalogJsonItem valid = imageItem(null, null);
        for (List<String> choices : Arrays.asList(null, List.of("none"), List.of("myo", "myo"), List.of("unknown"))) {
            CatalogJsonItem bad = new CatalogJsonItem(valid.slug(), valid.name(), valid.muscle(), valid.type(),
                valid.stim(), valid.fatigue(), valid.videoUrl(), valid.imageStartUrl(), valid.imageEndUrl(),
                valid.equipment(), valid.stability(), valid.lengthenedFriendly(), valid.gear(), valid.pattern(),
                valid.secondaryMuscles(), valid.joints(), valid.lengthened(), valid.demand(), choices);
            assertThatThrownBy(() -> loader.load(List.of(bad)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining(valid.slug());
        }
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
        assertThat(repository.findById(user.getId()).orElseThrow().getAllowedTechniques()).isNull();
    }

    @Test
    void testLoad_shouldSeedBothImageFrames_whenContentProvidesThem() {
        loader.load(List.of(imageItem("/exercises/box-jump-a.jpg", "/exercises/box-jump-b.jpg")));

        ExerciseCatalogEntity row = repository.findBySlug("box-jump").orElseThrow();
        assertThat(row.getImageStartUrl()).isEqualTo("/exercises/box-jump-a.jpg");
        assertThat(row.getImageEndUrl()).isEqualTo("/exercises/box-jump-b.jpg");
    }

    @Test
    void testLoad_shouldPreserveUserImages_whenContentAlsoProvidesThem() {
        // A user attached stills in-app; a redeploy re-runs the loader with its own JSON values.
        ExerciseCatalogEntity master = repository.findBySlug("box-jump").orElseThrow();
        master.setImageStartUrl("/uploads/mine-a.jpg");
        master.setImageEndUrl("/uploads/mine-b.jpg");
        repository.saveAndFlush(master);

        loader.load(List.of(imageItem("/exercises/box-jump-a.jpg", "/exercises/box-jump-b.jpg")));

        ExerciseCatalogEntity row = repository.findBySlug("box-jump").orElseThrow();
        assertThat(row.getImageStartUrl()).isEqualTo("/uploads/mine-a.jpg");
        assertThat(row.getImageEndUrl()).isEqualTo("/uploads/mine-b.jpg");
    }

    /** The real box-jump content row, with the two image frames swapped in. */
    private CatalogJsonItem imageItem(String start, String end) {
        return new CatalogJsonItem("box-jump", "Box Jump", "quad", "plyo",
            new BigDecimal("0.60"), new BigDecimal("0.35"), null, start, end,
            "other", "free", false,
            List.of("specialty"), "jump", List.of("glute", "calf"), List.of("knee", "hip", "ankle"),
            false, "medium", List.of());
    }
}

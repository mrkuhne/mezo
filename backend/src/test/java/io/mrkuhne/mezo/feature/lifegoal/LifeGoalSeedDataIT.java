package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifies the opt-in {@code demofixtures} life-goal seed. Mirrors {@code TrainSeedDataIT}'s
 * {@code @ActiveProfiles({"demodata", "demofixtures"})}: a separate context whose
 * {@code OwnerSeedData} (demodata) + {@code LifeGoalSeedData} (demofixtures) CommandLineRunners
 * fire at startup; {@link AbstractIntegrationTest}'s {@code @BeforeEach} ResetDatabase then wipes
 * the life-goal tables (the owner survives as master data), so each test re-seeds explicitly via
 * {@code seed.run()} — which still finds the preserved owner.
 */
@ActiveProfiles({"demodata", "demofixtures"})
class LifeGoalSeedDataIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSeedData seed;
    @Autowired private LifeGoalRepository goals;
    @Autowired private LifeGoalPillarRepository pillars;
    @Autowired private SignalCatalog catalog;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testRun_shouldSeedFourGoalsElevenPillars_whenEmpty() {
        seed.run(); // ResetDatabase wiped the startup seed -> run inside the test
        assertThat(goals.count()).isEqualTo(4);
        assertThat(pillars.count()).isEqualTo(11);
        seed.run();
        assertThat(goals.count()).isEqualTo(4);
        assertThat(pillars.count()).isEqualTo(11);
    }

    @Test
    void testRun_shouldSeedTheFourNamedGoalsOwnedByTheOwner_whenEmpty() {
        seed.run();
        List<LifeGoalEntity> seeded = goals.findAll();

        assertThat(seeded).extracting(LifeGoalEntity::getTitle)
            .containsExactlyInAnyOrder("Kockahas", "Side hustle", "Az utolsó barátnő", "Spanyol B2");
        assertThat(seeded).allSatisfy(g -> assertThat(g.getCreatedBy()).isEqualTo(ownerId()));
        assertThat(seeded).filteredOn(g -> "active".equals(g.getStatus()))
            .hasSize(3)
            .extracting(LifeGoalEntity::getTitle)
            .containsExactlyInAnyOrder("Kockahas", "Side hustle", "Az utolsó barátnő");
        // Only the three active goals carry an activation stamp; the parked one must not.
        assertThat(seeded).filteredOn(g -> "active".equals(g.getStatus()))
            .allSatisfy(g -> assertThat(g.getActivatedAt()).isNotNull());
        assertThat(seeded).filteredOn(g -> "Spanyol B2".equals(g.getTitle()))
            .singleElement()
            .satisfies(g -> {
                assertThat(g.getStatus()).isEqualTo("parked");
                assertThat(g.getActivatedAt()).isNull();
            });
    }

    /**
     * The seed's central documented claim (LifeGoalSeedData's Javadoc) and decision D4's
     * closed-catalog guarantee: every seeded pillar would also survive
     * {@code PUT /api/life-goals/{id}/pillars} — i.e. its source resolves in the catalog AND the
     * catalog entry allows its kind, which is exactly what {@code LifeGoalPillarService.validate}
     * checks. A row count alone would not notice a seed drifting off the catalog.
     */
    @Test
    void testRun_shouldSeedOnlyCatalogValidPillars_whenEmpty() {
        seed.run();
        List<LifeGoalPillarEntity> seeded = pillars.findAll();

        assertThat(seeded).hasSize(11);
        assertThat(seeded).allSatisfy(p -> {
            var entry = catalog.find(p.getSource());
            assertThat(entry).as("catalog entry for pillar '%s'", p.getLabel()).isPresent();
            assertThat(entry.orElseThrow().kinds())
                .as("kind '%s' allowed for pillar '%s'", p.getKind(), p.getLabel())
                .contains(p.getKind());
        });
    }
}

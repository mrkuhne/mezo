package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferences;
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferencesResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The ungated preference source: saved row wins, config ghost otherwise (never null). */
@Transactional
class DietPreferencesResolverIT extends AbstractIntegrationTest {

    @Autowired private DietPreferencesResolver resolver;
    @Autowired private DietSettingsRepository repository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testResolve_shouldReturnConfigGhost_whenNoRow() {
        DietPreferences p = resolver.resolve(UUID.randomUUID());

        assertThat(p.splitPreset()).isEqualTo("balanced");
        assertThat(p.proteinTier()).isEqualTo("moderate");
        assertThat(p.waterMl()).isEqualTo(4000);
        assertThat(p.fiberG()).isEqualTo(30);
        assertThat(p.fatPctX10()).isNull();
    }

    @Test
    void testResolve_shouldReturnSavedRow_whenPresent() {
        UUID owner = databasePopulator.populateUser("diet-prefs-resolver@test.local");
        DietSettingsEntity row = new DietSettingsEntity();
        row.setCreatedBy(owner);
        row.setSplitPreset("custom");
        row.setProteinPctX10(300);
        row.setCarbsPctX10(400);
        row.setFatPctX10(300);
        row.setProteinTier("high");
        row.setWaterMl(3500);
        row.setFiberG(35);
        repository.save(row);

        DietPreferences p = resolver.resolve(owner);

        assertThat(p.splitPreset()).isEqualTo("custom");
        assertThat(p.fatPctX10()).isEqualTo(300);
        assertThat(p.proteinTier()).isEqualTo("high");
        assertThat(p.waterMl()).isEqualTo(3500);
    }
}

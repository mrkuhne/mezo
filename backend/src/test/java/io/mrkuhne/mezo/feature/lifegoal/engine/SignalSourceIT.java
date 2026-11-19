package io.mrkuhne.mezo.feature.lifegoal.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class SignalSourceIT extends AbstractIntegrationTest {

    @Autowired private List<SignalSource> sources;
    @Autowired private NeedsDayRepository needsDayRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private final LocalDate day = LocalDate.of(2026, 9, 1);

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private SignalSource pick(PillarSourceJson source) {
        return sources.stream().filter(s -> s.supports(source)).findFirst()
            .orElseThrow(() -> new IllegalStateException("No SignalSource supports " + source));
    }

    @Test
    void activity_source_isNoLongerSupported_afterTheXpWorldLeft() {
        // mezo-r36n9.97.5: the activity log left the server; an existing type=activity pillar
        // finds no SignalSource and evaluates as honest no_data (LifeGoalProgressService#windowFor).
        PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "minutes", null, null);
        assertThat(sources).noneMatch(s -> s.supports(src));
    }

    @Test
    void needs_ring_only_closed_days_have_keys() {
        UUID userId = ownerId();
        NeedsDayEntity e = new NeedsDayEntity();
        e.setCreatedBy(userId);
        e.setNeedsDate(day);
        e.setEnergia(50);
        e.setHidratacio(50);
        e.setPihenes(50);
        e.setMozgas(80);
        e.setLelek(50);
        e.setRend(50);
        needsDayRepository.saveAndFlush(e);

        PillarSourceJson src = new PillarSourceJson("needs_ring", null, null, null, null, "mozgas");
        SignalWindow w = pick(src).window(userId, src, day.minusDays(1), day);
        assertThat(w.values()).containsOnlyKeys(day);
        assertThat(w.values().get(day)).isEqualByComparingTo("80");
    }
}

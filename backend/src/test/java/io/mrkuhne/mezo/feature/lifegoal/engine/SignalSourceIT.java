package io.mrkuhne.mezo.feature.lifegoal.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
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
    @Autowired private ActivityLogRepository activityLogRepository;
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

    private ActivityLogEntity activity(UUID userId, LocalDate on, String skillKey, Integer durationMin) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(userId);
        e.setOccurredOn(on);
        e.setText("test entry");
        e.setSkillKey(skillKey);
        e.setExtracted(new ActivityExtract(durationMin, null));
        return activityLogRepository.saveAndFlush(e);
    }

    @Test
    void activity_minutes_sums_per_day() {
        UUID userId = ownerId();
        activity(userId, day, "productivity", 20);
        activity(userId, day, "productivity", 40);

        PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "minutes", null, null);
        SignalWindow w = pick(src).window(userId, src, day, day);
        assertThat(w.values().get(day)).isEqualByComparingTo("60");
    }

    @Test
    void activity_minutes_ignores_other_skill_keys() {
        UUID userId = ownerId();
        activity(userId, day, "productivity", 20);
        activity(userId, day, "recovery", 999);

        PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "minutes", null, null);
        SignalWindow w = pick(src).window(userId, src, day, day);
        assertThat(w.values().get(day)).isEqualByComparingTo("20");
    }

    @Test
    void activity_count_counts_entries() {
        UUID userId = ownerId();
        activity(userId, day, "productivity", 20);
        activity(userId, day, "productivity", 40);

        PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "count", null, null);
        SignalWindow w = pick(src).window(userId, src, day, day);
        assertThat(w.values().get(day)).isEqualByComparingTo("2");
    }

    @Test
    void activity_day_without_rows_has_no_key() {
        UUID userId = ownerId();
        PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "minutes", null, null);
        SignalWindow w = pick(src).window(userId, src, day, day);
        assertThat(w.values()).doesNotContainKey(day);
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

package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SignalCatalogEntry;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level IT for the per-source liveness added to GET /api/life-goals/signals (mezo-iizd.7):
 * how many of the last 7 days had data for a source, and which of the caller's active pillars
 * feed off it. See the neighboring {@code LifeGoalPillarApiIT} for the plain-catalog-shape test.
 */
class LifeGoalSignalsLivenessIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private SignalCatalogEntry entryById(SignalCatalogResponse res, String id) {
        return res.getEntries().stream().filter(e -> id.equals(e.getId())).findFirst()
            .orElseThrow(() -> new AssertionError("no entry with id " + id));
    }

    @Test
    void signals_shouldMarkASourceLiveWithItsDataDayCountAndFedPillarLabels_whenTheUserLoggedCheckIns() {
        UUID owner = ownerId();
        // Két zárt napra check-in → a CHECKIN_ENERGY jel él, 2/7 nap.
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(1), "08:00", 6, 3, "napi");
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(2), "08:00", 7, 3, "napi");

        // Aktív cél egy CHECKIN_ENERGY-re mutató pillérrel → az a pillér a jel chipjeként jelenik meg.
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.pillar(goal, "Energia", "average",
            new PillarSourceJson("metric", "CHECKIN_ENERGY", null, null, null, null),
            new PillarRuleJson(new BigDecimal("5"), "gte", null, 7, null, null, null, null, null, null));

        SignalCatalogResponse res = getForBody(
            "/api/life-goals/signals", ownerAuthHeaders(), HttpStatus.OK, SignalCatalogResponse.class);

        assertThat(res.getEntries()).hasSize(28);

        SignalCatalogEntry checkinEnergy = entryById(res, "checkin_energy");
        assertThat(checkinEnergy.getLive()).isTrue();
        assertThat(checkinEnergy.getDaysWithData()).isEqualTo(2);
        assertThat(checkinEnergy.getFedPillars()).isEqualTo(List.of("Energia"));

        // Amihez nincs adat, az alszik — és sosem hiányzik a listából (transzparencia-oldal).
        SignalCatalogEntry socialMentions = entryById(res, "social_mentions");
        assertThat(socialMentions.getLive()).isFalse();
        assertThat(socialMentions.getDaysWithData()).isEqualTo(0);
    }
}

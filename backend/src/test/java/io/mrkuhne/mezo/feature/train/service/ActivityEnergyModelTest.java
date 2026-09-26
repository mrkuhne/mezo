package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ActivityEnergyModelTest {

    static TrainProperties props() {
        Map<String, TrainProperties.MetBand> met = Map.ofEntries(
            Map.entry("gym", new TrainProperties.MetBand(3.5, 3.5, 5.0)),
            Map.entry("volleyball", new TrainProperties.MetBand(3.0, 4.0, 6.0)),
            Map.entry("football", new TrainProperties.MetBand(5.0, 7.0, 9.5)),
            Map.entry("basketball", new TrainProperties.MetBand(4.5, 6.5, 8.0)),
            Map.entry("tennis", new TrainProperties.MetBand(5.0, 7.0, 8.0)),
            Map.entry("trx", new TrainProperties.MetBand(3.0, 4.5, 6.5)),
            Map.entry("cross", new TrainProperties.MetBand(4.0, 5.8, 8.0)),
            Map.entry("swim", new TrainProperties.MetBand(5.8, 8.3, 9.8)),
            Map.entry("bike", new TrainProperties.MetBand(5.8, 6.8, 8.0)),
            Map.entry("hike", new TrainProperties.MetBand(5.3, 6.0, 7.8)),
            Map.entry("run", new TrainProperties.MetBand(7.5, 9.3, 10.5)),
            Map.entry("other", new TrainProperties.MetBand(3.0, 4.0, 6.0)));
        return new TrainProperties(new TrainProperties.Energy(met), 60, 45, 400);
    }

    private final ActivityEnergyModel model = new ActivityEnergyModel(props());

    @Test
    void bandFollowsRpe() {
        assertThat(ActivityEnergyModel.band(null)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(1)).isEqualTo("light");
        assertThat(ActivityEnergyModel.band(4)).isEqualTo("light");
        assertThat(ActivityEnergyModel.band(5)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(7)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(8)).isEqualTo("hard");
        assertThat(ActivityEnergyModel.band(10)).isEqualTo("hard");
    }

    @Test
    void restPerHourPrefersBmrThenWeight() {
        assertThat(ActivityEnergyModel.restKcalPerHour(new BigDecimal("1920"), new BigDecimal("80")))
            .hasValueSatisfying(v -> assertThat(v.doubleValue()).isEqualTo(80.0, within(1e-9)));
        assertThat(ActivityEnergyModel.restKcalPerHour(null, new BigDecimal("72.5")))
            .hasValueSatisfying(v -> assertThat(v.doubleValue()).isEqualTo(72.5, within(1e-9)));
        assertThat(ActivityEnergyModel.restKcalPerHour(null, null)).isEmpty();
    }

    @Test
    void netKcalIsAboveRestOnly() {
        // (4.0 − 1) × 80 × 2 h = 480 — gross would have been 640
        assertThat(model.netKcal("volleyball", 7, 120, new BigDecimal("80"))).contains(480);
    }

    @Test
    void unknownKindFallsBackToOther() {
        assertThat(model.met("kajak", null)).isEqualTo(4.0);
        assertThat(model.met(null, null)).isEqualTo(4.0);
    }

    @Test
    void honestEmptyNeverZero() {
        assertThat(model.netKcal("gym", null, 0, new BigDecimal("80"))).isEmpty();
        assertThat(model.netKcal("gym", null, -5, new BigDecimal("80"))).isEmpty();
        assertThat(model.netKcal("gym", null, 60, null)).isEmpty();
    }
}

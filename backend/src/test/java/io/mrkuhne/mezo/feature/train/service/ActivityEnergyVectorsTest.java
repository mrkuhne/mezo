package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** FE↔BE drift guard (mezo-32m82): the same vectors are asserted by frontend activityEnergy.test.ts. */
class ActivityEnergyVectorsTest {

    private static final File VECTORS = new File("../api/fixtures/activity-energy-vectors.json");
    private final ActivityEnergyModel model = new ActivityEnergyModel(ActivityEnergyModelTest.props());

    private static BigDecimal dec(JsonNode n) {
        return n == null || n.isNull() ? null : n.decimalValue();
    }

    @Test
    void everyVectorHolds() throws Exception {
        JsonNode root = new ObjectMapper().readTree(VECTORS);
        for (JsonNode v : root.get("restKcalPerHour")) {
            Optional<BigDecimal> got = ActivityEnergyModel.restKcalPerHour(dec(v.get("bmr")), dec(v.get("weightKg")));
            if (v.get("expected").isNull()) {
                assertThat(got).as(v.toString()).isEmpty();
            } else {
                assertThat(got.orElseThrow().doubleValue()).as(v.toString()).isEqualTo(v.get("expected").asDouble());
            }
        }
        for (JsonNode v : root.get("netKcal")) {
            Integer rpe = v.get("rpe").isNull() ? null : v.get("rpe").asInt();
            Optional<Integer> got = model.netKcal(v.get("kind").asText(), rpe, v.get("min").asInt(), dec(v.get("rest")));
            if (v.get("expected").isNull()) {
                assertThat(got).as(v.toString()).isEmpty();
            } else {
                assertThat(got).as(v.toString()).contains(v.get("expected").asInt());
            }
        }
    }
}

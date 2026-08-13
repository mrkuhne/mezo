package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * V3.4 B2+B3: a hipotézis-kör gather() kontextusa a napi összefoglalók MELLÉ hordozza a heti
 * nyers metrika-táblát (nemlineáris sejtésekhez) és a nem-élő párok kapu-diagnosztikáját
 * (hiányzó-adat-hipotézisekhez) — determinisztikus blokkok, LLM nélkül assertálva.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HypothesisGatherContextIT extends AbstractIntegrationTest {

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testGather_shouldIncludeMetricTableAndGateDiagnostics_whenSummariesExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        dailySummaryPopulator.summary(owner, yesterday, "Tegnap jó nap volt.");
        sleepLogPopulator.createSleepLog(owner, yesterday, new BigDecimal("7.5"), 4);

        String context = pipeline.gather(owner);

        assertThat(context).contains("HETI METRIKA-TÁBLA");
        assertThat(context).contains(MetricKey.SLEEP_QUALITY.labelHu());
        assertThat(context).contains("7.5"); // a nyers érték benne van a táblában
        assertThat(context).contains("| –"); // hiányzó nap jele
        assertThat(context).contains("KAPU-DIAGNOSZTIKA (nem-élő párok):");
        // alig van adat: az edzés-RPE pár biztosan nem élő → egysoros diagnosztikája megjelenik
        assertThat(context).contains("sleep-quality~next-day-training-rpe");
        assertThat(context).contains("illesztett napok");
    }

    @Test
    void testGather_shouldStayNull_whenNoSummaries() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(pipeline.gather(owner)).isNull(); // az üres-kontextus kapu változatlan
    }
}

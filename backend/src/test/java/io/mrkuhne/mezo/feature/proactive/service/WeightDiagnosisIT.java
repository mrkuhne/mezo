package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Week-anchored WEIGHT phenomenon gates (mezo-85x5r): the weigh-in floor and the anchor-week
 * reuse — no LLM involvement for either path, so this stays a fast service-level test. The full
 * generator flow (evidence gather + LLM answer + the {@link WeightDecomposition} "számvetés"
 * rows) is exercised below (Task 4).
 */
@ActiveProfiles("companion-fake")
class WeightDiagnosisIT extends AbstractIntegrationTest {

    @Autowired private DiagnosisService diagnosisService;
    @Autowired private DiagnosisGenerator generator;
    @Autowired private DiagnosisRepository diagnosisRepository;
    @Autowired private DiagnosisPopulator diagnosisPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private WeightLogRepository weightLogRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private PatternPopulator patternPopulator;

    private static LocalDate someMonday() {
        LocalDate date = LocalDate.now().minusWeeks(1);
        return date.minusDays(date.getDayOfWeek().getValue() - 1L);
    }

    @Test
    void fewerThanThreeWeighInsIs409() {
        UUID user = userPopulator.createUser("weight-diag-few@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("79.8"));

        assertThatThrownBy(() -> diagnosisService.generate(
                user, DiagnosisEntity.PHENOMENON_WEIGHT, monday))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("DIAGNOSIS_INSUFFICIENT_WEIGHINS")
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void anExistingNonStaleAnchorRowIsReusedWithoutBurningQuota() {
        UUID user = userPopulator.createUser("weight-diag-reuse@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("79.8"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(2), new BigDecimal("79.6"));
        // The existing row was generated AFTER the last weigh-in went in — nothing newer landed.
        Instant generatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        DiagnosisEntity existing = diagnosisPopulator.weightDiagnosis(user, monday, generatedAt);

        Instant dayStart = LocalDate.now().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        Instant dayEnd = LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        long quotaBefore = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);

        var response = diagnosisService.generate(user, DiagnosisEntity.PHENOMENON_WEIGHT, monday);

        assertThat(response.getId()).isEqualTo(existing.getId());
        long quotaAfter = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);
        assertThat(quotaAfter).isEqualTo(quotaBefore);
    }

    /** Reuse must win over the weigh-in gate: a non-stale row already exists for the anchor week,
     *  but a weigh-in that counted toward the {@code >=3} floor at generation time was later
     *  edited/deleted, dropping the LIVE window count below 3. Re-opening the report must still
     *  return the existing row, not 409 — reads are free (spec §3.5). */
    @Test
    void anExistingNonStaleAnchorRowIsReusedEvenIfLiveWeighInsNowFallBelowThree() {
        UUID user = userPopulator.createUser("weight-diag-reuse-below-floor@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("79.8"));
        WeightLogEntity thirdWeighIn =
                weightLogPopulator.createWeightLog(user, monday.plusDays(2), new BigDecimal("79.6"));
        // The existing row was generated AFTER all three weigh-ins went in — nothing newer landed.
        Instant generatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        DiagnosisEntity existing = diagnosisPopulator.weightDiagnosis(user, monday, generatedAt);

        // A weigh-in log gets edited/deleted after generation — the live window now has only 2.
        weightLogRepository.delete(thirdWeighIn);

        Instant dayStart = LocalDate.now().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        Instant dayEnd = LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        long quotaBefore = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);

        var response = diagnosisService.generate(user, DiagnosisEntity.PHENOMENON_WEIGHT, monday);

        assertThat(response.getId()).isEqualTo(existing.getId());
        long quotaAfter = diagnosisRepository.countGeneratedOn(user, dayStart, dayEnd);
        assertThat(quotaAfter).isEqualTo(quotaBefore);
    }

    private void plantSentinel(UUID user, String json) {
        PatternEntity pattern = patternPopulator.createPattern(
                user, "pair-" + UUID.randomUUID().toString().substring(0, 8), "Súly minta");
        pattern.setMechanism("[fake-diagnosis:" + json + "]");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
    }

    /**
     * The full generator flow for the WEIGHT phenomenon (mezo-85x5r §2, Task 4): a rising week of
     * weigh-ins (BODY domain) + a few logged meals (FUEL domain, clearing {@code minDomains}) —
     * NO active goal, so the {@code cél-sáv} row exercises the "nincs aktív cél" branch. The
     * {@link WeightDecomposition} rows are PREPENDED ahead of the recipe's own metric candidates
     * — index 0/1 are "valódi delta"/"cél-sáv" (the ceiling and strength rows are omitted: no
     * kcal-vs-TDEE data, no e1RM history), so a suspect citing evidenceIndex 0 resolves against a
     * derived row, exactly like any other candidate.
     */
    @Test
    void generatesAWeightDiagnosisWithTheDerivedRowsFirstAndASuspectResolvingAgainstOne() {
        UUID user = userPopulator.createUser("weight-diag-full@test.local").getId();
        LocalDate monday = someMonday();
        weightLogPopulator.createWeightLog(user, monday, new BigDecimal("80.0"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(1), new BigDecimal("80.2"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(2), new BigDecimal("80.5"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(3), new BigDecimal("80.7"));
        weightLogPopulator.createWeightLog(user, monday.plusDays(4), new BigDecimal("81.0"));

        PantryItemEntity food = pantryItemPopulator.createFood(user, "Fehér rizs", monday.plusMonths(1));
        mealPopulator.createPantryMeal(user, food, monday);
        mealPopulator.createPantryMeal(user, food, monday.plusDays(1));
        mealPopulator.createPantryMeal(user, food, monday.plusDays(2));

        plantSentinel(user, "{\"verdict\":\"A hét folyamán só/CH-ugrás emelte a mért súlyt.\","
                + "\"confidence\":\"moderate\",\"suspects\":[{\"title\":\"CH-ugrás\","
                + "\"claim\":\"A napi rizs megugrott, glikogénkötés emelte a súlyt.\","
                + "\"evidenceIndexes\":[0],\"strength\":\"moderate\","
                + "\"probe\":{\"text\":\"Tartsd stabilan a szénhidrátot 7 napig.\","
                + "\"metricKey\":\"DAILY_CARBS_G\",\"expectedDirection\":\"down\",\"totalDays\":7}}]}");

        DiagnosisEntity diagnosis = generator.generate(user, LocalDate.now(),
                DiagnosisEntity.PHENOMENON_WEIGHT, monday);

        assertThat(diagnosis).isNotNull();
        assertThat(diagnosis.getPhenomenon()).isEqualTo(DiagnosisEntity.PHENOMENON_WEIGHT);
        assertThat(diagnosis.getAnchorStart()).isEqualTo(monday);

        var items = diagnosis.getEvidence().items();
        assertThat(items).hasSizeGreaterThanOrEqualTo(2);
        assertThat(items.get(0).kind()).isEqualTo("derived");
        assertThat(items.get(0).label()).isEqualTo("valódi delta");
        assertThat(items.get(0).sourceHu()).isEqualTo("számvetés");
        assertThat(items.get(1).kind()).isEqualTo("derived");
        assertThat(items.get(1).label()).isEqualTo("cél-sáv");
        // No active goal ⇒ the band row renders the "sáv nélkül" branch (Task 4 brief).
        assertThat(items.get(1).detail()).isEqualTo("nincs aktív cél — sáv nélkül");
        // The recipe's own metric candidates follow the derived rows, never precede them.
        assertThat(items.stream().skip(2)).allMatch(e -> "metric".equals(e.kind())
                || "pattern".equals(e.kind()) || "fact".equals(e.kind()));

        assertThat(diagnosis.getSuspects().suspects()).hasSize(1);
        assertThat(diagnosis.getSuspects().suspects().get(0).evidenceIndexes()).containsExactly(0);
    }
}

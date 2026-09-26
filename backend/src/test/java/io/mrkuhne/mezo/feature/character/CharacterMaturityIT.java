package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterMaturityProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterMaturityWeekEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterMaturityWeekRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterMaturityJob;
import io.mrkuhne.mezo.feature.character.service.CharacterMaturityService;
import io.mrkuhne.mezo.feature.character.service.CharacterService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Csapatfal érettség-görbe (mezo-a9bo7.11): the weekly per-dimension maturity snapshot and its
 * history read. Fixtures are anchored to a fixed queried week, never to now() — a
 * now-minus-N stamp falls out of a calendar-week query around midnight.
 */
@Transactional
class CharacterMaturityIT extends AbstractIntegrationTest {

    /** A Wednesday; its ISO week starts Monday 2026-09-21. */
    private static final LocalDate WED = LocalDate.of(2026, 9, 23);
    private static final LocalDate MON = LocalDate.of(2026, 9, 21);

    @Autowired private CharacterMaturityService service;
    @Autowired private CharacterMaturityWeekRepository weeks;
    @Autowired private CharacterService characterService;
    @Autowired private CharacterDimensionRepository dimensions;
    @Autowired private CharacterClaimRepository claims;
    @Autowired private UserPopulator userPopulator;
    @Autowired private UserFanOut userFanOut;

    @Test
    void weekStart_isTheIsoMonday() {
        assertThat(CharacterMaturityService.weekStart(LocalDate.of(2026, 9, 27))).isEqualTo(MON); // Sunday
        assertThat(CharacterMaturityService.weekStart(MON)).isEqualTo(MON);
        assertThat(CharacterMaturityService.weekStart(WED)).isEqualTo(MON);
    }

    @Test
    void snapshot_isIdempotentPerWeek_andTheLastRunOfTheWeekWins() {
        UUID owner = seededOwner();
        UUID recovery = dimensions.findByCreatedByAndKey(owner, "recovery").orElseThrow().getId();
        claim(owner, recovery, "0.50");

        assertThat(service.snapshot(owner, WED)).isEqualTo(8);
        claim(owner, recovery, "0.80");
        service.snapshot(owner, WED.plusDays(4)); // Sunday of the same week

        List<CharacterMaturityWeekEntity> rows = weeks.findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(owner, MON, MON);
        assertThat(rows).hasSize(8);
        CharacterMaturityWeekEntity row = rows.stream().filter(w -> w.getDimensionId().equals(recovery)).findFirst().orElseThrow();
        assertThat(row.getMaturity()).isEqualTo((short) 66);
        assertThat(row.getClaimCount()).isEqualTo((short) 2);
        assertThat(row.getMeanConfidence()).isEqualByComparingTo("0.650");
        CharacterMaturityWeekEntity empty = rows.stream().filter(w -> !w.getDimensionId().equals(recovery)).findFirst().orElseThrow();
        assertThat(empty.getMaturity()).isZero();
        assertThat(empty.getMeanConfidence()).isNull();
    }

    @Test
    void snapshot_nextWeek_opensANewRowAndLeavesThePreviousWeekAlone() {
        UUID owner = seededOwner();
        UUID recovery = dimensions.findByCreatedByAndKey(owner, "recovery").orElseThrow().getId();
        claim(owner, recovery, "0.50");
        service.snapshot(owner, WED);
        claim(owner, recovery, "0.80");
        service.snapshot(owner, WED.plusWeeks(1));

        assertThat(weeks.findByCreatedByAndDimensionIdAndWeekStart(owner, recovery, MON).orElseThrow().getMaturity())
                .isEqualTo((short) 40);
        assertThat(weeks.findByCreatedByAndDimensionIdAndWeekStart(owner, recovery, MON.plusWeeks(1)).orElseThrow().getMaturity())
                .isEqualTo((short) 66);
    }

    @Test
    void job_snapshotsEveryActiveUser() {
        UUID owner = seededOwner();
        new CharacterMaturityJob(userFanOut, service, new CharacterMaturityProperties("-", "Europe/Budapest")).run(WED);
        assertThat(weeks.findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(owner, MON, MON)).hasSize(8);
    }

    private UUID seededOwner() {
        UUID owner = userPopulator.createUser().getId();
        characterService.ensureCoreDimensions(owner); // the 7 CORE + 1 META rows
        return owner;
    }

    private void claim(UUID owner, UUID dimensionId, String confidence) {
        var c = new CharacterClaimEntity();
        c.setCreatedBy(owner);
        c.setDimensionId(dimensionId);
        c.setText("Hétköznap 23 előtt fekszik le.");
        c.setConfidence(new BigDecimal(confidence));
        c.setStatus("ACTIVE");
        c.setProposedBy("szomnologus");
        c.setSensitive(false);
        c.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        c.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        c.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claims.saveAndFlush(c);
    }
}

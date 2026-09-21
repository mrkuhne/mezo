package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterClaimRevisionService;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CharacterClaimTemporalIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator populator;
    @Autowired private ClaimLifecycle lifecycle;
    @Autowired private CharacterClaimRepository claims;
    @Autowired private CharacterDimensionRepository dimensions;
    @Autowired private CharacterClaimRevisionService revisions;
    @Autowired private CharacterPromptSource prompt;

    @Test
    void testApply_shouldDeduplicateSamePeriod_whenDailyCouncilRepeatsNormalizedClaim() {
        var owner = databasePopulator.populateUser("temporal@test.local");
        populator.claim(owner);
        var from = LocalDate.of(2026, 9, 1);
        var to = from.plusDays(6);
        var first = lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling("NEW", null, "Heti megfigyelés.", from, to, null, null)));
        var repeated = lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling("NEW", null, "  HETI   megfigyelés.  ", from, to, null, null)));
        var otherPeriod = lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling("NEW", null, "Heti megfigyelés.", from.plusDays(7), to.plusDays(7), null, null)));
        assertThat(first).hasSize(1);
        assertThat(repeated).isEmpty();
        assertThat(otherPeriod).hasSize(1);
        assertThat(revisions.list(owner, UUID.fromString(first.getFirst().claimId()))).hasSize(1);
    }

    @Test
    void testPrompt_shouldExcludeExpiredAndFutureClaimsAndPortrait_whenValidityDoesNotIncludeToday() {
        var owner = databasePopulator.populateUser("temporal@test.local");
        var seed = populator.claim(owner);
        var today = LocalDate.now(ZoneId.of("Europe/Budapest"));
        lifecycle.apply(owner, UUID.randomUUID(), List.of(
                ruling("NEW", null, "Lejárt állítás.", null, null, null, today.minusDays(1)),
                ruling("NEW", null, "Jövőbeli állítás.", null, null, today.plusDays(1), null),
                ruling("NEW", null, "Mai állítás.", null, null, today, today)));
        var dimension = dimensions.findById(seed.getDimensionId()).orElseThrow();
        dimension.setPortrait("Lejárt portré állítása.");
        dimension.setMaturity((short) 90);
        dimensions.saveAndFlush(dimension);
        assertThat(prompt.render(owner)).contains("Mai állítás.").doesNotContain("Lejárt állítás.", "Jövőbeli állítás.", "Lejárt portré");
    }

    @Test
    void testUndo_shouldRestoreTemporalBounds_whenRevisionChangedOnlyDates() {
        var owner = databasePopulator.populateUser("temporal@test.local");
        var claim = populator.claim(owner);
        var from = LocalDate.of(2026, 9, 1);
        var to = from.plusDays(6);
        lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling("REVISE", claim.getId(), claim.getText(), from, to, from, to)));
        var changed = claims.findById(claim.getId()).orElseThrow();
        assertThat(changed.getObservedFrom()).isEqualTo(from);
        assertThat(changed.getValidTo()).isEqualTo(to);
        revisions.undo(owner, revisions.list(owner, claim.getId()).getFirst().getId());
        var restored = claims.findById(claim.getId()).orElseThrow();
        assertThat(restored.getObservedFrom()).isNull();
        assertThat(restored.getValidTo()).isNull();
    }

    @Test
    void testApply_shouldSkipInvalidPeriod_whenBoundsAreInverted() {
        var owner = databasePopulator.populateUser("temporal@test.local");
        populator.claim(owner);
        var from = LocalDate.of(2026, 9, 1);
        assertThat(lifecycle.apply(owner, UUID.randomUUID(), List.of(
                ruling("NEW", null, "Fordított megfigyelés.", from, from.minusDays(1), null, null),
                ruling("NEW", null, "Fordított érvényesség.", null, null, from, from.minusDays(1))))).isEmpty();
    }

    private ClaimRuling ruling(String kind, UUID id, String text, LocalDate observedFrom, LocalDate observedTo,
                              LocalDate validFrom, LocalDate validTo) {
        return new ClaimRuling(new ClaimProposal("drill", kind, "discipline", id, text,
                new BigDecimal("0.60"), false, "Adatablak", observedFrom, observedTo, validFrom, validTo),
                true, new BigDecimal("0.60"), "Időszakos megállapítás");
    }
}

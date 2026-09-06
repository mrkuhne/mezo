package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.DeliberationAssembler;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeliberationAssemblerTest {

    private static ClaimProposal newProposal(String expertKey, String dimensionKey, String text) {
        return new ClaimProposal(expertKey, "NEW", dimensionKey, null, text,
                new BigDecimal("0.50"), false, "Indoklás.");
    }

    @Test
    void assemble_groupsByChapter_andCarriesTheWholeChain() {
        ClaimProposal sleep = newProposal("szomnologus", "recovery", "Romlik az alvás.");
        ClaimProposal mind = newProposal("pszichologus", "recovery", "Feszült hét.");
        ClaimProposal log = newProposal("drill", "discipline", "Kimarad a napló.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(sleep, mind, log),
                List.of(new KonziliumCrossTalkRound.Reaction(0, "pszichologus", "CHALLENGE", "Lehet stressz is.")),
                List.of(new KonziliumVerdictRound.SkepticVerdict(0, "KILL", "Kevés adat."),
                        new KonziliumVerdictRound.SkepticVerdict(1, "KEEP", "Elfogadható."),
                        new KonziliumVerdictRound.SkepticVerdict(2, "KEEP", "Elfogadható.")),
                List.of(new ClaimRuling(sleep, false, new BigDecimal("0.40"), "Nem engedem be."),
                        new ClaimRuling(mind, true, new BigDecimal("0.60"), "Rendben."),
                        new ClaimRuling(log, true, new BigDecimal("0.70"), "Rendben.")),
                Map.of("recovery", "Regeneráció", "discipline", "Fegyelem"),
                Map.of());

        assertThat(envelope.threads()).hasSize(2);
        ConferenceDeliberationEnvelope.Thread recovery = envelope.threads().get(0);
        assertThat(recovery.dimensionKey()).isEqualTo("recovery");
        assertThat(recovery.title()).isEqualTo("Regeneráció");
        assertThat(recovery.items()).hasSize(2);
        ConferenceDeliberationEnvelope.Item first = recovery.items().get(0);
        assertThat(first.expertKey()).isEqualTo("szomnologus");
        assertThat(first.reactions()).singleElement()
                .satisfies(reaction -> assertThat(reaction.expertKey()).isEqualTo("pszichologus"));
        assertThat(first.skeptic().verdict()).isEqualTo("KILL");
        assertThat(first.chair().accepted()).isFalse();
        assertThat(recovery.items().get(1).reactions()).isEmpty();
    }

    @Test
    void assemble_missingSkepticVerdicts_leaveTheItemOpen_neverFabricated() {
        ClaimProposal sleep = newProposal("szomnologus", "recovery", "Romlik az alvás.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(sleep), List.of(), List.of(),
                List.of(new ClaimRuling(sleep, true, new BigDecimal("0.60"), "Rendben.")),
                Map.of("recovery", "Regeneráció"), Map.of());

        ConferenceDeliberationEnvelope.Item item = envelope.threads().get(0).items().get(0);
        assertThat(item.skeptic()).isNull();
        assertThat(item.chair()).isNotNull();
    }

    @Test
    void assemble_claimTargetingProposal_joinsItsClaimsChapter_andKeepsTheClaimId() {
        UUID claimId = UUID.randomUUID();
        ClaimProposal down = new ClaimProposal("szomnologus", "DOWN", null, claimId, "Ez már nem áll.",
                new BigDecimal("0.40"), false, "Az adatok mást mutatnak.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(down), List.of(), List.of(),
                List.of(new ClaimRuling(down, true, new BigDecimal("0.40"), "Rendben.")),
                Map.of("recovery", "Regeneráció"), Map.of(claimId, "recovery"));

        assertThat(envelope.threads()).singleElement().satisfies(thread -> {
            assertThat(thread.dimensionKey()).isEqualTo("recovery");
            assertThat(thread.items().get(0).claimId()).isEqualTo(claimId.toString());
        });
    }

    @Test
    void assemble_unresolvableChapter_stillGetsAThread_titledByItsKey() {
        ClaimProposal orphan = newProposal("drill", "discipline", "Kimarad a napló.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(orphan), List.of(), List.of(),
                List.of(new ClaimRuling(orphan, true, new BigDecimal("0.60"), "Rendben.")),
                Map.of(), Map.of());

        assertThat(envelope.threads()).singleElement()
                .satisfies(thread -> assertThat(thread.title()).isEqualTo("discipline"));
    }

    @Test
    void assemble_claimIdMissingFromChapterMap_fallsBackToHumanTitledBucket() {
        UUID claimId = UUID.randomUUID();
        ClaimProposal orphan = new ClaimProposal("drill", "DOWN", null, claimId, "Ez már nem áll.",
                new BigDecimal("0.40"), false, "Az adatok mást mutatnak.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(orphan), List.of(), List.of(),
                List.of(new ClaimRuling(orphan, true, new BigDecimal("0.40"), "Rendben.")),
                Map.of(), Map.of());

        assertThat(envelope.threads()).singleElement().satisfies(thread -> {
            assertThat(thread.dimensionKey()).isEqualTo("egyeb");
            assertThat(thread.title()).isEqualTo("Egyéb javaslatok");
        });
    }
}

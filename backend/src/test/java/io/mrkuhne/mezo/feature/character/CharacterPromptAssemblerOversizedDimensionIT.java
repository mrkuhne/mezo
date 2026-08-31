package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * I3 (mezo-1gim.8 final review): the total-chars loop must {@code continue} past an oversized
 * dimension block, never {@code break} — one crowded dimension must not silently swallow the
 * whole [Karakter] block. A small {@code max-total-chars} makes even ONE dimension's 3-claim
 * block (each claim capped at 300 chars) blow the budget on its own, isolating the case from
 * {@code CharacterPromptAssemblerIT#render_capsPerDimensionAndTotalChars_dropsWholeLinesOnly},
 * which relies on the default 1800-char budget and needs several dimensions to overflow it.
 */
@TestPropertySource(properties = "mezo.character.prompt.max-total-chars=500")
class CharacterPromptAssemblerOversizedDimensionIT extends ApiIntegrationTest {

    @Autowired private CharacterPromptSource promptSource;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String title, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(title);
        entity.setKind("CORE");
        entity.setExpertKey(expertKey);
        entity.setPortrait("");
        entity.setMaturity((short) 0);
        return dimensionRepository.save(entity);
    }

    private void seedClaim(UUID owner, UUID dimensionId, String text) {
        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimensionId);
        claim.setText(text);
        claim.setConfidence(new BigDecimal("0.90"));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("doki");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(false);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim.setUpdatedAt(Instant.now());
        claimRepository.save(claim);
    }

    @Test
    void render_oversizedFirstDimension_doesNotSuppressASmallerLaterDimension() {
        UUID owner = ownerId();
        // "physical" sorts first (CharacterCoreCatalog order) and alone blows the 500-char budget:
        // 3 long claims, each capped to ~300 chars by CharacterPromptAssembler's per-claim flatten.
        CharacterDimensionEntity physical = seedDimension(owner, "physical", "Fizikai", "doki");
        String padding = "x".repeat(280);
        for (int i = 0; i < 3; i++) {
            seedClaim(owner, physical.getId(), "Hosszú állítás " + i + ": " + padding);
        }
        // "athletic" sorts second and is tiny — it must still make it into the block.
        CharacterDimensionEntity athletic = seedDimension(owner, "athletic", "Sportolói", "edzo");
        seedClaim(owner, athletic.getId(), "Rövid megfigyelés.");

        String block = promptSource.render(owner);

        assertThat(block).doesNotContain("Fizikai (Doki)");
        assertThat(block).contains("Sportolói (Edző):").contains("Rövid megfigyelés.");
    }
}

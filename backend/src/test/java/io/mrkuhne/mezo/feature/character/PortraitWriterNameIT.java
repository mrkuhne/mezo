package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.PortraitWriter;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Proves {@link PortraitWriter#rewrite} actually renders its system prompt through {@link
 * PromptPersona} before the LLM call (S6, mezo-qw37.6, Table A row 27) — the only one of Task 4's
 * four render sites {@code rewrite} does NOT run its raw answer through a JSON parser, it stores
 * {@code raw.strip()} straight onto the dimension's portrait. That makes {@link
 * FakeCompanionLlm#SYSTEM_ECHO_SENTINEL} (planted in the seeded claim's text, which flows into
 * {@code userMessage}) land verbatim as the persisted portrait: the fake short-circuits and echoes
 * the RAW systemPrompt back as its answer, so the persisted prose IS the rendered prompt and the
 * assertion below bites the moment {@code promptPersona.render(...)} is dropped from {@code
 * rewrite}.
 */
@ActiveProfiles("companion-fake")
class PortraitWriterNameIT extends ApiIntegrationTest {

    @Autowired private PortraitWriter portraitWriter;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void rewrite_shouldNameTheOwner_whenSystemPromptIsRendered() {
        UUID owner = ownerId();

        CharacterDimensionEntity dimension = new CharacterDimensionEntity();
        dimension.setCreatedBy(owner);
        dimension.setKey("discipline");
        dimension.setTitle("Fegyelem");
        dimension.setKind("CORE");
        dimension.setExpertKey("drill");
        dimension = dimensionRepository.save(dimension);

        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimension.getId());
        claim.setText("3 napja nincs kaja-log. " + FakeCompanionLlm.SYSTEM_ECHO_SENTINEL);
        claim.setConfidence(new BigDecimal("0.80"));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("drill");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(false);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim = claimRepository.save(claim);

        boolean rewritten = portraitWriter.rewrite(owner, dimension, List.of(claim), UUID.randomUUID());

        assertThat(rewritten).isTrue();
        // the persisted portrait IS the rendered system prompt (see class javadoc) — proves
        // promptPersona.render(...) actually ran, using the SAME field OwnerSeedData seeds the
        // fixture owner with (never a hardcoded name).
        assertThat(dimension.getPortrait())
                .contains(ownerProperties.ownerName())
                .doesNotContain(PromptPersona.NAME_TOKEN)
                .doesNotContain("Daniel");
    }
}

package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterClaimRevisionService;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.CharacterReplyEvaluation;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.feature.character.service.DeliberationAssembler;
import io.mrkuhne.mezo.feature.character.service.KonziliumChapters;
import java.util.Map;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CharacterClaimRevisionIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator populator;
    @Autowired private CharacterClaimRevisionService revisions;
    @Autowired private ClaimLifecycle lifecycle;
    @Autowired private CharacterClaimRepository claims;
    @Autowired private CharacterDimensionRepository dimensions;

    @Test
    void testUndo_shouldRestoreSnapshotAndInvalidatePortrait_whenRevisionIsLatest() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        var dimension = dimensions.findById(claim.getDimensionId()).orElseThrow();
        dimension.setPortrait("Elavult portré");
        dimensions.saveAndFlush(dimension);
        lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling(claim.getId(), "REVISE", "Csak kedden edz.")));
        var revision = revisions.list(owner, claim.getId()).getFirst();
        assertThat(revision.getBeforeSnapshot().text()).isEqualTo(claim.getText());
        assertThat(revision.getAfterSnapshot().text()).isEqualTo("Csak kedden edz.");

        revisions.undo(owner, revision.getId());
        revisions.undo(owner, revision.getId());

        var restored = claims.findById(claim.getId()).orElseThrow();
        assertThat(restored.getText()).isEqualTo(claim.getText());
        assertThat(restored.getConfidence()).isEqualByComparingTo(claim.getConfidence());
        assertThat(restored.getEvidence()).isEqualTo(claim.getEvidence());
        assertThat(dimensions.findById(claim.getDimensionId()).orElseThrow().getPortrait()).isEmpty();
        assertThat(revisions.list(owner, claim.getId()).getFirst().getUndoneAt()).isNotNull();
    }

    @Test
    void testUndo_shouldAllowMatchingDatabasePrecision_whenModelConfidenceHasDifferentScale() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        lifecycle.apply(owner, UUID.randomUUID(), List.of(new ClaimRuling(
                new ClaimProposal("drill", "UP", null, claim.getId(), claim.getText(),
                        new BigDecimal("0.6"), false, "Új bizonyíték"), true, new BigDecimal("0.6"), "Emelés")));
        var revision = revisions.list(owner, claim.getId()).getFirst();
        assertThat(revisions.canUndo(revision)).isTrue();
        revisions.undo(owner, revision.getId());
        assertThat(claims.findById(claim.getId()).orElseThrow().getConfidence()).isEqualByComparingTo(claim.getConfidence());
    }

    @Test
    void testUndo_shouldRejectStaleRevision_whenClaimChangedAgain() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling(claim.getId(), "UP", claim.getText())));
        var first = revisions.list(owner, claim.getId()).getFirst();
        lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling(claim.getId(), "DOWN", claim.getText())));
        assertThatThrownBy(() -> revisions.undo(owner, first.getId())).isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(revisions.canUndo(first)).isFalse();
    }

    @Test
    void testListAndUndo_shouldHideForeignRevision_whenAnotherOwnerCalls() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var other = databasePopulator.populateUser("revision-other@test.local");
        var claim = populator.claim(owner);
        lifecycle.apply(owner, UUID.randomUUID(), List.of(ruling(claim.getId(), "RETIRE", claim.getText())));
        var revision = revisions.list(owner, claim.getId()).getFirst();
        assertThatThrownBy(() -> revisions.list(other, claim.getId())).isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> revisions.undo(other, revision.getId())).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUndo_shouldRetireNewClaim_whenThereWasNoPreviousState() {
        var owner = databasePopulator.populateUser("revision@test.local");
        populator.claim(owner);
        var changes = lifecycle.apply(owner, UUID.randomUUID(), List.of(new ClaimRuling(
                new ClaimProposal("drill", "NEW", "discipline", null, "Új megfigyelés.",
                        new BigDecimal("0.60"), false, "Jel"), true, new BigDecimal("0.60"), "Indok")));
        var id = UUID.fromString(changes.getFirst().claimId());
        var revision = revisions.list(owner, id).getFirst();
        assertThat(revision.getBeforeSnapshot()).isNull();
        assertThat(revisions.canUndo(revision)).isTrue();
        revisions.undo(owner, revision.getId());
        assertThat(claims.findById(id).orElseThrow().getStatus()).isEqualTo("RETIRED");
    }

    @Test
    void testUndo_shouldRestoreChapterAndText_whenMoved() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        var chapter = lifecycle.openChapters(owner, UUID.randomUUID(),
                List.of(new KonziliumVerdictRound.ChapterProposal("Regeneracio", "Új fejezet"))).getFirst();
        lifecycle.apply(owner, UUID.randomUUID(), List.of(new ClaimRuling(new ClaimProposal("drill", "MOVE",
                chapter.dimensionKey(), claim.getId(), "Ezt a szöveget nem szabad átírni.",
                new BigDecimal("0.60"), false, "Más témához tartozik"), true, null, "Áthelyezés")));
        assertThat(claims.findById(claim.getId()).orElseThrow().getText()).isEqualTo(claim.getText());
        assertThat(claims.findById(claim.getId()).orElseThrow().getDimensionId()).isNotEqualTo(claim.getDimensionId());
        revisions.undo(owner, revisions.list(owner, claim.getId()).getFirst().getId());
        assertThat(claims.findById(claim.getId()).orElseThrow().getDimensionId()).isEqualTo(claim.getDimensionId());
    }

    @Test
    void testApplyReply_shouldAuditSelfReport_whenClaimIsCorrected() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        var reply = populator.savedReply(owner, claim, "Csak kedden edzem.");
        lifecycle.applyReply(reply, new CharacterReplyEvaluation.Verdict("UPDATED", "Felhasználói pontosítás", "Csak kedden edz."));
        var revision = revisions.list(owner, claim.getId()).getFirst();
        assertThat(revision.getOperation()).isEqualTo("REPLY");
        assertThat(revision.getAfterSnapshot().text()).startsWith("Saját beszámolód szerint:");
        assertThat(revision.getAfterSnapshot().evidence().refs()).singleElement().satisfies(ref ->
                assertThat(ref.id()).isEqualTo(reply.getId().toString()));
        revisions.undo(owner, revision.getId());
        assertThat(claims.findById(claim.getId()).orElseThrow().getUserFeedback()).isEqualTo(claim.getUserFeedback());
    }

    private ClaimRuling ruling(UUID claimId, String kind, String text) {
        return new ClaimRuling(new ClaimProposal("drill", kind, null, claimId, text,
                new BigDecimal("0.60"), false, "Ellenőrzött adatok"), true, new BigDecimal("0.60"), "Pontosítás");
    }

    @Test
    void testApplyAndBind_shouldBindNewClaimAndMarkDuplicateUnapplied_whenSameProposalRepeats() {
        var owner = databasePopulator.populateUser("revision@test.local");
        populator.claim(owner);
        var proposal = new ClaimProposal("drill", "NEW", "discipline", null, "Új állítás.",
                new BigDecimal("0.60"), false, "Új adat");
        var accepted = new ClaimRuling(proposal, true, new BigDecimal("0.60"), "Menthető");
        var deliberation = DeliberationAssembler.assemble(List.of(proposal, proposal), List.of(), List.of(),
                List.of(accepted, accepted), new KonziliumChapters(Map.of("discipline", "Fegyelem"), Map.of()));
        var applied = lifecycle.applyAndBind(owner, UUID.randomUUID(), List.of(accepted, accepted), deliberation);
        assertThat(applied.changes()).hasSize(1);
        var items = applied.deliberation().threads().getFirst().items();
        assertThat(items.getFirst().claimId()).isEqualTo(applied.changes().getFirst().claimId());
        assertThat(items.getFirst().chair().accepted()).isTrue();
        assertThat(items.get(1).chair().accepted()).isFalse();
        assertThat(items.get(1).claimId()).isNull();
        assertThat(items.get(1).chair().reason()).contains("nem történt");
    }

    @Test
    void testApply_shouldNotRecreateUndoneNewClaim_whenSameEvidenceReturns() {
        var owner = databasePopulator.populateUser("revision@test.local");
        populator.claim(owner);
        var proposal = new ClaimProposal("drill", "NEW", "discipline", null, "Visszavont állítás.",
                new BigDecimal("0.60"), false, "Ugyanaz az adat");
        var accepted = new ClaimRuling(proposal, true, new BigDecimal("0.60"), "Menthető");
        var created = lifecycle.apply(owner, UUID.randomUUID(), List.of(accepted)).getFirst();
        var revision = revisions.list(owner, UUID.fromString(created.claimId())).getFirst();
        revisions.undo(owner, revision.getId());
        assertThat(lifecycle.apply(owner, UUID.randomUUID(), List.of(accepted))).isEmpty();
    }

    @Test
    void testApplyReply_shouldFollowCurrentClaimDimension_whenQueuedReplyPredatesMove() {
        var owner = databasePopulator.populateUser("revision@test.local");
        var claim = populator.claim(owner);
        var reply = populator.savedReply(owner, claim, "Kedden edzem.");
        var chapter = lifecycle.openChapters(owner, UUID.randomUUID(),
                List.of(new KonziliumVerdictRound.ChapterProposal("Regeneracio", "Téma"))).getFirst();
        lifecycle.apply(owner, UUID.randomUUID(), List.of(new ClaimRuling(new ClaimProposal("drill", "MOVE",
                chapter.dimensionKey(), claim.getId(), claim.getText(), new BigDecimal("0.50"), false, "Téma"),
                true, null, "Áthelyezés")));
        lifecycle.applyReply(reply, new CharacterReplyEvaluation.Verdict("UPDATED", "Pontosítás", "Kedden edz."));
        assertThat(reply.getDimensionKey()).isEqualTo(chapter.dimensionKey());
        assertThat(claims.findById(claim.getId()).orElseThrow().getDimensionId())
                .isEqualTo(dimensions.findByCreatedByAndKey(owner, chapter.dimensionKey()).orElseThrow().getId());
    }
}

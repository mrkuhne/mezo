package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.boot.test.context.TestComponent;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@TestComponent
@RequiredArgsConstructor
public class CharacterReplyPopulator {
    private final CharacterDimensionRepository dimensions;
    private final CharacterClaimRepository claims;
    private final CharacterObservationRepository observations;
    private final CharacterReplyRepository replies;
    private final CharacterConferenceRepository conferences;

    public CharacterClaimEntity claim(UUID owner) {
        var d =
                dimensions
                        .findByCreatedByAndKey(owner, "discipline")
                        .orElseGet(
                                () -> {
                                    var row = new CharacterDimensionEntity();
                                    row.setCreatedBy(owner);
                                    row.setKey("discipline");
                                    row.setTitle("Fegyelem");
                                    row.setKind("CORE");
                                    row.setExpertKey("drill");
                                    return dimensions.saveAndFlush(row);
                                });
        var c = new CharacterClaimEntity();
        c.setCreatedBy(owner);
        c.setDimensionId(d.getId());
        c.setText("Minden reggel edz.");
        c.setConfidence(new BigDecimal("0.50"));
        c.setStatus("ACTIVE");
        c.setProposedBy("drill");
        c.setSensitive(false);
        c.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        c.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        c.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        return claims.saveAndFlush(c);
    }

    public CharacterObservationEntity observation(UUID owner) {
        var o = new CharacterObservationEntity();
        o.setCreatedBy(owner);
        o.setExpertKey("drill");
        o.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        o.setDay(LocalDate.now());
        o.setText("A reggeli edzés gyakori.");
        o.setSalience((short) 3);
        o.setSignals(new ObservationSignalsEnvelope(List.of()));
        return observations.saveAndFlush(o);
    }

    public CharacterReplyEntity savedReply(UUID owner, CharacterClaimEntity claim, String text) {
        var r = new CharacterReplyEntity();
        r.setCreatedBy(owner);
        r.setSourceType("CLAIM");
        r.setSourceId(claim.getId());
        r.setSourceIndex(0);
        r.setSourceText(claim.getText());
        r.setSourceEvidence("[]");
        r.setText(text);
        r.setClientRequestId(UUID.randomUUID());
        r.setAuthorName("Teszt");
        r.setExpertKey("drill");
        r.setDimensionKey("discipline");
        r.setClaimId(claim.getId());
        r.setStatus("SAVED");
        return replies.saveAndFlush(r);
    }

    public CharacterConferenceEntity conference(UUID owner, CharacterClaimEntity claim) {
        var c = new CharacterConferenceEntity();
        c.setCreatedBy(owner);
        c.setKind("BOOTSTRAP");
        c.setGeneratedAt(Instant.now());
        c.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        c.setOutcome(
                new ConferenceOutcomeEnvelope(
                        List.of(
                                new ConferenceOutcomeEnvelope.Change(
                                        "CLAIM_ACCEPTED",
                                        "discipline",
                                        claim.getId().toString(),
                                        claim.getText()))));
        return conferences.saveAndFlush(c);
    }
}

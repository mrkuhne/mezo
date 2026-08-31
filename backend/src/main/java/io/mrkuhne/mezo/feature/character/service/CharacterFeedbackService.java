package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daniel's answer to one claim — talál / nem igaz / pontosítom (Karakter spec §7, mezo-1gim.10).
 * Pure persistence, no LLM call: gated on {@link FeaturesConfiguration#CHARACTER_SWITCH} alone
 * (unlike {@link ClaimLifecycle}, which additionally requires
 * {@link FeaturesConfiguration#COMPANION_SWITCH}) so the companion-off quadrant of the app can
 * still answer feedback on claims that already exist.
 *
 * <p>Every answer, whatever its kind, does two things: it appends one {@link ClaimFeedbackEnvelope.Event}
 * to the claim (an honest, append-only log of what Daniel said), and it writes one
 * {@link CharacterObservationEntity} authored by {@link #USER_EXPERT_KEY} carrying a
 * {@value #SIGNAL_KEY} signal that references the claim — so the next konzílium sees the answer
 * as ordinary evidence, unconsumed until then.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterFeedbackService {

    /** Expert persona key for feedback-born observations — Daniel himself, not an LLM persona. */
    public static final String USER_EXPERT_KEY = "user";

    /** {@link ObservationSignalsEnvelope.Signal#detectorKey()} for every feedback observation. */
    public static final String SIGNAL_KEY = "user-feedback";

    private static final String KIND_TALAL = "TALAL";
    private static final String KIND_NEM_IGAZ = "NEM_IGAZ";
    private static final String KIND_PONTOSITOM = "PONTOSITOM";

    private static final String RETIRED = "RETIRED";

    /** Cause prefix stamped on every {@link ClaimConfidenceHistoryEnvelope.Point} this service
     *  appends — marks a confidence movement as user-driven (self-confirmation), as opposed to
     *  the plain {@code "konzílium"}/{@code "konzílium: nyugdíjazva"} causes {@link ClaimLifecycle}
     *  stamps for expert-ruled movements. */
    private static final String CAUSE_PREFIX = "felhasználói visszajelzés";
    private static final String CAUSE_TALAL = CAUSE_PREFIX + ": talál";
    private static final String CAUSE_NEM_IGAZ = CAUSE_PREFIX + ": nem igaz";

    /** A TALAL answer alone can push a claim's confidence up by this much... */
    private static final BigDecimal TALAL_STEP = new BigDecimal("0.05");
    /** ...but never past this ceiling — deliberately lower than the 0.95 konzílium ceiling
     *  ({@link ClaimLifecycle}): self-confirmation cannot saturate a claim on its own. */
    private static final BigDecimal TALAL_MAX_CONFIDENCE = new BigDecimal("0.85");

    private static final short SALIENCE_TALAL = 3;
    private static final short SALIENCE_RETIRE = 5;
    private static final short SALIENCE_CORRECTION = 5;

    private final CharacterClaimRepository claimRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterObservationRepository observationRepository;

    /**
     * Applies one feedback answer to one claim, owner-scoped: 404 for an unknown or foreign
     * claim id, 409 if it is already RETIRED (nothing left to answer), 400 if {@code text} and
     * {@code kind} disagree (PONTOSITOM requires it, TALAL/NEM_IGAZ forbid it). Returns the
     * updated row.
     */
    @Transactional
    public CharacterClaimEntity apply(UUID owner, UUID claimId, String kind, String text) {
        validateText(kind, text);

        CharacterClaimEntity claim = claimRepository.findByIdAndCreatedBy(claimId, owner)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_CLAIM_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (RETIRED.equals(claim.getStatus())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_CLAIM_ALREADY_RETIRED").build(), HttpStatus.CONFLICT);
        }

        Instant now = Instant.now();
        String observationText;
        short salience;
        switch (kind) {
            case KIND_TALAL -> {
                observationText = "A felhasználó megerősítette: \"" + claim.getText() + "\"";
                salience = SALIENCE_TALAL;
                BigDecimal newConfidence = bumpForTalal(claim.getConfidence());
                if (newConfidence.compareTo(claim.getConfidence()) != 0) {
                    claim.setConfidenceHistory(
                            appendHistory(claim.getConfidenceHistory(), newConfidence, CAUSE_TALAL, now));
                    claim.setConfidence(newConfidence);
                }
            }
            case KIND_NEM_IGAZ -> {
                observationText = "A felhasználó cáfolta: \"" + claim.getText() + "\"";
                salience = SALIENCE_RETIRE;
                claim.setStatus(RETIRED);
                claim.setConfidenceHistory(
                        appendHistory(claim.getConfidenceHistory(), claim.getConfidence(), CAUSE_NEM_IGAZ, now));
            }
            case KIND_PONTOSITOM -> {
                observationText = "A felhasználó pontosította: \"" + claim.getText() + "\" — " + text;
                salience = SALIENCE_CORRECTION;
            }
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "kind").build(), HttpStatus.BAD_REQUEST);
        }

        claim.setUserFeedback(appendFeedbackEvent(claim.getUserFeedback(), kind, text, now));
        claim.setUpdatedAt(now);
        claimRepository.save(claim);

        writeObservation(owner, claim, observationText, salience, now);

        return claim;
    }

    private void validateText(String kind, String text) {
        boolean requiresText = KIND_PONTOSITOM.equals(kind);
        boolean hasText = text != null && !text.isBlank();
        if (requiresText && !hasText) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_REQUIRED_FIELD", "text").build(), HttpStatus.BAD_REQUEST);
        }
        if (!requiresText && hasText) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "text").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * The TALAL cap rule (Karakter S6 spec §7, fix round 1): a flat ceiling at
     * {@link #TALAL_MAX_CONFIDENCE} (0.85) — a TALAL answer alone can never push a claim's
     * confidence past it, no matter how many times Daniel confirms the same claim.
     * Self-confirmation must not be able to saturate a claim without new evidence; only a
     * konzílium (which can rule confidence up to its own, higher 0.95 ceiling — see
     * {@link ClaimLifecycle}) supplies that evidence. A claim the konzílium already raised above
     * 0.85 is left exactly where it is — TALAL never drags it back down to the ceiling — a later
     * TALAL on it is simply a no-op on the number. Either way (moved or not) the caller still
     * appends the event and writes the observation: the answer is a signal even when the number
     * cannot move. Otherwise the new confidence is {@code min(current + 0.05, 0.85)}.
     */
    private static BigDecimal bumpForTalal(BigDecimal current) {
        if (current.compareTo(TALAL_MAX_CONFIDENCE) >= 0) {
            return current;
        }
        BigDecimal bumped = current.add(TALAL_STEP);
        return bumped.compareTo(TALAL_MAX_CONFIDENCE) > 0 ? TALAL_MAX_CONFIDENCE : bumped;
    }

    private static ClaimConfidenceHistoryEnvelope appendHistory(ClaimConfidenceHistoryEnvelope history,
                                                                 BigDecimal value, String cause, Instant at) {
        List<ClaimConfidenceHistoryEnvelope.Point> points = new ArrayList<>(history.points());
        points.add(new ClaimConfidenceHistoryEnvelope.Point(value, cause, at));
        return new ClaimConfidenceHistoryEnvelope(points);
    }

    private static ClaimFeedbackEnvelope appendFeedbackEvent(ClaimFeedbackEnvelope envelope, String kind,
                                                               String text, Instant at) {
        List<ClaimFeedbackEnvelope.Event> events = new ArrayList<>(envelope.events());
        events.add(new ClaimFeedbackEnvelope.Event(kind, text, at));
        return new ClaimFeedbackEnvelope(events);
    }

    private void writeObservation(UUID owner, CharacterClaimEntity claim, String text, short salience, Instant now) {
        String dimensionKey = dimensionRepository.findById(claim.getDimensionId())
                .map(CharacterDimensionEntity::getKey)
                .orElse(null);
        CharacterObservationEntity observation = new CharacterObservationEntity();
        observation.setCreatedBy(owner);
        observation.setExpertKey(USER_EXPERT_KEY);
        observation.setDay(LocalDate.now());
        observation.setText(text);
        observation.setSalience(salience);
        observation.setDimensionKeys(new ObservationDimensionKeysEnvelope(
                dimensionKey == null ? List.of() : List.of(dimensionKey)));
        observation.setSignals(new ObservationSignalsEnvelope(
                List.of(new ObservationSignalsEnvelope.Signal(SIGNAL_KEY, text, List.of(claim.getId().toString())))));
        observation.setConsumedByConferenceId(null);
        observationRepository.save(observation);
    }
}

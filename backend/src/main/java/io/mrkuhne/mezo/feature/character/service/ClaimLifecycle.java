package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pure persistence for the weekly konzílium's rulings (Karakter spec §4/§6, mezo-1gim.5): no LLM
 * calls here — {@link KonziliumVerdictRound} already decided what happens, this class only turns
 * an accepted {@link ClaimRuling} into a row change (or a rejected chapter proposal into an open
 * dossier chapter). An unknown/foreign claim id is a silent skip (never a throw) — the transcript
 * already carries the honest outcome.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class ClaimLifecycle {

    private static final String ACTIVE = "ACTIVE";
    private static final String RETIRED = "RETIRED";
    private static final String CHAPTER = "CHAPTER";
    private static final String CAUSE_KONZILIUM = "konzílium";
    private static final String CAUSE_RETIRED = "konzílium: nyugdíjazva";
    private static final BigDecimal MIN_CLAIM_CONFIDENCE = new BigDecimal("0.05");
    private static final BigDecimal MAX_CLAIM_CONFIDENCE = new BigDecimal("0.95");
    private static final BigDecimal CONFIDENCE_STEP = new BigDecimal("0.10");
    /** Defensive re-clamp on NEW inserts (mirrors KonziliumVerdictRound's own [0.30, 0.90]
     *  accepted-ruling clamp) so the invariant holds regardless of caller. */
    private static final BigDecimal MIN_NEW_CONFIDENCE = new BigDecimal("0.30");
    private static final BigDecimal MAX_NEW_CONFIDENCE = new BigDecimal("0.90");
    private static final int MAX_KEY_LENGTH = 40;

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;

    /** Applies every ACCEPTED ruling as a row change; rejected rulings leave no trace. */
    @Transactional
    public List<ConferenceOutcomeEnvelope.Change> apply(UUID owner, UUID conferenceId, List<ClaimRuling> rulings) {
        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        for (ClaimRuling ruling : rulings) {
            if (!ruling.accepted()) {
                continue;
            }
            ConferenceOutcomeEnvelope.Change change = switch (ruling.proposal().kind()) {
                case "NEW" -> applyNew(owner, conferenceId, ruling);
                case "UP" -> applyMove(owner, ruling, true);
                case "DOWN" -> applyMove(owner, ruling, false);
                case "RETIRE" -> applyRetire(owner, ruling);
                default -> null;
            };
            if (change != null) {
                changes.add(change);
            }
        }
        return changes;
    }

    /** Opens each accepted chapter proposal as a new {@code CHAPTER} dimension. */
    @Transactional
    public List<ConferenceOutcomeEnvelope.Change> openChapters(UUID owner, UUID conferenceId,
                                                                List<KonziliumVerdictRound.ChapterProposal> chapters) {
        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        for (KonziliumVerdictRound.ChapterProposal chapter : chapters) {
            if (chapter.title() == null || chapter.title().isBlank()) {
                continue;
            }
            String key = uniqueSlug(owner, chapter.title());
            CharacterDimensionEntity entity = new CharacterDimensionEntity();
            entity.setCreatedBy(owner);
            entity.setKey(key);
            entity.setTitle(chapter.title());
            entity.setKind(CHAPTER);
            entity.setExpertKey(null);
            entity.setPortrait("");
            entity.setMaturity((short) 0);
            dimensionRepository.save(entity);
            changes.add(new ConferenceOutcomeEnvelope.Change("CHAPTER_OPENED", key, null, chapter.title()));
        }
        return changes;
    }

    private ConferenceOutcomeEnvelope.Change applyNew(UUID owner, UUID conferenceId, ClaimRuling ruling) {
        ClaimProposal proposal = ruling.proposal();
        Optional<CharacterDimensionEntity> dimension =
                dimensionRepository.findByCreatedByAndKey(owner, proposal.dimensionKey());
        if (dimension.isEmpty()) {
            log.warn("NEW claim skipped for owner {} — unknown dimension {}", owner, proposal.dimensionKey());
            return null;
        }
        BigDecimal confidence = clampNewConfidence(ruling.ruledConfidence());
        Instant now = Instant.now();
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimension.get().getId());
        entity.setText(proposal.text());
        entity.setConfidence(confidence);
        entity.setStatus(ACTIVE);
        entity.setOriginConferenceId(conferenceId);
        entity.setProposedBy(proposal.expertKey());
        entity.setSensitive(proposal.sensitive());
        entity.setEvidence(new ClaimEvidenceEnvelope(
                List.of(new ClaimEvidenceEnvelope.Ref("conference", conferenceId.toString(), "konzílium"))));
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(confidence, CAUSE_KONZILIUM, now))));
        entity.setUpdatedAt(now);
        claimRepository.save(entity);
        return new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", proposal.dimensionKey(),
                entity.getId().toString(), proposal.text());
    }

    private ConferenceOutcomeEnvelope.Change applyMove(UUID owner, ClaimRuling ruling, boolean up) {
        ClaimProposal proposal = ruling.proposal();
        Optional<CharacterClaimEntity> found =
                claimRepository.findByIdAndCreatedByAndStatus(proposal.claimId(), owner, ACTIVE);
        if (found.isEmpty()) {
            log.warn("{} claim skipped for owner {} — unknown/foreign claim {}",
                    up ? "UP" : "DOWN", owner, proposal.claimId());
            return null;
        }
        CharacterClaimEntity entity = found.get();
        BigDecimal newConfidence = ruling.ruledConfidence();
        if (newConfidence == null) {
            newConfidence = up ? entity.getConfidence().add(CONFIDENCE_STEP)
                    : entity.getConfidence().subtract(CONFIDENCE_STEP);
        }
        newConfidence = clampClaimConfidence(newConfidence);
        Instant now = Instant.now();
        entity.setConfidence(newConfidence);
        entity.setConfidenceHistory(appendHistory(entity.getConfidenceHistory(), newConfidence, CAUSE_KONZILIUM, now));
        entity.setUpdatedAt(now);
        claimRepository.save(entity);
        String dimensionKey = dimensionKeyOf(entity);
        return new ConferenceOutcomeEnvelope.Change(up ? "CLAIM_CONFIDENCE_UP" : "CLAIM_CONFIDENCE_DOWN",
                dimensionKey, entity.getId().toString(), proposal.text());
    }

    private ConferenceOutcomeEnvelope.Change applyRetire(UUID owner, ClaimRuling ruling) {
        ClaimProposal proposal = ruling.proposal();
        Optional<CharacterClaimEntity> found =
                claimRepository.findByIdAndCreatedByAndStatus(proposal.claimId(), owner, ACTIVE);
        if (found.isEmpty()) {
            log.warn("RETIRE claim skipped for owner {} — unknown/foreign claim {}", owner, proposal.claimId());
            return null;
        }
        CharacterClaimEntity entity = found.get();
        Instant now = Instant.now();
        entity.setStatus(RETIRED);
        entity.setConfidenceHistory(
                appendHistory(entity.getConfidenceHistory(), entity.getConfidence(), CAUSE_RETIRED, now));
        entity.setUpdatedAt(now);
        claimRepository.save(entity);
        String dimensionKey = dimensionKeyOf(entity);
        return new ConferenceOutcomeEnvelope.Change("CLAIM_RETIRED", dimensionKey,
                entity.getId().toString(), proposal.text());
    }

    private String dimensionKeyOf(CharacterClaimEntity claim) {
        return dimensionRepository.findById(claim.getDimensionId())
                .map(CharacterDimensionEntity::getKey)
                .orElse(null);
    }

    private static ClaimConfidenceHistoryEnvelope appendHistory(ClaimConfidenceHistoryEnvelope history,
                                                                 BigDecimal value, String cause, Instant at) {
        List<ClaimConfidenceHistoryEnvelope.Point> points = new ArrayList<>(history.points());
        points.add(new ClaimConfidenceHistoryEnvelope.Point(value, cause, at));
        return new ClaimConfidenceHistoryEnvelope(points);
    }

    private static BigDecimal clampNewConfidence(BigDecimal value) {
        BigDecimal v = value == null ? MIN_NEW_CONFIDENCE : value;
        if (v.compareTo(MIN_NEW_CONFIDENCE) < 0) {
            return MIN_NEW_CONFIDENCE;
        }
        if (v.compareTo(MAX_NEW_CONFIDENCE) > 0) {
            return MAX_NEW_CONFIDENCE;
        }
        return v;
    }

    private static BigDecimal clampClaimConfidence(BigDecimal value) {
        if (value.compareTo(MIN_CLAIM_CONFIDENCE) < 0) {
            return MIN_CLAIM_CONFIDENCE;
        }
        if (value.compareTo(MAX_CLAIM_CONFIDENCE) > 0) {
            return MAX_CLAIM_CONFIDENCE;
        }
        return value;
    }

    private String uniqueSlug(UUID owner, String title) {
        String base = slugify(title);
        String candidate = base;
        int n = 2;
        while (dimensionRepository.findByCreatedByAndKey(owner, candidate).isPresent()) {
            String suffix = "-" + n;
            int maxBaseLength = Math.max(0, MAX_KEY_LENGTH - suffix.length());
            String truncatedBase = base.length() > maxBaseLength ? base.substring(0, maxBaseLength) : base;
            candidate = truncatedBase + suffix;
            n++;
        }
        return candidate;
    }

    private static String slugify(String title) {
        String slug = title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (slug.isEmpty()) {
            slug = "fejezet";
        }
        if (slug.length() > MAX_KEY_LENGTH) {
            slug = slug.substring(0, MAX_KEY_LENGTH);
        }
        return slug;
    }
}

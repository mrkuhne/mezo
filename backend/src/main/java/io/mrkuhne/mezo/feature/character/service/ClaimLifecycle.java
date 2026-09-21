package io.mrkuhne.mezo.feature.character.service;

import jakarta.persistence.LockModeType;
import io.mrkuhne.mezo.feature.character.entity.ClaimRevisionSnapshot;
import java.time.temporal.ChronoUnit;

import jakarta.persistence.EntityManager;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;

import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

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
import java.time.LocalDate;
import java.text.Normalizer;
import java.util.Objects;
import java.util.Map;
import java.util.LinkedHashMap;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
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
    private final EntityManager entityManager;
    private final CharacterClaimRevisionService revisions;
    private final CharacterMutationLock mutationLock;

    /** A targeted user correction changes only its server-resolved claim/dimension. Evidence is
     * explicitly self-report and the reply worker commits this with its outcome exactly once. */
    @Transactional
    public void applyReply(CharacterReplyEntity reply,
                           CharacterReplyEvaluation.Verdict verdict) {
        mutationLock.lock(reply.getCreatedBy());
        CharacterDimensionEntity dimension;
        CharacterClaimEntity claim;
        ClaimRevisionSnapshot before = null;
        if (reply.getClaimId() != null) {
            claim = claimRepository.lockOwned(reply.getClaimId(), reply.getCreatedBy()).orElseThrow();
            entityManager.refresh(claim, LockModeType.PESSIMISTIC_WRITE);
            before = ClaimRevisionSnapshot.of(claim);
            if (!ACTIVE.equals(claim.getStatus())) throw new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_REPLY_SOURCE_CHANGED").build());
            // A queued reply may predate a MOVE. Mutate and rebuild the current dimension,
            // while the original source text/evidence remains the conversation's history.
            dimension = dimensionRepository.findByIdAndCreatedBy(claim.getDimensionId(), reply.getCreatedBy()).orElseThrow();
            reply.setDimensionKey(dimension.getKey());
        } else {
            dimension = dimensionRepository.findByCreatedByAndKey(reply.getCreatedBy(), reply.getDimensionKey()).orElseThrow();
            claim = new CharacterClaimEntity();
            claim.setCreatedBy(reply.getCreatedBy()); claim.setDimensionId(dimension.getId());
            claim.setConfidence(new BigDecimal("0.50")); claim.setStatus(ACTIVE);
            claim.setProposedBy("user"); claim.setSensitive(true);
            claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
            claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
            claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if ("WITHDRAWN".equals(verdict.outcome())) claim.setStatus(RETIRED);
        else claim.setText("Saját beszámolód szerint: " + CharacterReplyService.flat(verdict.revisedText())
                .replaceFirst("^Saját beszámolód szerint[: ,]*", ""));
        var evidence = new ArrayList<>(claim.getEvidence().refs());
        evidence.add(new ClaimEvidenceEnvelope.Ref("character_reply", reply.getId().toString(), "felhasználói önbeszámoló"));
        claim.setEvidence(new ClaimEvidenceEnvelope(evidence));
        var feedback = new ArrayList<>(claim.getUserFeedback().events());
        feedback.add(new ClaimFeedbackEnvelope.Event("PONTOSITOM", reply.getText(), now));
        claim.setUserFeedback(new ClaimFeedbackEnvelope(feedback));
        claim.setConfidenceHistory(appendHistory(claim.getConfidenceHistory(), claim.getConfidence(),
                "felhasználói pontosítás: " + verdict.reason(), now));
        claim.setUpdatedAt(now);
        claimRepository.saveAndFlush(claim);
        revisions.record(claim, before, "REPLY", verdict.reason());
        reply.setClaimId(claim.getId());
    }

    /** Applies every ACCEPTED ruling as a row change; rejected rulings leave no trace. */
    @Transactional
    public List<ConferenceOutcomeEnvelope.Change> apply(UUID owner, UUID conferenceId, List<ClaimRuling> rulings) {
        return applyAndBind(owner, conferenceId, rulings, null).changes();
    }

    public record Applied(List<ConferenceOutcomeEnvelope.Change> changes, ConferenceDeliberationEnvelope deliberation) {}

    @Transactional
    public Applied applyAndBind(UUID owner, UUID conferenceId, List<ClaimRuling> rulings,
                                ConferenceDeliberationEnvelope deliberation) {
        mutationLock.lock(owner);
        List<ConferenceOutcomeEnvelope.Change> changes = new ArrayList<>();
        Map<Integer, ConferenceOutcomeEnvelope.Change> applied = new LinkedHashMap<>();
        for (int index = 0; index < rulings.size(); index++) {
            ClaimRuling ruling = rulings.get(index);
            if (!ruling.accepted() || !ruling.proposal().hasValidPeriods()) {
                continue;
            }
            ConferenceOutcomeEnvelope.Change change = switch (ruling.proposal().kind()) {
                case "NEW" -> applyNew(owner, conferenceId, ruling);
                case "UP" -> applyMove(owner, ruling, true);
                case "DOWN" -> applyMove(owner, ruling, false);
                case "RETIRE" -> applyRetire(owner, ruling);
                case "REVISE" -> applyRevision(owner, ruling, false);
                case "MOVE" -> applyRevision(owner, ruling, true);
                default -> null;
            };
            if (change != null) {
                changes.add(change);
                applied.put(index, change);
            }
        }
        return new Applied(List.copyOf(changes), DeliberationAssembler.bindApplied(deliberation, applied));
    }

    /** Opens each accepted chapter proposal as a new {@code CHAPTER} dimension. */
    @Transactional
    public List<ConferenceOutcomeEnvelope.Change> openChapters(UUID owner, UUID conferenceId,
                                                                List<KonziliumVerdictRound.ChapterProposal> chapters) {
        mutationLock.lock(owner);
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
        // Serialize candidate inserts within the dimension: two concurrent daily runs cannot
        // both read no duplicate and then insert the same normalized claim/evidence window.
        entityManager.refresh(dimension.get(), LockModeType.PESSIMISTIC_WRITE);
        boolean duplicate = claimRepository.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
                owner, dimension.get().getId(), ACTIVE).stream().anyMatch(claim ->
                normalizeClaimText(claim.getText()).equals(normalizeClaimText(proposal.text()))
                        && Objects.equals(claim.getObservedFrom(), proposal.observedFrom())
                        && Objects.equals(claim.getObservedTo(), proposal.observedTo()));
        boolean undone = revisions.undoneNewClaims(owner).stream().anyMatch(snapshot ->
                dimension.get().getId().equals(snapshot.dimensionId())
                        && normalizeClaimText(snapshot.text()).equals(normalizeClaimText(proposal.text()))
                        && Objects.equals(snapshot.observedFrom(), proposal.observedFrom())
                        && Objects.equals(snapshot.observedTo(), proposal.observedTo()));
        if (duplicate || undone) return null;
        BigDecimal confidence = clampNewConfidence(ruling.ruledConfidence());
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimension.get().getId());
        entity.setText(CharacterReplyService.flat(proposal.text()));
        entity.setObservedFrom(proposal.observedFrom());
        entity.setObservedTo(proposal.observedTo());
        entity.setValidFrom(proposal.validFrom());
        entity.setValidTo(proposal.validTo());
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
        revisions.record(entity, null, "NEW", ruling.reason());
        return new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", proposal.dimensionKey(),
                entity.getId().toString(), proposal.text());
    }

    private ConferenceOutcomeEnvelope.Change applyMove(UUID owner, ClaimRuling ruling, boolean up) {
        ClaimProposal proposal = ruling.proposal();
        Optional<CharacterClaimEntity> found =
                lockActiveClaim(proposal.claimId(), owner);
        if (found.isEmpty()) {
            log.warn("{} claim skipped for owner {} — unknown/foreign claim {}",
                    up ? "UP" : "DOWN", owner, proposal.claimId());
            return null;
        }
        CharacterClaimEntity entity = found.get();
        var before = ClaimRevisionSnapshot.of(entity);
        BigDecimal newConfidence = ruling.ruledConfidence();
        if (newConfidence == null) {
            newConfidence = up ? entity.getConfidence().add(CONFIDENCE_STEP)
                    : entity.getConfidence().subtract(CONFIDENCE_STEP);
        }
        newConfidence = clampClaimConfidence(newConfidence);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        entity.setConfidence(newConfidence);
        entity.setConfidenceHistory(appendHistory(entity.getConfidenceHistory(), newConfidence, CAUSE_KONZILIUM, now));
        entity.setUpdatedAt(now);
        claimRepository.save(entity);
        revisions.record(entity, before, proposal.kind(), ruling.reason());
        String dimensionKey = dimensionKeyOf(entity);
        return new ConferenceOutcomeEnvelope.Change(up ? "CLAIM_CONFIDENCE_UP" : "CLAIM_CONFIDENCE_DOWN",
                dimensionKey, entity.getId().toString(), entity.getText());
    }

    private ConferenceOutcomeEnvelope.Change applyRetire(UUID owner, ClaimRuling ruling) {
        ClaimProposal proposal = ruling.proposal();
        Optional<CharacterClaimEntity> found =
                lockActiveClaim(proposal.claimId(), owner);
        if (found.isEmpty()) {
            log.warn("RETIRE claim skipped for owner {} — unknown/foreign claim {}", owner, proposal.claimId());
            return null;
        }
        CharacterClaimEntity entity = found.get();
        var before = ClaimRevisionSnapshot.of(entity);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        entity.setStatus(RETIRED);
        entity.setConfidenceHistory(
                appendHistory(entity.getConfidenceHistory(), entity.getConfidence(), CAUSE_RETIRED, now));
        entity.setUpdatedAt(now);
        claimRepository.save(entity);
        revisions.record(entity, before, proposal.kind(), ruling.reason());
        String dimensionKey = dimensionKeyOf(entity);
        return new ConferenceOutcomeEnvelope.Change("CLAIM_RETIRED", dimensionKey,
                entity.getId().toString(), entity.getText());
    }

    private ConferenceOutcomeEnvelope.Change applyRevision(UUID owner, ClaimRuling ruling, boolean move) {
        ClaimProposal proposal = ruling.proposal();
        var found = lockActiveClaim(proposal.claimId(), owner);
        if (found.isEmpty()) return null;
        var entity = found.get();
        var before = ClaimRevisionSnapshot.of(entity);
        if (move) {
            var target = dimensionRepository.findByCreatedByAndKey(owner, proposal.dimensionKey());
            if (target.isEmpty() || target.get().getId().equals(entity.getDimensionId())) return null;
            entity.setDimensionId(target.get().getId());
        } else {
            if (proposal.text() == null || proposal.text().isBlank()) return null;
            LocalDate observedFrom = proposal.observedFrom() == null ? entity.getObservedFrom() : proposal.observedFrom();
            LocalDate observedTo = proposal.observedTo() == null ? entity.getObservedTo() : proposal.observedTo();
            LocalDate validFrom = proposal.validFrom() == null ? entity.getValidFrom() : proposal.validFrom();
            LocalDate validTo = proposal.validTo() == null ? entity.getValidTo() : proposal.validTo();
            if (!orderedDates(observedFrom, observedTo) || !orderedDates(validFrom, validTo)) return null;
            boolean datesChanged = !Objects.equals(observedFrom, entity.getObservedFrom())
                    || !Objects.equals(observedTo, entity.getObservedTo())
                    || !Objects.equals(validFrom, entity.getValidFrom()) || !Objects.equals(validTo, entity.getValidTo());
            if (proposal.text().equals(entity.getText()) && !datesChanged) return null;
            entity.setObservedFrom(observedFrom);
            entity.setObservedTo(observedTo);
            entity.setValidFrom(validFrom);
            entity.setValidTo(validTo);
            String revisedText = CharacterReplyService.flat(proposal.text());
            if (entity.getText().startsWith("Saját beszámolód szerint:") || "user".equals(entity.getProposedBy())) {
                revisedText = "Saját beszámolód szerint: " + revisedText.replaceFirst("^Saját beszámolód szerint[: ,]*", "");
            }
            entity.setText(revisedText);
            entity.setSensitive(Boolean.TRUE.equals(entity.getSensitive()) || proposal.sensitive());
            if (ruling.ruledConfidence() != null) entity.setConfidence(clampClaimConfidence(ruling.ruledConfidence()));
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        entity.setUpdatedAt(now);
        entity.setConfidenceHistory(appendHistory(entity.getConfidenceHistory(), entity.getConfidence(), CAUSE_KONZILIUM, now));
        revisions.record(entity, before, proposal.kind(), ruling.reason());
        revisions.invalidatePortrait(owner, before.dimensionId());
        if (!before.dimensionId().equals(entity.getDimensionId())) revisions.invalidatePortrait(owner, entity.getDimensionId());
        return new ConferenceOutcomeEnvelope.Change(move ? "CLAIM_MOVED" : "CLAIM_REVISED", dimensionKeyOf(entity),
                entity.getId().toString(), entity.getText());
    }

    private static String normalizeClaimText(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKC)
                .strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static boolean orderedDates(LocalDate from, LocalDate to) {
        return from == null || to == null || !from.isAfter(to);
    }

    private Optional<CharacterClaimEntity> lockActiveClaim(UUID id, UUID owner) {
        var found = claimRepository.lockOwned(id, owner);
        found.ifPresent(claim -> entityManager.refresh(claim, LockModeType.PESSIMISTIC_WRITE));
        return found.filter(claim -> ACTIVE.equals(claim.getStatus()));
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

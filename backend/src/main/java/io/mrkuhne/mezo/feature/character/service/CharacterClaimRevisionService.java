package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimRevisionSnapshot;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRevisionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Audits actual writes and reverses only unchanged latest state. No external calls in transactions. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterClaimRevisionService {
    private final CharacterClaimRevisionRepository revisions;
    private final CharacterClaimRepository claims;
    private final CharacterDimensionRepository dimensions;
    private final EntityManager entityManager;
    private final CharacterMutationLock mutationLock;

    public List<ClaimRevisionSnapshot> undoneNewClaims(UUID owner) {
        return revisions.findByCreatedByAndOperationAndUndoneAtIsNotNull(owner, "NEW").stream()
                .map(CharacterClaimRevisionEntity::getAfterSnapshot).toList();
    }

    public List<CharacterClaimRevisionEntity> list(UUID owner, UUID claimId) {
        claims.findByIdAndCreatedBy(claimId, owner).orElseThrow(CharacterClaimRevisionService::notFound);
        return revisions.findByCreatedByAndClaimIdOrderByCreatedAtDesc(owner, claimId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(CharacterClaimEntity claim, ClaimRevisionSnapshot before, String operation, String reason) {
        claims.saveAndFlush(claim);
        var revision = new CharacterClaimRevisionEntity();
        revision.setCreatedBy(claim.getCreatedBy());
        revision.setClaimId(claim.getId());
        revision.setOperation(operation);
        revision.setBeforeSnapshot(before);
        revision.setAfterSnapshot(ClaimRevisionSnapshot.of(claim));
        revision.setReason(reason == null ? "" : reason);
        revisions.saveAndFlush(revision);
    }

    public boolean canUndo(CharacterClaimRevisionEntity revision) {
        return revision.getUndoneAt() == null && claims.findByIdAndCreatedBy(revision.getClaimId(), revision.getCreatedBy())
                .map(claim -> Objects.equals(ClaimRevisionSnapshot.of(claim), revision.getAfterSnapshot()))
                .orElse(false);
    }

    public String dimensionKey(UUID owner, UUID dimensionId) {
        return dimensions.findById(dimensionId).filter(dimension -> owner.equals(dimension.getCreatedBy()))
                .map(io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity::getKey).orElse(null);
    }

    @Transactional
    public CharacterClaimRevisionEntity undo(UUID owner, UUID revisionId) {
        mutationLock.lock(owner);
        var revision = revisions.lockOwned(owner, revisionId).orElseThrow(CharacterClaimRevisionService::notFound);
        entityManager.refresh(revision, LockModeType.PESSIMISTIC_WRITE);
        if (revision.getUndoneAt() != null) return revision;
        var claim = claims.lockOwned(revision.getClaimId(), owner).orElseThrow(CharacterClaimRevisionService::notFound);
        entityManager.refresh(claim, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(ClaimRevisionSnapshot.of(claim), revision.getAfterSnapshot())) {
            throw new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_REVISION_CONFLICT").build(), HttpStatus.CONFLICT);
        }
        UUID currentDimension = claim.getDimensionId();
        if (revision.getBeforeSnapshot() == null) claim.setStatus("RETIRED");
        else revision.getBeforeSnapshot().restore(claim);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        claim.setUpdatedAt(now);
        claims.saveAndFlush(claim);
        revision.setUndoneAt(now);
        invalidatePortrait(owner, currentDimension);
        if (!currentDimension.equals(claim.getDimensionId())) invalidatePortrait(owner, claim.getDimensionId());
        return revisions.saveAndFlush(revision);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void invalidatePortrait(UUID owner, UUID dimensionId) {
        dimensions.findById(dimensionId).filter(dimension -> owner.equals(dimension.getCreatedBy())).ifPresent(dimension -> {
            entityManager.refresh(dimension, LockModeType.PESSIMISTIC_WRITE);
            dimension.setPortrait("");
            dimension.setMaturity((short) 0);
            dimension.setVersion(dimension.getVersion() + 1);
            dimension.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            dimensions.save(dimension);
        });
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
